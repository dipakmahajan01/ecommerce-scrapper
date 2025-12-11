// app.js — Node 18+
// npm i express mongoose dotenv
import express from "express";
import mongoose, { Schema } from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const LIST_API = "https://www.smartprix.com/ui/api/page-info";
const PAGE_SIZE = 20;
const MAX_FAILURES = 20;

const Ea = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function Pa(e: any) {
  if (!e) return "";
  const t = JSON.stringify(e);
  let n = "1";
  for (let s = 0; s < t.length; s++) {
    let c = t.charCodeAt(s);
    if (c > 127) n += t[s];
    else {
      c %= 95;
      n += c < 64 ? Ea[c] : "." + Ea[63 & c];
    }
  }
  return n;
}

const humanDelay = () =>
  new Promise((r) => setTimeout(r, 5000 + Math.random() * 5000));

const browserHeaders = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="130", "Not=A?Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

const GsmArenaSchema = new Schema<any>({}, { strict: false, timestamps: true });

const smartPrixResponse = mongoose.model<any>(
  "smartPrixResponse",
  GsmArenaSchema
);

// runtime-only scraper flags
let running = false;
let currentAfter = 0;
let SESSION_START = Date.now();
let reqCount = 0;
let nextRotation = 10 + Math.floor(Math.random() * 11);

function maybeRotateSession() {
  reqCount++;
  if (reqCount >= nextRotation) {
    SESSION_START = Date.now();
    reqCount = 0;
    nextRotation = 10 + Math.floor(Math.random() * 11);
    console.log("session rotated:", SESSION_START);
  }
}

async function fetchPage(after: number) {
  maybeRotateSession();
  const payload = {
    url: "/mobiles",
    data: { after },
    referrer: "https://www.smartprix.com/",
    t: Date.now(),
    st: SESSION_START,
  };
  const token = Pa(payload);
  const url = `${LIST_API}?k=${encodeURIComponent(token)}`;
  console.log("URL", url);
  const res = await fetch(url, { method: "GET", headers: browserHeaders });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function scraperLoop() {
  console.log("scraper loop started");

  let failureCount = 0;

  while (running) {
    try {
      console.log("fetching after =", currentAfter);
      const data = await fetchPage(currentAfter);

      await smartPrixResponse.create({
        after: currentAfter,
        raw: data,
        success: true,
      });

      failureCount = 0;

      const sr = data?.item?.searchResults;

      const hasNext = sr.pageInfo?.hasNextPage === true;

      if (!hasNext) {
        console.log("no next page → stop");
        running = false;
        break;
      }

      currentAfter += PAGE_SIZE;

      await humanDelay();
    } catch (err: any) {
      failureCount++;
      console.error("fetch error:", err.message);

      await smartPrixResponse.create({
        after: currentAfter,
        raw: { error: err.message },
        success: false,
        error: err.message,
      });

      if (failureCount >= MAX_FAILURES) {
        console.error("20 failures reached → stopping");
        running = false;
        break;
      }

      await new Promise((r) => setTimeout(r, 5000 + Math.random() * 10000));
    }
  }

  console.log("scraper loop finished");
}

// express server
const app = express();
app.use(express.json());

// START
app.get("/start", async (req, res) => {
  if (running)
    return res.status(400).json({ ok: false, msg: "already running" });

  currentAfter = 20;
  running = true;
  scraperLoop().catch((err) => console.error("loop crash:", err));

  res.json({ ok: true, msg: "started", after: currentAfter });
});

// STOP
app.post("/stop", (req, res) => {
  if (!running) return res.status(400).json({ ok: false, msg: "not running" });
  running = false;
  res.json({ ok: true, msg: "stopping" });
});

// STATUS (DB-driven)
app.get("/status", async (req, res) => {
  const total = await smartPrixResponse.countDocuments();
  const success = await smartPrixResponse.countDocuments({ success: true });
  const failed = await smartPrixResponse.countDocuments({ success: false });

  const last = await smartPrixResponse.findOne().sort({ createdAt: -1 });

  res.json({
    ok: true,
    running,
    total,
    success,
    failed,
    lastAfter: last?.after ?? null,
    lastStatus: last?.success === false ? "error" : "ok",
    lastError: last?.error ?? null,
  });
});

export default app;
