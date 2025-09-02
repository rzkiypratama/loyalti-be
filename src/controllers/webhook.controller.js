import {
  earnPointsForOrder,
  rollbackForRefund,
} from "../models/points.model.js";

export async function webhookHandler(req, res) {
  // Balas cepat; proses async di belakang (bisa ganti ke queue nanti)
  res.sendStatus(200);

  const { topic, shopify } = req;
  try {
    if (topic === "orders/create") {
      await earnPointsForOrder(shopify);
    } else if (topic === "orders/updated") {
      // TODO: sync status → adjust points if needed
    } else if (topic === "refunds/create") {
      await rollbackForRefund(shopify);
    } else if (topic === "customers/create") {
      // TODO: signup bonus
    }
  } catch (e) {
    console.error("Webhook worker error", topic, e);
  }
}
