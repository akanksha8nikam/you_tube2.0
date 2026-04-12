import express from "express";
import {
    getPlans,
    getUserSubscription,
    changeSubscription,
    getInvoiceHistory,
    updateWatchTime,
} from "../controllers/subscription.js";

const routes = express.Router();

routes.get("/plans", getPlans);
routes.get("/user/:userId", getUserSubscription);
routes.get("/invoices/:userId", getInvoiceHistory);
routes.patch("/change", changeSubscription);
routes.patch("/update-watch-time", updateWatchTime);

export default routes;