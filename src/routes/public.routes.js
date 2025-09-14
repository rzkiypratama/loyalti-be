import { Router } from "express";
import {
  init,
  session,
  me,
  redeem,
  tiers,
} from "../controllers/public.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const r = Router();

r.post("/public/init", init);
r.post("/public/session", session);
r.get("/me", requireAuth, me);
r.post("/redeem", requireAuth, redeem);
r.get("/tiers", requireAuth, tiers);

export default r;
