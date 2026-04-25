import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ RAZORPAY ERROR: Keys are missing in .env file!");
} else {
    console.log(`✅ Razorpay keys loaded: ${process.env.RAZORPAY_KEY_ID.substring(0, 8)}...`);
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID?.trim(),
  key_secret: process.env.RAZORPAY_KEY_SECRET?.trim(),
});

export default razorpayInstance;
