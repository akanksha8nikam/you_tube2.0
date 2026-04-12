import express from "express";
import {
  getAllDownloads,
  getDownloadLimitStatus,
  handleDownload,
  deleteDownload,
} from "../controllers/download.js";

const routes = express.Router();

routes.get("/limit/:userId", getDownloadLimitStatus);
routes.get("/:userId", getAllDownloads);
routes.post("/:videoId", handleDownload);
routes.delete("/:id", deleteDownload);

export default routes;
