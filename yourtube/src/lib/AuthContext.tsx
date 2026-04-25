import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from "firebase/auth";
import React, { useState, useEffect, useContext, createContext, ReactNode } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";
import OTPDialog from "@/components/OTPDialog";
import { toast } from "sonner";

interface User {
  _id: string;
  email: string;
  name: string;
  image: string;
  channelname?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  login: (userdata: User) => void;
  logout: () => Promise<void>;
  handlegooglesignin: () => Promise<void>;
}

const UserContext = createContext<AuthContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [mfaData, setMfaData] = useState<{ isOpen: boolean; email: string; mfaType: "email" | "mobile" }>({
    isOpen: false,
    email: "",
    mfaType: "email",
  });

  const login = (userdata: User) => {
    setUser(userdata);
    localStorage.setItem("user", JSON.stringify(userdata));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("user");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  const handlegooglesignin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseuser = result.user;

      // 1. Detect Location for MFA
      let region = "Unknown";
      try {
        const geoRes = await fetch("https://ipapi.co/json/");
        const geoData = await geoRes.json();
        region = geoData.region || "Unknown";
      } catch (e) {
        console.error("Location detection failed", e);
      }

      const payload = {
        email: firebaseuser.email,
        name: firebaseuser.displayName,
        image: firebaseuser.photoURL || "https://github.com/shadcn.png",
        region,
      };

      const response = await axiosInstance.post("/user/login", payload);
      
      if (response.data.mfaRequired) {
        setMfaData({
          isOpen: true,
          email: response.data.email || firebaseuser.email || "",
          mfaType: response.data.mfaType || "email",
        });
      } else {
        login(response.data.result);
      }
    } catch (error) {
      console.error(error);
      toast.error("Login failed. Please try again.");
    }
  };

  useEffect(() => {
    const unsubcribe = onAuthStateChanged(auth, async (firebaseuser) => {
      // For persistence, we check local storage first to avoid MFA re-triggering on reload
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        return;
      }

      // If no saved user but firebase has one, we might need MFA (this is rare on reload)
      if (firebaseuser) {
        // Just logout for safety if we don't have the session, forcing a fresh login/MFA
        // await logout();
      }
    });
    return () => unsubcribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout, handlegooglesignin }}>
      {children}
      <OTPDialog 
        isOpen={mfaData.isOpen}
        onClose={() => setMfaData(prev => ({ ...prev, isOpen: false }))}
        email={mfaData.email}
        mfaType={mfaData.mfaType}
        onVerified={(userData) => login(userData)}
      />
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
