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
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, timer]);

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
      const response = await axiosInstance.post("/user/verify-otp", {
        email,
        otp: fullOtp,
      });
      toast.success("Verification successful!");
      onVerified(response.data.result);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Verification failed");
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
            Verify Your Identity
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            We've sent a 6-digit verification code to your{" "}
            <span className="text-foreground font-medium">
              {mfaType === "email" ? "email address" : "mobile number"}
            </span>
          </DialogDescription>
        </DialogHeader>

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

          <div className="text-center text-sm">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTPDialog;
