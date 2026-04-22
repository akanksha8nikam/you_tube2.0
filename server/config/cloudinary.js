import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

console.log(`[Cloudinary Config] Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
console.log(`[Cloudinary Config] API Key: ${process.env.CLOUDINARY_API_KEY?.substring(0, 4)}...`);
console.log(`[Cloudinary Config] API Secret length: ${process.env.CLOUDINARY_API_SECRET?.length || 0}`);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
