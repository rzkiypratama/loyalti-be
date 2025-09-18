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
  if (!DOMAIN || !TOKEN) {
    const err = new Error("shopify_env_missing");
    err.status = 500;
    err.details = {
      hint: "Pastikan SHOP_DOMAIN dan SHOP_ACCESS_TOKEN terisi.",
    };
    throw err;
  }

  // Kalau sudah pernah dibuat, pakai ID yang ada
  if (voucher.shopify_price_rule_id)
    return String(voucher.shopify_price_rule_id);

  // --- Map voucher -> payload price_rule
  // Judul unik biar tidak bentrok (Shopify sensitif pada title duplikat untuk validasi tertentu)
  const title = `${voucher.code || "VOUCHER"}-${voucher.id}`;

  const body = {
    price_rule: {
      title,
      target_type: "line_item",
      target_selection: "all",
      allocation_method: "across",
      customer_selection: "all",
      // pakai ISO8601 UTC; kalau perlu pakai timezone toko, ganti sesuai kebutuhan
      starts_at: new Date().toISOString(),

      // defaults yang aman
      usage_limit: null,
      once_per_customer: false,
    },
  };

  // helper format angka ke string negatif yang valid
  const negStr = (n) => {
    const num = Number(n || 0);
    // percentage idealnya ada .0; fixed_amount kita kasih .0 juga nggak masalah
    return (-Math.abs(num)).toFixed(1);
  };

  if (voucher.discount_type === "percentage") {
    body.price_rule.value_type = "percentage";
    body.price_rule.value = negStr(voucher.discount_value); // contoh 10 -> "-10.0"
  } else if (voucher.discount_type === "fixed_amount") {
    body.price_rule.value_type = "fixed_amount";
    body.price_rule.value = negStr(voucher.discount_value); // contoh 50000 -> "-50000.0"
  } else if (voucher.discount_type === "free_shipping") {
    // Model lama REST untuk free shipping:
    body.price_rule.target_type = "shipping_line";
    body.price_rule.value_type = "percentage";
    body.price_rule.value = "-100.0";
    // penting untuk REST free shipping agar tidak error validasi
    body.price_rule.entitled_country_ids = []; // kosong = berlaku global
  } else {
    const err = new Error("unsupported_discount_type");
    err.status = 400;
    err.details = { got: voucher.discount_type };
    throw err;
  }

  // NOTE: kalau butuh minimum belanja, aktifkan ini:
  // body.price_rule.prerequisite_subtotal_range = { greater_than_or_equal_to: 300000 };

  // --- Panggil Shopify
  const r = await fetch(admin(`/price_rules.json`), {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let j;
  try {
    j = await r.json();
  } catch {
    j = { parse_error: true };
  }

  if (!r.ok || !j?.price_rule?.id) {
    // lempar detail asli biar kelihatan field yang invalid
    const err = new Error("shopify_price_rule_failed");
    err.status = r.status || 500;
    err.details = j || { note: "no response body" };
    throw err;
  }

  const id = String(j.price_rule.id);

  // simpan ke DB agar next time tidak bikin ulang
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
