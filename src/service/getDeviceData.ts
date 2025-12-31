import path from "path";
import fs from "fs";
import { SmartPrixRecord } from "./productRelevanceEngine/types";

const deviceListPath = path.join(__dirname, "../data/deviceList.json");

let cachedDeviceList: SmartPrixRecord[] | null = null;

function initDeviceList() {
  try {
    const fileContents = fs.readFileSync(deviceListPath, "utf-8");
    const data = JSON.parse(fileContents) as SmartPrixRecord[];
    cachedDeviceList = data;
  } catch (error) {
    throw new Error("Could not read deviceList.json: " + error);
  }
}

initDeviceList();

export function getDeviceList() {
  return cachedDeviceList;
}
