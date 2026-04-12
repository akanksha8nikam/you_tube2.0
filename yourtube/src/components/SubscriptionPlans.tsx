"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type PlanName = "FREE" | "BRONZE" | "SILVER" | "GOLD";

interface Plan {
    name: PlanName;
    price: number;
    maxMinutes: number | null;
}
interface Invoice {
    invoiceId: string;
    paymentDate: string;
    paymentReference: string;
    planName: PlanName;
    amount: number;
    watchLimit: string;
    paymentStatus: string;
}

const PLAN_ORDER: PlanName[] = ["FREE", "BRONZE", "SILVER", "GOLD"];
const PLAN_RANK: Record<PlanName, number> = {
    FREE: 0,
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
};

const planStyles: Record<PlanName, string> = {
    FREE: "border-gray-300",
    BRONZE: "border-amber-500",
    SILVER: "border-slate-500",
    GOLD: "border-yellow-500",
};

const SubscriptionPlans = () => {
    const { user, login } = useUser();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentPlan, setCurrentPlan] = useState<PlanName>("FREE");
    const [loading, setLoading] = useState(true);
    const [updatingPlan, setUpdatingPlan] = useState<PlanName | null>(null);
    const [message, setMessage] = useState("");
    const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [paymentRef, setPaymentRef] = useState("");

    const downloadInvoicePdf = (inv: Invoice) => {
        const escapePdfText = (value: string) =>
          value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

        const lines = [
          "YourTube Invoice",
          `Invoice ID: ${inv.invoiceId}`,
          `Payment Date: ${new Date(inv.paymentDate).toLocaleString()}`,
          `Payment Ref: ${inv.paymentReference || "N/A"}`,
          `Plan: ${inv.planName}`,
          `Amount Paid: Rs ${inv.amount}`,
          `Watch Limit: ${inv.watchLimit}`,
          `Status: ${inv.paymentStatus}`,
          "Thank you for your subscription upgrade.",
        ];

        let stream = "BT\n/F1 14 Tf\n50 790 Td\n";
        lines.forEach((line, idx) => {
          if (idx === 0) {
            stream += `(${escapePdfText(line)}) Tj\n`;
            stream += "0 -30 Td\n/F1 11 Tf\n";
          } else {
            stream += `(${escapePdfText(line)}) Tj\n0 -18 Td\n`;
          }
        });
        stream += "ET";

        const objects: string[] = [];
        objects.push("<< /Type /Catalog /Pages 2 0 R >>");
        objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
        objects.push(
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
        );
        objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
        objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

        let pdf = "%PDF-1.4\n";
        const offsets: number[] = [0];
        for (let i = 0; i < objects.length; i += 1) {
          offsets.push(pdf.length);
          pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
        }
        const xrefPos = pdf.length;
        pdf += `xref\n0 ${objects.length + 1}\n`;
        pdf += "0000000000 65535 f \n";
        for (let i = 1; i < offsets.length; i += 1) {
          pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
        }
        pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

        const blob = new Blob([pdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${inv.invoiceId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sortedPlans = useMemo(() => {
        return [...plans].sort(
            (a, b) => PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name)
        );
    }, [plans]);

    const fetchData = async () => {
        setLoading(true);
        setMessage("");

        try {
            // 1) all plans
            const plansRes = await axiosInstance.get("/subscription/plans");
            setPlans(plansRes.data || []);

            // 2) logged-in user's current plan
            if (user?._id) {
                const subRes = await axiosInstance.get(`/subscription/user/${user._id}`);
                setCurrentPlan((subRes.data?.plan || "FREE") as PlanName);
                const invoiceRes = await axiosInstance.get(`/subscription/invoices/${user._id}`);
                setInvoiceHistory(invoiceRes.data || []);
            } else {
                setCurrentPlan("FREE");
                setInvoiceHistory([]);
            }
        } catch (error) {
            console.log("Subscription fetch error:", error);
            setMessage("Failed to load subscription data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user?._id]);

    const openCheckout = (plan: PlanName) => {
        if (!user?._id) {
            setMessage("Please sign in first to change your subscription.");
            return;
        }
        if (plan === currentPlan) {
            setMessage("You are already on this plan.");
            return;
        }
        const planData = sortedPlans.find((p) => p.name === plan) || null;
        setSelectedPlan(planData);
        setPaymentRef(`PAY-${Date.now()}`);
        setCheckoutOpen(true);
    };

    const handlePlanChange = async () => {
        if (!selectedPlan || !user?._id) return;
        setUpdatingPlan(selectedPlan.name);
        setMessage("");

        try {
            const res = await axiosInstance.patch("/subscription/change", {
                userId: user._id,
                plan: selectedPlan.name,
                paymentStatus: true,
                paymentReference: paymentRef || `PAY-${Date.now()}`,
            });

            setCurrentPlan(selectedPlan.name);
            setInvoiceHistory((prev) => [res.data.invoice, ...prev]);
            setMessage(
              `Subscription updated to ${selectedPlan.name} successfully. Invoice ${res.data?.invoice?.invoiceId || ""} sent to your email.`
            );
            setCheckoutOpen(false);
            setSelectedPlan(null);

            // keep AuthContext user fresh with latest subscriptionPlan
            if (res.data?.user) {
                login(res.data.user);
            } else if (user) {
                login({ ...user, subscriptionPlan: selectedPlan.name });
            }
        } catch (error) {
            console.log("Plan update error:", error);
            setMessage("Failed to update subscription. Please try again.");
        } finally {
            setUpdatingPlan(null);
        }
    };

    if (loading) {
        return <div className="p-6">Loading subscription plans...</div>;
    }

    return (
      <>
        <div className="w-full p-6">
        <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Subscription Plans</h1>
    <p className="text-sm text-gray-600 mb-6">
        Current Plan: <span className="font-semibold">{currentPlan}</span>
        </p>

    {message && (
        <div className={`mb-4 rounded-md border p-3 text-sm ${message.includes("successfully") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {message}
            </div>
    )}

    <div className="mb-8 p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl text-white shadow-xl">
        <h2 className="text-xl font-bold mb-2">🚀 Elevate Your Experience</h2>
        <p className="text-blue-100 text-sm mb-4">Unlock unlimited watch time and exclusive features by upgrading to a higher plan today. Your daily limit resets every midnight!</p>
        <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">Daily resets active</span>
        </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sortedPlans.map((plan) => {
                const isCurrent = plan.name === currentPlan;
                const isUnlimited = plan.maxMinutes === null;

                return (
                    <div
                        key={plan.name}
                className={`rounded-xl border-2 p-4 shadow-sm ${planStyles[plan.name]} ${
                    isCurrent ? "bg-gray-50" : "bg-white"
                }`}
            >
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                    <p className="text-2xl font-bold mt-2">₹{plan.price}</p>
                <p className="text-sm text-gray-600 mt-1">
                {isUnlimited
                    ? "Unlimited watch time"
                    : `Watch up to ${plan.maxMinutes} minutes daily`}
                </p>

                <div className="mt-4">
                    {isCurrent ? (
                            <Button className="w-full bg-blue-100 text-blue-700 hover:bg-blue-100" variant="secondary" disabled>
                    Current Plan
                </Button>
            ) : (
                    <Button
                        className="w-full font-bold transition-all hover:scale-[1.02]"
                onClick={() => openCheckout(plan.name)}
                disabled={updatingPlan !== null || PLAN_RANK[plan.name] < PLAN_RANK[currentPlan]}
                variant={PLAN_RANK[plan.name] < PLAN_RANK[currentPlan] ? "outline" : "default"}
            >
                {PLAN_RANK[plan.name] < PLAN_RANK[currentPlan] ? "Tier Locked" : "Upgrade Now"}
                </Button>
            )}
                </div>
                </div>
            );
            })}
        </div>

    {user && (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-3">Invoice History</h3>
        {invoiceHistory.length === 0 ? (
          <p className="text-sm text-gray-600">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Invoice ID</th>
                  <th className="text-left p-2">Plan</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Payment Ref</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoiceHistory.map((inv) => (
                  <tr key={inv.invoiceId} className="border-t">
                    <td className="p-2">{inv.invoiceId}</td>
                    <td className="p-2">{inv.planName}</td>
                    <td className="p-2">₹{inv.amount}</td>
                    <td className="p-2">{inv.paymentReference}</td>
                    <td className="p-2">{new Date(inv.paymentDate).toLocaleString()}</td>
                    <td className="p-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => downloadInvoicePdf(inv)}
                      >
                        Download PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}

    {!user && (
        <p className="text-sm text-red-600 mt-4">
            You are not signed in. Sign in to upgrade your plan.
    </p>
    )}
    </div>
    </div>

    <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Payment</DialogTitle>
          <DialogDescription>
            Complete payment to upgrade your subscription.
          </DialogDescription>
        </DialogHeader>
        {selectedPlan && (
          <div className="space-y-2 text-sm">
            <p><strong>Plan:</strong> {selectedPlan.name}</p>
            <p><strong>Amount:</strong> ₹{selectedPlan.price}</p>
            <p>
              <strong>Watch Time:</strong>{" "}
              {selectedPlan.maxMinutes === null
                ? "Unlimited"
                : `${selectedPlan.maxMinutes} minutes daily`}
            </p>
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Payment Reference</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="UPI/Txn reference"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePlanChange}
            disabled={!selectedPlan || updatingPlan !== null}
          >
            {updatingPlan ? "Processing..." : "Pay & Upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
);
};

export default SubscriptionPlans;