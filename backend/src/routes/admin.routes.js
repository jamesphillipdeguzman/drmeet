import express from "express";
import { hybridAuth, requireRoles } from "../middlewares/auth.middleware.js";
import { getSubscriptionsOverview } from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/subscriptions-overview", hybridAuth, requireRoles(["admin"]), getSubscriptionsOverview);

export default router;
