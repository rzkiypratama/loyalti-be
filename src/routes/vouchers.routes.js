import { Router } from "express";
import {
  getVouchers,
  postRedeemVoucher,
} from "../controllers/vouchers.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const r = Router();
r.get("/vouchers", requireAuth, getVouchers); // list vouchers
r.post("/vouchers/redeem", requireAuth, postRedeemVoucher); // redeem voucher
export default r;
