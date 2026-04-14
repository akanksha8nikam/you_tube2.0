import users from "../Modals/Auth.js";
import mongoose from "mongoose";
import { sendSubscriptionInvoiceEmail } from "../mails/mails.js";

const PLAN_CONFIG = {
    FREE: { name: "FREE", price: 0, maxMinutes: 5 },
    BRONZE: { name: "BRONZE", price: 10, maxMinutes: 7 },
    SILVER: { name: "SILVER", price: 50, maxMinutes: 10 },
    GOLD: { name: "GOLD", price: 100, maxMinutes: null }, // unlimited
};

const PLAN_RANK = {
    FREE: 0,
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
};

export const getPlans = async (req, res) => {
    try {
        return res.status(200).json(Object.values(PLAN_CONFIG));
    } catch (error) {
        console.error("Subscription plans error:", error);
        return res.status(500).json({ message: "Something went wrong" });
    }
};

export const getUserSubscription = async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(404).json({ message: "User unavailable..." });
    }

    try {
        const user = await users.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Lazy reset: Check if the last reset was on a previous day (IST Timezone)
        const now = new Date();
        const lastReset = new Date(user.lastWatchTimeReset || Date.now());

        // Robust IST Day Calculator (+5:30 offset)
        const getISTDayIdentifier = (date) => {
            const d = new Date(date);
            // shift UTC to IST manually
            const istTime = d.getTime() + (5.5 * 60 * 60 * 1000);
            const istDate = new Date(istTime);
            return `${istDate.getUTCFullYear()}-${istDate.getUTCMonth()}-${istDate.getUTCDate()}`;
        };

        const todayIST = getISTDayIdentifier(now);
        const lastResetIST = getISTDayIdentifier(lastReset);
        const isDifferentDay = todayIST !== lastResetIST;

        console.log(`[Subscription Debug] User: ${user.email}`);
        console.log(`[Subscription Debug] Today (IST): ${todayIST}, Last Reset (IST): ${lastResetIST}`);
        console.log(`[Subscription Debug] Is Different Day: ${isDifferentDay}`);

        if (isDifferentDay) {
            console.log(`[Subscription Action] Triggering Reset to FREE for ${user.email}`);
            user.consumedWatchTime = 0;
            user.subscriptionPlan = "FREE"; 
            user.lastWatchTimeReset = now;
            await user.save();
            console.log(`[Subscription Action] Reset successful for ${user.email}`);
        }

        const rawPlanKey = user.subscriptionPlan || "FREE";
        const planKey = String(rawPlanKey).toUpperCase();
        const plan = PLAN_CONFIG[planKey] || PLAN_CONFIG.FREE;

        console.log(`[Subscription] User: ${user.email}, Plan: ${planKey}, Limit: ${plan.maxMinutes}m`);

        return res.status(200).json({
            plan: plan.name,
            price: plan.price,
            maxMinutes: plan.maxMinutes,
            consumedWatchTime: user.consumedWatchTime || 0,
        });
    } catch (error) {
        console.error("Get subscription error:", error);
        return res.status(500).json({ message: "Something went wrong" });
    }
};

export const updateWatchTime = async (req, res) => {
    const { userId, incrementSeconds } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(404).json({ message: "User unavailable..." });
    }

    try {
        const user = await users.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.consumedWatchTime = (user.consumedWatchTime || 0) + (incrementSeconds || 0);
        await user.save();

        console.log(`[WatchTime] User: ${user.email}, Incremented: ${incrementSeconds}s, Total: ${user.consumedWatchTime}s`);

        return res.status(200).json({
            consumedWatchTime: user.consumedWatchTime,
        });
    } catch (error) {
        console.error("Update watch time error:", error);
        return res.status(500).json({ message: "Something went wrong" });
    }
};

export const getInvoiceHistory = async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(404).json({ message: "User unavailable..." });
    }
    try {
        const user = await users.findById(userId).select("invoiceHistory");
        if (!user) return res.status(404).json({ message: "User not found" });
        const invoices = [...(user.invoiceHistory || [])].sort(
            (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
        return res.status(200).json(invoices);
    } catch (error) {
        console.error("Get invoice history error:", error);
        return res.status(500).json({ message: "Something went wrong" });
    }
};

export const changeSubscription = async (req, res) => {
    const { userId, plan, paymentStatus, paymentReference } = req.body;
    if (!userId || !plan) {
        return res.status(400).json({ message: "userId and plan are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(404).json({ message: "User unavailable..." });
    }

    const normalizedPlan = String(plan).toUpperCase();
    if (!PLAN_CONFIG[normalizedPlan]) {
        return res.status(400).json({ message: "Invalid subscription plan" });
    }

    try {
        const existingUser = await users.findById(userId);
        if (!existingUser) return res.status(404).json({ message: "User not found" });

        const currentPlanKey = String(existingUser.subscriptionPlan || "FREE").toUpperCase();
        const currentRank = PLAN_RANK[currentPlanKey] || 0;
        const requestedRank = PLAN_RANK[normalizedPlan];

        if (requestedRank < currentRank) {
            return res.status(400).json({
                message: `Downgrading is not permitted. You are currently on the ${currentPlanKey} plan. Please upgrade to a higher plan to unlock more features!`,
            });
        }

        const selectedPlan = PLAN_CONFIG[normalizedPlan];
        const isPaidPlan = selectedPlan.price > 0;

        if (isPaidPlan && !paymentStatus) {
            return res.status(400).json({
                message: "Payment is required to upgrade to paid plans.",
            });
        }

        const invoiceId = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const paymentDate = new Date().toISOString();
        const watchLimit =
            selectedPlan.maxMinutes === null
                ? "Unlimited"
                : `${selectedPlan.maxMinutes} minutes daily`;
        const invoiceData = {
            invoiceId,
            paymentDate,
            paymentReference: paymentReference || "N/A",
            planName: selectedPlan.name,
            amount: selectedPlan.price,
            watchLimit,
            paymentStatus: "PAID",
        };

        const updatedUser = await users.findByIdAndUpdate(
            userId,
            {
                $set: { subscriptionPlan: normalizedPlan },
                $push: { invoiceHistory: invoiceData },
            },
            { new: true }
        );

        if (updatedUser?.email) {
            await sendSubscriptionInvoiceEmail({
                to: updatedUser.email,
                username: updatedUser.name || "User",
                planName: selectedPlan.name,
                planPrice: selectedPlan.price,
                watchLimit,
                invoiceId,
                paymentDate,
            });
        }

        return res.status(200).json({
            message: "Subscription updated successfully",
            plan: {
                name: selectedPlan.name,
                price: selectedPlan.price,
                maxMinutes: selectedPlan.maxMinutes,
            },
            invoice: {
                ...invoiceData,
            },
            user: updatedUser,
        });
    } catch (error) {
        console.error("Change subscription error:", error);
        return res.status(500).json({ message: "Something went wrong" });
    }
};