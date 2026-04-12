import axios from "axios";

// Use proxy so API calls hit same origin (avoids CORS and env issues)
const baseURL =
  typeof window !== "undefined"
    ? "/api/proxy"
    : process.env.BACKEND_URL || "http://localhost:5000";

const axiosInstance = axios.create({ baseURL });
export default axiosInstance;
