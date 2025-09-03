import { Router } from "express";
// import { webhookGuard } from "../middlewares/webhook_guard.js";
import { webhookHandler } from "../controllers/webhook.controller.js";

const r = Router();
r.post("/orders/create", webhookHandler);
r.post("/orders/updated", webhookHandler);
r.post("/refunds/create", webhookHandler);
r.post("/customers/create", webhookHandler);
export default r;
