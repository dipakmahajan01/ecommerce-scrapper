import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const OUT_PATH = path.join(__dirname, "../data/deviceList.json");
const COLLECTION = "smartprixresponses";
const DB_NAME = "ecommerce-scrapper";

async function run() {
  console.log("Starting device list export process...");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI environment variable is not set. Please set it in your .env file."
    );
  }

  await mongoose.connect(mongoUri, { dbName: DB_NAME });
  console.log(
    `Connected to database '${DB_NAME}'. Looking for collection: ${COLLECTION}`
  );

  const db = mongoose.connection.db;
  if (!db) throw new Error("DB not connected");

  console.log("Fetching devices from the database...");
  const devices = await db
    .collection(COLLECTION)
    .find(
      {
        "parseHtmlSpec.meta.lifecycle": {
          $in: ["unknown", "considerable"],
        },
      },
      { projection: { html: 0 } }
    )
    .toArray();

  const deviceCount = devices ? devices.length : 0;

  if (!devices || deviceCount === 0) {
    console.log("No devices found in collection.");
    throw new Error("No devices found in collection");
  }

  console.log(`Found ${deviceCount} devices. Writing to file: ${OUT_PATH}`);
  fs.writeFileSync(OUT_PATH, JSON.stringify(devices, null, 2), "utf-8");
  console.log(`Successfully written ${deviceCount} devices to ${OUT_PATH}`);

  await mongoose.disconnect();
  console.log("Disconnected from database. Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("An error occurred during export:", err);
  process.exit(1);
});
