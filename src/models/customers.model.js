import { query } from "../configs/db.js";

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

export async function redeemPoints(customerId, points) {
  // TODO: lock row + validate balance + create price rule + code
  // sementara mock:
  await query(
    `UPDATE point_wallets SET balance = balance - $2 WHERE customer_id=$1`,
    [customerId, points]
  );
  return { discount_code: "LOYAL-TEST", value_cents: points * 50 }; // contoh: 1 poin = Rp0,5
}
