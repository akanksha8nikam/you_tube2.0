import express from "express";
import { login, updateprofile, getUserById, verifyOTP } from "../controllers/auth.js";
const routes = express.Router();

routes.post("/login", login);
routes.post("/verify-otp", verifyOTP);
routes.patch("/update/:id", updateprofile);
routes.get("/:id", getUserById);
export default routes;
