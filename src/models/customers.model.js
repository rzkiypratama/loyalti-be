import { query } from "../configs/db.js";
import { pool } from "../configs/db.js";

export async function getOrCreateCustomerByEmail(email) {
  const rows = await query(
    `INSERT INTO customers(email)
     VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email`,
    [email]
  );
  const customer = rows[0];
  await query(
    `INSERT INTO point_wallets(customer_id) VALUES ($1)
     ON CONFLICT (customer_id) DO NOTHING`,
    [customer.id]
  );
  return customer;
}

export async function getWalletView(customerId) {
  const [w] = await query(
    `SELECT balance, lifetime_points
       FROM point_wallets WHERE customer_id=$1`,
    [customerId]
  );
  const [t] = await query(
    `SELECT tiers.name AS tier_name
       FROM customer_tiers
       JOIN tiers ON tiers.id = customer_tiers.tier_id
       WHERE customer_id=$1
       ORDER BY assigned_at DESC LIMIT 1`,
    [customerId]
  );
  return {
    balance: w?.balance || 0,
    lifetime_points: w?.lifetime_points || 0,
    tier_name: t?.tier_name || "Bronze",
  };
}

/**
 * Redeem poin:
 * - Tolak jika points <= 0
 * - Tolak jika points > balance
 * - Transaksi + SELECT ... FOR UPDATE (anti race)
 * - Catat ke point_transactions (delta negatif)
 * Return { balance } terbaru (tanpa buat kode diskon dulu)
 */
export async function redeemPoints(customerId, points) {
  const P = parseInt(points, 10);
  if (!Number.isFinite(P) || P <= 0) {
    const err = new Error("invalid_points");
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `SELECT balance
         FROM point_wallets
        WHERE customer_id=$1
        FOR UPDATE`,
      [customerId]
    );
    if (!rowCount) {
      const err = new Error("wallet_not_found");
      err.status = 404;
      throw err;
    }
    const balance = Number(rows[0].balance) || 0;

    if (P > balance) {
      const err = new Error("insufficient_points");
      err.status = 400;
      err.balance = balance;
      throw err;
    }

    await client.query(
      `UPDATE point_wallets
          SET balance = balance - $2,
              updated_at = now()
        WHERE customer_id = $1`,
      [customerId, P]
    );

    await client.query(
      `INSERT INTO point_transactions(customer_id, delta, reason, meta)
       VALUES ($1, $2, 'REDEEM', $3)`,
      [customerId, -P, JSON.stringify({ via: "api/redeem" })]
    );

    const { rows: w2 } = await client.query(
      `SELECT balance FROM point_wallets WHERE customer_id=$1`,
      [customerId]
    );

    await client.query("COMMIT");
    return { balance: Number(w2[0].balance) };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getTierInfo(customerId) {
  // ambil lifetime_points & (opsional) tier tersimpan
  const [w] = await query(
    `SELECT lifetime_points FROM point_wallets WHERE customer_id = $1`,
    [customerId]
  );
  const lifetime = Number(w?.lifetime_points || 0);

  // ambil semua tier (urut dari min_points naik)
  const tiers = await query(
    `SELECT id, name, min_points
       FROM tiers
      ORDER BY min_points ASC`
  );
  if (!tiers.length) {
    // fallback: kalau belum ada tier di DB
    return {
      current: { name: "Bronze", min_points: 0 },
      next: null,
      progress: { lifetime, pct: 100, to_next: 0, next_min: null },
    };
  }

  // tentukan current
  let current = tiers[0];
  for (const t of tiers) {
    if (lifetime >= Number(t.min_points)) current = t;
    else break;
  }

  // cari next (tier setelah current)
  const idx = tiers.findIndex((t) => t.id === current.id);
  const next = idx >= 0 && idx < tiers.length - 1 ? tiers[idx + 1] : null;

  // progress
  let pct = 100,
    to_next = 0,
    next_min = null;
  if (next) {
    next_min = Number(next.min_points);
    const base = Number(current.min_points);
    const span = Math.max(1, next_min - base);
    const gained = Math.max(0, lifetime - base);
    pct = Math.max(0, Math.min(100, Math.round((gained / span) * 100)));
    to_next = Math.max(0, next_min - lifetime);
  }

  return {
    current: {
      id: current.id,
      name: current.name,
      min_points: Number(current.min_points),
    },
    next: next
      ? { id: next.id, name: next.name, min_points: Number(next.min_points) }
      : null,
    progress: { lifetime, pct, to_next, next_min },
  };
}
