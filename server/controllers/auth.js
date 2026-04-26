import mongoose from "mongoose";
import users from "../Modals/Auth.js";
import { sendOTPMail, sendOTPSMS } from "../mails/mails.js";

const SOUTH_INDIAN_STATES = [
  "Tamil Nadu",
  "Kerala",
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
];

export const login = async (req, res) => {
  const { email, name, image, region } = req.body;

  try {
    let user = await users.findOne({ email });

    if (!user) {
      user = await users.create({ email, name, image });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    const isSouthIndia = SOUTH_INDIAN_STATES.includes(region);

    if (isSouthIndia) {
      await sendOTPMail(email, otp);
      return res.status(200).json({
        mfaRequired: true,
        mfaType: "email",
        message: "OTP sent to your registered email.",
        email: email,
      });
    } else {
      // For other states, we use Firebase Phone Auth on the client side
      return res.status(200).json({
        mfaRequired: true,
        mfaType: "mobile",
        message: "Please verify your mobile number.",
        email: email,
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await users.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.otp || user.otp !== otp || new Date() > user.otpExpiry) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    return res.status(200).json({ result: user });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyPhoneLogin = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await users.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Since Firebase handled the real SMS verification on the frontend,
    // and the frontend only calls this after success, we trust it.
    return res.status(200).json({ result: user });
  } catch (error) {
    console.error("Phone verification error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { channelname, description } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(500).json({ message: "User unavailable..." });
  }
  try {
    const updatedata = await users.findByIdAndUpdate(
      _id,
      {
        $set: {
          channelname: channelname,
          description: description,
        },
      },
      { new: true }
    );
    return res.status(201).json(updatedata);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    let user;
    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await users.findById(id);
    }
    
    // If not found by ID, or ID was not a valid ObjectId, try finding by name or channelname
    if (!user) {
      user = await users.findOne({ 
        $or: [
          { name: id },
          { channelname: id }
        ]
      });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ result: user });
  } catch (error) {
    console.error("Fetch user error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};
