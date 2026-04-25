import React from "react";
import SubscriptionPlans from "@/components/SubscriptionPlans";

const SubscriptionsPage = () => {
    return (
        <div className="min-h-screen bg-background text-foreground w-full transition-colors duration-500">
            <SubscriptionPlans />
        </div>
    );
};

export default SubscriptionsPage;