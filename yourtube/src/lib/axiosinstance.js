import axios from "axios";

// Bypass Next.js proxy to avoid build-time env var caching and edge payload limits
const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const axiosInstance = axios.create({ baseURL });
export default axiosInstance;
