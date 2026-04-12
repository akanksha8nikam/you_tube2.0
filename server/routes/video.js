import express from "express";
import { deletevideo, getallvideo, getVideosByChannel, updatevideo, uploadvideo } from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post("/upload", upload.single("file"), uploadvideo);
routes.get("/getall", getallvideo);
routes.delete("/delete/:id", deletevideo);
routes.patch("/update/:id", updatevideo);
routes.get("/channel/:id", getVideosByChannel);
export default routes;
