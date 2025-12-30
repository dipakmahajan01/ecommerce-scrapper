import path from "path";
import fs from "fs";

export type SpecSectionObject = Record<string, string>;
export type SpecsObject = Record<string, SpecSectionObject>;

export type Lifecycle =
  | "rumored"
  | "upcoming"
  | "considerable"
  | "outdated"
  | "unknown";

export type Variant = {
  name: string;
  link: string;
};

export type FullSpecsResult = {
  meta: {
    brand?: string;
    model?: string;
    lifecycle: Lifecycle;
    variants: Variant[];
    releaseDate: string | null;
    releaseStatus: string | null;
  };
  specs: SpecsObject;
};

export type SmartPrixRecord = {
  link: string;
  title: string;
  brand?: string;
  success: boolean;
  html?: string;
  parseHtmlSpec?: FullSpecsResult;
  createdAt?: Date;
  updatedAt?: Date;
};

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
