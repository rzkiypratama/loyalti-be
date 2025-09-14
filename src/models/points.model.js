import { query } from "../configs/db.js";

export async function earnPointsForOrder(order) {
  // contoh kalkulasi sederhana
  const email = order?.email || order?.customer?.email;
  if (!email) return;
  const [{ id: cid }] = await query(
    `INSERT INTO customers(email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email
     RETURNING id`,
    [email]
  );
  await query(
    `INSERT INTO point_wallets(customer_id) VALUES ($1)
               ON CONFLICT (customer_id) DO NOTHING`,
    [cid]
  );

  const cents = Math.max(
    0,
    Math.round(
      Number(order?.current_total_price_set?.shop_money?.amount || 0) * 100
    )
  );
  const basePer = 100000;
  const basePts = 100;
  const points = Math.floor(cents / basePer) * basePts;

  if (points > 0) {
    await query(
      `UPDATE point_wallets
                   SET balance = balance + $2,
                       lifetime_points = lifetime_points + $2,
                       updated_at = now()
                 WHERE customer_id=$1`,
      [cid, points]
    );
    await query(
      `INSERT INTO point_transactions(customer_id, delta, reason, meta)
                 VALUES ($1, $2, $3, $4)`,
      [
        cid,
        points,
        `ORDER#${order.id}`,
        JSON.stringify({ order_id: order.id, cents }),
      ]
    );
  }
}

export async function rollbackForRefund(refundPayload) {
  // TODO: cari transaksi order-id terkait dan rollback proporsional
}

export async function grantSignupBonus(customerId, bonus = 200) {
  bonus = parseInt(bonus, 10);
  if (!customerId || !Number.isFinite(bonus) || bonus <= 0) return;

  // Cek apakah sudah pernah diberi bonus signup
  const exists = await query(
    `SELECT 1 FROM point_transactions 
     WHERE customer_id = $1 AND reason = 'SIGNUP_BONUS' LIMIT 1`,
    [customerId]
  );
  if (exists.length) return; // sudah pernah, idempoten

  // Tambah saldo & lifetime, catat transaksi
  await query(
    `UPDATE point_wallets 
       SET balance = balance + $2, lifetime_points = lifetime_points + $2, updated_at = now()
     WHERE customer_id = $1`,
    [customerId, bonus]
  );
  await query(
    `INSERT INTO point_transactions(customer_id, delta, reason, meta)
     VALUES ($1, $2, 'SIGNUP_BONUS', $3)`,
    [customerId, bonus, JSON.stringify({ source: "webhook:customers/create" })]
  );
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
