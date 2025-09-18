import { query } from "../configs/db.js";
import fetch from "node-fetch";

export async function listVouchers() {
  // alias min_points -> points_cost biar UI gak perlu diubah
  const rows = await query(`
    SELECT
      id,
      code,
      title,
      description,
      min_points AS points_cost,
      discount_type,
      discount_value,
      duration_days
    FROM vouchers
    ORDER BY min_points ASC, id ASC
  `);
  return rows;
}

export async function redeemVoucher(customerId, voucherId) {
  // 1) Ambil voucher
  const [v] = await query(`SELECT * FROM vouchers WHERE id=$1`, [voucherId]);
  if (!v) {
    const err = new Error("voucher_not_found");
    err.status = 404;
    throw err;
  }

  // 2) Ambil wallet & cek saldo
  const [w] = await query(
    `SELECT balance FROM point_wallets WHERE customer_id=$1`,
    [customerId]
  );
  const balance = w?.balance || 0;
  if (balance < v.min_points) {
    const err = new Error("insufficient_points");
    err.status = 400;
    throw err;
  }

  // 3) Kurangi poin & catat transaksi
  await query(
    `UPDATE point_wallets SET balance=balance-$2 WHERE customer_id=$1`,
    [customerId, v.min_points]
  );
  await query(
    `INSERT INTO point_transactions(customer_id, delta, reason, meta)
     VALUES ($1, $2, 'REDEEM_VOUCHER', $3)`,
    [customerId, -v.min_points, JSON.stringify({ voucher_id: v.id })]
  );

  // 4) Panggil Shopify API → generate discount code
  const priceRuleId = await ensurePriceRule(v); // helper, bikin sekali saja
  const code = `LOYAL-${customerId}-${Date.now().toString().slice(-6)}`;
  await createDiscountCode(priceRuleId, code);

  // 5) Catat redemption
  await query(
    `INSERT INTO redemptions(customer_id, voucher_id, code)
     VALUES ($1, $2, $3)`,
    [customerId, v.id, code]
  );

  return { voucher: v, code };
}

async function ensurePriceRule(voucher) {
  // TODO: cache di DB supaya ga bikin berulang
  // Panggil Shopify Admin API create price rule → return ID
}

async function createDiscountCode(priceRuleId, code) {
  const r = await fetch(
    `https://${process.env.SHOP_DOMAIN}/admin/api/2023-10/price_rules/${priceRuleId}/discount_codes.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": process.env.SHOP_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ discount_code: { code } }),
    }
  );
  if (!r.ok) throw new Error(`Failed to create discount code: ${r.status}`);
  return await r.json();
}
