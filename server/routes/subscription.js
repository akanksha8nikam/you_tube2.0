import express from "express";
import {
    getPlans,
    getUserSubscription,
    changeSubscription,
    getInvoiceHistory,
    updateWatchTime,
    createOrder,
    verifyPayment,
} from "../controllers/subscription.js";

const routes = express.Router();

routes.get("/plans", getPlans);
routes.get("/user/:userId", getUserSubscription);
routes.get("/invoices/:userId", getInvoiceHistory);
routes.patch("/change", changeSubscription);
routes.patch("/update-watch-time", updateWatchTime);
routes.post("/create-order", createOrder);
routes.post("/verify-payment", verifyPayment);

export default routes;