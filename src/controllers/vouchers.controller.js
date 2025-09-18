import { listVouchers, redeemVoucher } from "../models/vouchers.model.js";

export async function getVouchers(req, res) {
  const rows = await listVouchers();
  res.json(rows);
}

export async function postRedeemVoucher(req, res) {
  const { voucherId } = req.body || {};
  if (!voucherId) return res.status(400).json({ error: "voucher_required" });
  try {
    const out = await redeemVoucher(req.user.cid, voucherId);
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
