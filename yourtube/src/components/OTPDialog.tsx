import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Mail, Phone, Loader2 } from "lucide-react";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

interface OTPDialogProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  mfaType: "email" | "mobile";
  onVerified: (userData: any) => void;
}

const OTPDialog = ({ isOpen, onClose, email, mfaType, onVerified }: OTPDialogProps) => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(300); // 5 minutes
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(mfaType === "mobile");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowPhoneInput(mfaType === "mobile");
      setOtp(["", "", "", "", "", ""]);
      setConfirmationResult(null);
      setTimer(300);
    }
  }, [isOpen, mfaType]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, timer]);

  // Setup Recaptcha
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && mfaType === "mobile") {
      // Always clear old verifier when reopening
      if (recaptchaVerifier.current) {
        try { recaptchaVerifier.current.clear(); } catch(e) {}
        recaptchaVerifier.current = null;
      }

      timer = setTimeout(() => {
        const container = document.getElementById("recaptcha-container");
        if (container && auth) {
          try {
            recaptchaVerifier.current = new RecaptchaVerifier(auth, "recaptcha-container", {
              size: "invisible",
            });
          } catch (e) {
            console.error("Recaptcha init failed", e);
          }
        }
      }, 500);
    }

    return () => {
      if (timer) clearTimeout(timer);
      // Cleanup verifier on close
      if (!isOpen && recaptchaVerifier.current) {
        try { recaptchaVerifier.current.clear(); } catch(e) {}
        recaptchaVerifier.current = null;
      }
    };
  }, [isOpen, mfaType]);

  const handleSendSMS = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number with country code (e.g., +91...)");
      return;
    }

    setLoading(true);
    try {
      if (!recaptchaVerifier.current) {
        recaptchaVerifier.current = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      }
      
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier.current);
      setConfirmationResult(result);
      setShowPhoneInput(false);
      toast.success("SMS code sent!");
      setTimer(300); // Reset timer
    } catch (error: any) {
      console.error("SMS Error:", error);
      toast.error(error.message || "Failed to send SMS code.");
      // Reset recaptcha on error
      if (recaptchaVerifier.current) {
        recaptchaVerifier.current.clear();
        recaptchaVerifier.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^[a-zA-Z0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const newOtp = [...otp];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);
    // Focus last filled or next empty
    const focusIndex = Math.min(pastedData.length, 5);
    inputs.current[focusIndex]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      toast.error("Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      if (mfaType === "mobile" && confirmationResult) {
        // 1. Verify via Firebase
        await confirmationResult.confirm(fullOtp);
        
        // 2. Finalize with our backend
        const response = await axiosInstance.post("/user/verify-phone-login", {
          email,
        });
        
        toast.success("Mobile verification successful!");
        onVerified(response.data.result);
        onClose();
      } else {
        // Standard Email OTP verification
        const response = await axiosInstance.post("/user/verify-otp", {
          email,
          otp: fullOtp,
        });
        toast.success("Verification successful!");
        onVerified(response.data.result);
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-background border-border shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            {mfaType === "email" ? (
              <Mail className="w-6 h-6 text-primary" />
            ) : (
              <Phone className="w-6 h-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            {showPhoneInput ? "Register Mobile Number" : "Verify Your Identity"}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {showPhoneInput 
              ? "Please enter your mobile number with country code to receive an OTP."
              : `We've sent a 6-digit verification code to your ${mfaType === "email" ? "email address" : "mobile number"}`
            }
          </DialogDescription>
        </DialogHeader>

        <div id="recaptcha-container"></div>

        {showPhoneInput ? (
          <div className="space-y-4 my-6">
            <Input 
              placeholder="+91 98765 43210" 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="h-12 text-lg text-center tracking-wider"
            />
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSendSMS} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send OTP via SMS"}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-2 my-6">
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 focus-visible:ring-primary focus-visible:border-primary bg-muted/30"
                />
              ))}
            </div>

            <div className="space-y-4">
              <Button
                className="w-full h-12 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={handleVerify}
                disabled={loading || timer === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>
            </div>
          </>
        )}

          <div className="text-center text-xs text-muted-foreground mt-6 px-4 leading-relaxed opacity-60">
            This site is protected by reCAPTCHA and the Google 
            <a href="https://policies.google.com/privacy" className="hover:underline mx-1">Privacy Policy</a> and
            <a href="https://policies.google.com/terms" className="hover:underline mx-1">Terms of Service</a> apply.
          </div>

          <div className="text-center text-sm mt-4">
            {timer > 0 ? (
              <p className="text-muted-foreground">
                Code expires in <span className="text-primary font-medium">{formatTime(timer)}</span>
              </p>
            ) : (
              <button 
                className="text-primary hover:underline font-medium"
                onClick={() => window.location.reload()} // Simplified resend logic
              >
                Code expired. Try login again.
              </button>
            )}
          </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTPDialog;
