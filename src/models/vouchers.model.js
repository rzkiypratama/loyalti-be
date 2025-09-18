import { query } from "../configs/db.js";
import fetch from "node-fetch";

const API_VER = process.env.SHOPIFY_API_VERSION || "2024-07";
const DOMAIN = process.env.SHOP_DOMAIN; // iminxx-test.myshopify.com
const TOKEN = process.env.SHOP_ACCESS_TOKEN;

function admin(path) {
  return `https://${DOMAIN}/admin/api/${API_VER}${path}`;
}

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
  if (voucher.shopify_price_rule_id) return voucher.shopify_price_rule_id;

  // Map konfigurasi voucher -> payload Price Rule
  let value_type,
    value,
    target_type = "line_item",
    target_selection = "all",
    allocation_method = "across";
  let body = {
    price_rule: {
      title: voucher.code || `VOUCHER-${voucher.id}`,
      target_type,
      target_selection,
      allocation_method,
      customer_selection: "all",
      starts_at: new Date().toISOString(),
    },
  };

  if (voucher.discount_type === "percentage") {
    value_type = "percentage";
    value = (-Number(voucher.discount_value)).toString(); // -10 = 10%
    body.price_rule.value_type = value_type;
    body.price_rule.value = value;
  } else if (voucher.discount_type === "fixed_amount") {
    value_type = "fixed_amount";
    value = (-Number(voucher.discount_value)).toString(); // -50000 = Rp 50.000
    body.price_rule.value_type = value_type;
    body.price_rule.value = value;
  } else if (voucher.discount_type === "free_shipping") {
    // Cara aman di REST lama: gunakan free shipping price rule
    body.price_rule.target_type = "shipping_line";
    body.price_rule.value_type = "percentage";
    body.price_rule.value = "-100.0";
  } else {
    throw new Error("unsupported_discount_type");
  }

  // Minimum belanja? (kalau kamu butuh – belum ada kolomnya di schema pendek)
  // body.price_rule.prerequisite_subtotal_range = { greater_than_or_equal_to: 300000 }

  const r = await fetch(admin(`/price_rules.json`), {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || !j.price_rule?.id) {
    const err = new Error("shopify_price_rule_failed");
    err.details = j;
    throw err;
  }
  const id = String(j.price_rule.id);

  // simpan ke DB biar next time langsung pakai
  await query(`UPDATE vouchers SET shopify_price_rule_id=$1 WHERE id=$2`, [
    id,
    voucher.id,
  ]);
  return id;
}

async function createDiscountCode(priceRuleId, code) {
  const r = await fetch(
    admin(`/price_rules/${priceRuleId}/discount_codes.json`),
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ discount_code: { code } }),
    }
  );
  const j = await r.json();
  if (!r.ok || !j.discount_code?.code) {
    const err = new Error(`shopify_discount_code_failed`);
    err.details = j;
    throw err;
  }
  return j.discount_code.code;
}
