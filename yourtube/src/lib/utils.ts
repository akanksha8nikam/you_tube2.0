import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getVideoUrl(filepath: string) {
  if (!filepath) return "";
  
  // 1. If it's already a full URL (Cloudinary) or Base64, return as is
  if (filepath.startsWith("http") || filepath.startsWith("data:")) {
    return filepath;
  }

  // 2. Resolve the Backend URL
  const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");
  
  // 3. Clean the filepath (remove leading slashes and fix windows backslashes)
  const cleanPath = filepath.replace(/\\/g, "/").replace(/^\/+/, "");

  // 4. If the path already includes "uploads/", don't double it if we are manually adding it
  // But usually, the DB stores "uploads/filename", so we just append.
  return `${backendUrl}/${cleanPath}`;
}
