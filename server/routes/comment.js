import express from "express";
import {
  deletecomment,
  editcomment,
  getallcomment,
  postcomment,
  reactcomment,
  translatecomment,
} from "../controllers/comment.js";


const routes = express.Router();
routes.get("/:videoid", getallcomment);
routes.post("/postcomment", postcomment);
routes.delete("/deletecomment/:id", deletecomment);
routes.post("/editcomment/:id", editcomment);
routes.post("/react/:id", reactcomment);
routes.post("/translate/:id", translatecomment);
export default routes;
