import { Router } from "express";
import { webhookGuard } from "../middlewares/webhook_guard.js";
import { webhookHandler } from "../controllers/webhook.controller.js";

const r = Router();
r.post("/orders/create", webhookGuard, webhookHandler);
r.post("/orders/updated", webhookGuard, webhookHandler);
r.post("/refunds/create", webhookGuard, webhookHandler);
r.post("/customers/create", webhookGuard, webhookHandler);
export default r;
