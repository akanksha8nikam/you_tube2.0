import mongoose from "mongoose";

const userschema = mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  channelname: { type: String },
  description: { type: String },
  image: { type: String },
  joinedon: { type: Date, default: Date.now },

  // Subscription fields
  subscriptionPlan: {
    type: String,
    enum: ["FREE", "BRONZE", "SILVER", "GOLD"],
    default: "FREE",
  },
  invoiceHistory: [
    {
      invoiceId: { type: String },
      paymentDate: { type: Date, default: Date.now },
      paymentReference: { type: String },
      planName: { type: String, enum: ["FREE", "BRONZE", "SILVER", "GOLD"] },
      amount: { type: Number, default: 0 },
      watchLimit: { type: String },
      paymentStatus: { type: String, default: "PAID" },
    },
  ],
  consumedWatchTime: { type: Number, default: 0 }, // in seconds
  lastWatchTimeReset: { type: Date, default: Date.now },
});

export default mongoose.model("user", userschema);