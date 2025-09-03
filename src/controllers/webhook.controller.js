import {
  earnPointsForOrder,
  rollbackForRefund,
  grantSignupBonus,
} from "../models/points.model.js";
import { query } from "../configs/db.js";

export async function webhookHandler(req, res) {
  // balas cepat ke Shopify (tidak block)
  res.sendStatus(200);

  const topic = req.topic; // diset oleh webhookGuard
  const shopify = req.shopify || {}; // { body, shop_domain, ... } dari guard
  const body = shopify.body || req.body || {};

  try {
    if (topic === "orders/create") {
      await earnPointsForOrder(shopify);
    } else if (topic === "orders/updated") {
      // TODO: sync status → adjust points if needed
    } else if (topic === "refunds/create") {
      await rollbackForRefund(shopify);
    } else if (topic === "customers/create") {
      const email = (body.email || "").toLowerCase().trim();
      if (!email) return; // tidak ada email → skip bonus

      // upsert customer
      const name = `${body.first_name || ""} ${body.last_name || ""}`.trim();
      const rows = await query(
        `INSERT INTO customers(email, name)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [email, name]
      );
      const customerId = rows[0].id;

      // ensure wallet
      await query(
        `INSERT INTO point_wallets(customer_id, balance, lifetime_points)
         VALUES ($1, 0, 0)
         ON CONFLICT (customer_id) DO NOTHING`,
        [customerId]
      );

      // signup bonus (idempoten di grantSignupBonus)
      const bonus = parseInt(process.env.SIGNUP_BONUS_POINTS || "200", 10);
      if (Number.isFinite(bonus) && bonus > 0) {
        await grantSignupBonus(customerId, bonus);
      }
    }
  } catch (e) {
    console.error("Webhook worker error", topic, e);
  }
}
