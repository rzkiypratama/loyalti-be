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
