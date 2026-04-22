import cloudinary from "./config/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("Checking Cloudinary Configuration...");
  console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
  console.log("API Key:", process.env.CLOUDINARY_API_KEY);
  // Do NOT log the secret for security, but check if it exists
  console.log("API Secret found:", process.env.CLOUDINARY_API_SECRET ? "YES" : "NO");

  try {
    console.log("\nAttempting a test upload to Cloudinary...");
    
    // Create a dummy text file to upload
    const testFile = path.resolve(__dirname, "test_upload.txt");
    fs.writeFileSync(testFile, "This is a test upload for Cloudinary connectivity.");

    const result = await cloudinary.uploader.upload(testFile, {
      folder: "test_folder",
      resource_type: "raw"
    });

    console.log("✅ SUCCESS! Cloudinary is working perfectly.");
    console.log("Public ID:", result.public_id);
    console.log("URL:", result.secure_url);
    
    // Clean up
    fs.unlinkSync(testFile);
    process.exit(0);
  } catch (err) {
    console.error("❌ CLOUDINARY ERROR:", err.message);
    if (err.message.includes("Invalid Signature")) {
      console.error("\n💡 DIAGNOSIS: The 'Invalid Signature' error means Cloudinary rejected your API Secret.");
      console.error("Please ensure there are no extra spaces or hidden characters in your .env file.");
    }
    process.exit(1);
  }
}

runTest();
