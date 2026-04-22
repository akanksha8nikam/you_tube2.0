import express from "express";
import { deletevideo, getallvideo, getVideosByChannel, updatevideo, uploadvideo } from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post("/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("!!! MULTER UPLOAD ERROR !!!");
      console.error("Error Message:", err.message);
      if (err.stack) console.error("Stack:", err.stack);
      return res.status(500).json({ message: "File upload to Cloudinary failed", error: err.message });
    }
    next();
  });
}, uploadvideo);
routes.get("/getall", getallvideo);
routes.delete("/delete/:id", deletevideo);
routes.patch("/update/:id", updatevideo);
routes.get("/channel/:id", getVideosByChannel);
export default routes;
