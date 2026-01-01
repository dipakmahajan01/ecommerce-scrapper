// app.js — Node 18+
// npm i express mongoose dotenv
import express from "express";
import mongoose, { Schema } from "mongoose";
import dotenv from "dotenv";

// ADD: playwright import
import { Browser, BrowserContext, chromium, Page } from "playwright";
import {
  normalizeSpecs,
  parseSmartprixPhoneSpecs,
} from "./services/smartprix-products-extractions";
import productSearch from "./services/flipkart-product-spec-scrapper/product-search";
import { smartPrixResponse } from "./models/smartprix";
import {
  populateProductDetails,
  sortProductList,
} from "./services/smartprix-products-extractions/product-sort";

/**
 * Starts scraping the Smartprix mobiles page.
 * - Visits https://www.smartprix.com/mobiles
 * - Waits for page load
 * - Clicks "Load More" (div.sm-load-more)
 * - Waits for new data to be appended (simple delay for now)
 * - (Scraping logic can be injected later)
 * - Waits 10-20 seconds between actions
 * - Repeats until "Load More" is not clickable
 */

let MODE: "IDLE" | "RUNNING" | "STOPPED" = "IDLE";
let failureCount = 0;
let loopCount = 0;

const color = {
  info: (...args: any[]) => console.log(`\x1b[36m[INFO]\x1b[0m`, ...args),
  warn: (...args: any[]) => console.log(`\x1b[33m[WARN]\x1b[0m`, ...args),
  error: (...args: any[]) => console.log(`\x1b[31m[ERROR]\x1b[0m`, ...args),
  success: (...args: any[]) => console.log(`\x1b[32m[SUCCESS]\x1b[0m`, ...args),
  loop: (...args: any[]) => console.log(`\x1b[31m[LOOP]\x1b[0m`, ...args),
};

async function startSmartprixScraping(link: string) {
  // Color utility functions using ANSI codes

  let browser;
  let page;
  let backoffMs = 5 * 60 * 1000; // Start at 5 minutes
  const maxFailures = 5;
  const maxBackoffMs = 60 * 60 * 1000; // Max 1 hour

  try {
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();

    // Go to the Smartprix mobiles page
    color.info("Navigating to Smartprix mobiles page...");
    // await page.goto("https://www.smartprix.com/mobiles", {
    //   waitUntil: "domcontentloaded",
    // });

    await page.goto(link, {
      waitUntil: "domcontentloaded",
    });

    // Wait for initial load-more button to appear
    const pageContent = await page.content();
    console.log("\x1b[35m[PAGE CONTENT]\x1b[0m", pageContent);

    color.info("Waiting for Load More button to appear...");
    await page.waitForSelector(".sm-load-more", { timeout: 20000 });

    // Print the content of the page

    let loadMoreClickable = true;
    while (loadMoreClickable && MODE === "RUNNING") {
      loopCount++;
      color.loop(loopCount); // Print the loop number in red
      color.info("Scrolling to Load More button...");
      await page.$eval(".sm-load-more", (el) => el.scrollIntoView());

      // Try to click the load more button
      try {
        color.info("Clicking Load More button...");
        await page.click(".sm-load-more", { timeout: 5000 });
      } catch (err) {
        color.warn("Load More button not clickable. Probably no more pages.");
        loadMoreClickable = false;
        break;
      }

      // Wait for API response indicating new data loaded
      let apiLoaded = false;
      try {
        await page.waitForResponse(
          (response) =>
            response.url().includes("/ui/api/page-info") &&
            response.status() === 200,
          { timeout: 10000 }
        );
        apiLoaded = true;
      } catch (err) {
        color.warn("Smartprix API did not respond in time.");
      }

      // Scroll again to bring Load More into view
      color.info("Centering Load More button in viewport.");
      await page.$eval(".sm-load-more", (el) =>
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      );

      // Extract product data
      let products: { link: string; title: string }[] = [];
      try {
        products = await page.$$eval(
          ".sm-products .sm-product",
          (nodes) =>
            nodes
              .map((product) => {
                const anchor = product.querySelector("a.name");
                if (!anchor) return null;
                const h2 = anchor.querySelector("h2");
                return anchor && h2
                  ? {
                      link: (anchor as HTMLAnchorElement).href,
                      title: h2.textContent?.trim() || "",
                    }
                  : null;
              })
              .filter(Boolean) as { link: string; title: string }[]
        );
      } catch (_) {
        color.error("Extraction error: DOM parsing failed.");
      }

      // Handle failures: products missing or API not loaded
      if (!apiLoaded || products.length === 0) {
        failureCount++;
        color.warn(
          `Extracted 0 products or API error. Failure #${failureCount} (apiLoaded=${apiLoaded}, products=${products.length})`
        );

        if (failureCount >= maxFailures) {
          color.error(
            `Reached ${maxFailures} consecutive failures. Backing off for ${Math.round(
              backoffMs / 60000
            )} minutes...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
          if (backoffMs === maxBackoffMs) {
            color.error(
              "Maximum backoff reached (1h). Stopping scraper completely."
            );
            MODE = "STOPPED";
            break;
          }
        } else {
          // Short retry
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        continue;
      } else {
        if (failureCount > 0) {
          color.success(
            `Scraper successfully recovered after ${failureCount} failures!`
          );
        }
        failureCount = 0;
        backoffMs = 5 * 60 * 1000; // Reset to 5min after success
      }

      color.success(`Extracted ${products.length} products, writing to DB...`);

      try {
        // Must be bulk operation: use bulkWrite to insert/update many documents in a single operation
        const bulkOps = products.map((p) => ({
          updateOne: {
            filter: { link: p.link },
            update: {
              $set: {
                brand: "Samsung", // update if exists
              },
              $setOnInsert: {
                link: p.link,
                title: p.title,
                success: true, // only on new doc
              },
            },
            upsert: true,
          },
        }));

        if (bulkOps.length) {
          await smartPrixResponse.bulkWrite(bulkOps, { ordered: false });
        }

        color.success(`Saved ${products.length} products to DB.`);
      } catch (err: any) {
        color.error(`DB error: ${err && err.message ? err.message : err}`);
        failureCount++;
        if (failureCount >= maxFailures) {
          color.error(
            `DB failures reached limit (${maxFailures}). Backing off for ${Math.round(
              backoffMs / 60000
            )} minutes...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
          if (backoffMs === maxBackoffMs) {
            color.error(
              "Maximum backoff reached (1h). Stopping scraper completely."
            );
            MODE = "STOPPED";
            break;
          }
        }
        continue;
      }

      const waitTime = 10000 + Math.random() * 10000;
      color.info(
        `Human wait time before next load: ${Math.round(waitTime / 1000)}s`
      );
      await page.waitForTimeout(waitTime);

      // Check if Load More still available
      loadMoreClickable = await page
        .$eval(
          ".sm-load-more",
          (el: HTMLElement) =>
            !el.hasAttribute("disabled") && el.offsetParent !== null
        )
        .catch(() => false);

      if (!loadMoreClickable) {
        color.success("No more Load More button. Done!");
      }
    }
  } catch (err: any) {
    color.error(`Fatal error: ${err && err.message ? err.message : err}`);
    MODE = "STOPPED";
  } finally {
    if (browser) {
      // await browser.close().catch(() => {});
      color.info("Browser closed.");
    }
    color.info("Scraping session finished.");
  }
}

/**
 * Fetches all Samsung links missing HTML and processes them in parallel batches ("batchCount" at a time).
 * Use: await fetchAndStoreHtmlForLinks(3) // Processes 3 in parallel.
 * Color-coded console logs are tagged with the batch number (for visual distinction).
 */
// async function fetchAndStoreHtmlForLinks(batchCount: number = 3) {
//   let browser;
//   try {
//     // Fetch all documents with a 'link' field, that don't have 'html' stored yet.
//     const links = await smartPrixResponse
//       .find({
//         link: { $exists: true },
//         html: { $exists: false },
//         brand: "Samsung",
//       })
//       .lean();

//     if (!Array.isArray(links) || links.length === 0) {
//       color.warn(
//         "No links found in smartPrixResponse collection without fetched HTML."
//       );
//       return;
//     }

//     browser = await chromium.launch({ headless: false });
//     const context = await browser.newContext();
//     await context.newPage();

//     const totalLinks = links.length;
//     let processed = 0;

//     // Helper: Processes a single link, with color logs tagged for batch
//     async function processLink(obj: any, tag: string) {
//       const link = obj.link;
//       if (!link) {
//         color.warn(`[${tag}] Missing 'link' property in document:`, obj);
//         return;
//       }
//       let page;
//       try {
//         color.info(`[${tag}] Navigating: ${link}`);
//         page = await context.newPage();
//         await page.goto(link, {
//           waitUntil: "domcontentloaded",
//           timeout: 45000,
//         });
//         await page.waitForSelector(".sm-fullspecs-grp", {
//           timeout: 15000,
//         });
//         const html = await page.content();
//         await smartPrixResponse.updateOne({ _id: obj._id }, { $set: { html } });
//         color.success(`[${tag}] Stored HTML for ${link} in the database.`);
//       } catch (err: any) {
//         color.error(
//           `[${tag}] Error fetching/storing for ${link}: ${err?.message || err}`
//         );
//       } finally {
//         if (page) {
//           await page.close().catch(() => {});
//         }
//       }
//       // Random delay between 2 and 5 seconds
//       const delay = 2000 + Math.random() * 2000;
//       color.info(`[${tag}] Waiting ${Math.round(delay / 1000)} seconds before next fetch...`);
//       await new Promise((resolve) => setTimeout(resolve, delay));
//     }

//     // Batching logic
//     for (let i = 0; i < totalLinks; i += batchCount) {
//       const batch = links.slice(i, i + batchCount);
//       processed += batch.length;
//       const remaining = totalLinks - processed;
//       // Each batch gets a sub-tag: "B1", "B2", etc.
//       const batchTag = `Batch${Math.floor(i / batchCount) + 1}`;
//       color.loop(
//         `[${batchTag}] Processing ${processed - batch.length + 1}-${
//           processed
//         } of ${totalLinks}. Remaining: ${remaining}.`
//       );
//       // sequentially tag: Batch1.1, Batch1.2, ... or so
//       await Promise.all(
//         batch.map((obj, idx) => processLink(obj, `${batchTag}.${idx + 1}`))
//       );
//       // Optionally: Insert a pause between batches for safety
//       if (i + batchCount < totalLinks) {
//         color.info(
//           `[${batchTag}] Batch complete. Waiting 2s before next batch...`
//         );
//         await new Promise((resolve) => setTimeout(resolve, 2000));
//       }
//     }
//   } catch (err: any) {
//     color.error(
//       `Fatal error in fetchAndStoreHtmlForLinks: ${err.message || err}`
//     );
//   } finally {
//     if (browser) {
//       // await browser.close().catch(() => {});
//     }
//   }
// }

type SmartPrixDoc = {
  _id: unknown;
  link: string;
};

type Options = {
  contextsCount?: number;
  minDelay?: number;
  maxDelay?: number;
};

async function fetchAndStoreHtmlSmartprix({
  contextsCount = 3,
  minDelay = 2500,
  maxDelay = 5000,
}: Options): Promise<void> {
  let browser: Browser | undefined;

  try {
    const links = await smartPrixResponse
      .find({
        link: { $exists: true },
        html: { $exists: false },
        brand: "Samsung",
      })
      .lean();

    if (links.length === 0) {
      color.warn("Nothing to fetch. Database already bored.");
      return;
    }

    color.info(
      `Preparing to fetch HTML for ${links.length} links using ${contextsCount} parallel contexts.`
    );

    browser = await chromium.launch({ headless: false });

    const contexts: BrowserContext[] = await Promise.all(
      Array.from({ length: contextsCount }).map(async (_, idx) => {
        const ctx = await browser!.newContext({
          viewport: { width: 1366, height: 768 },
        });

        await ctx.route("**/*", (route) => {
          const type = route.request().resourceType();
          if (type === "image" || type === "font" || type === "media") {
            route.abort();
          } else {
            route.continue();
          }
        });

        color.info(`BrowserContext CTX${idx + 1} initialized.`);
        return ctx;
      })
    );

    // Split work into buckets, one for each context
    const buckets: (typeof links)[] = Array.from(
      { length: contextsCount },
      () => []
    );

    links.forEach((doc, i) => {
      buckets[i % contextsCount].push(doc);
    });

    let overallProcessed = 0;
    const total = links.length;

    async function worker(
      ctx: BrowserContext,
      jobs: typeof links,
      tag: string
    ): Promise<void> {
      color.loop(`[${tag}] Starting batch: ${jobs.length} links assigned.`);
      const page: Page = await ctx.newPage();

      for (let j = 0; j < jobs.length; ++j) {
        const obj = jobs[j];
        const jobId = `${tag}#${j + 1}/${jobs.length}`;
        color.info(
          `[${jobId}] [{${overallProcessed + 1}/${total}}] Visiting: ${
            obj.link
          }`
        );

        try {
          color.info(`[${jobId}] Navigating to link...`);
          await page.goto(obj.link, {
            waitUntil: "domcontentloaded",
            timeout: 45_000,
          });
          color.info(`[${jobId}] Waiting for '.sm-fullspecs-grp'...`);
          await page.waitForSelector(".sm-fullspecs-grp", {
            timeout: 15_000,
          });

          color.info(`[${jobId}] Extracting HTML...`);
          const html: string = await page.content();

          color.info(`[${jobId}] Storing HTML to DB...`);
          await smartPrixResponse.updateOne(
            { _id: obj._id },
            { $set: { html } }
          );
          color.success(`[${jobId}] Success: HTML stored.`);
        } catch (err: any) {
          color.warn(
            `[${jobId}] Failed: ${obj.link}. Reason: ${err?.message || err}`
          );
          await page.waitForTimeout(10_000);
        }

        overallProcessed++;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        color.info(
          `[${jobId}] [${overallProcessed}/${total}] Waiting ${Math.round(
            delay
          )}ms before next request...`
        );
        await page.waitForTimeout(delay);
      }
      color.loop(`[${tag}] Batch complete!`);
      await page.close();
    }

    await Promise.all(
      buckets.map((jobs, i) => worker(contexts[i], jobs, `CTX${i + 1}`))
    );

    color.success(
      `All batches complete. Processed ${overallProcessed} / ${total} links.`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    color.error(`Fatal scraper error: ${msg}`);
  } finally {
    // browser?.close(); // optional
  }
}

dotenv.config();

const LIST_API = "https://www.smartprix.com/ui/api/page-info";
// const PAGE_SIZE = 20;
const MAX_FAILURES = 20;

// const Ea = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

// function Pa(e: any) {
//   if (!e) return "";
//   const t = JSON.stringify(e);
//   let n = "1";
//   for (let s = 0; s < t.length; s++) {
//     let c = t.charCodeAt(s);
//     if (c > 127) n += t[s];
//     else {
//       c %= 95;
//       n += c < 64 ? Ea[c] : "." + Ea[63 & c];
//     }
//   }
//   return n;
// }

const humanDelay = () =>
  new Promise((r) => setTimeout(r, 5000 + Math.random() * 5000));

// const x = {
//   // ":authority": "www.smartprix.com",
//   // ":method": "GET",
//   // ":path":
//   //   "/ui/api/page-info?k=1SYMJDYwYlEG3AD6KYiY52L2YwSY27L6JYwomUiYJ676JJ6JYwYYiYLYwntsrrspommvmniYKLYwntsrrspnuttunU",
//   // ":scheme": "https",
//   accept: "*/*",
//   "accept-encoding": "gzip, deflate, br, zstd",
//   "accept-language": "en-US,en;q=0.9",
//   cookie:
//     "sm_utm=google%7Corganic%7Cnone%7Cnot_available%7Cnone; id=17m5niv6erbu95y0; smcv=1; sid=13v7fj23hcht1m7s",
//   priority: "u=1, i",
//   referer: "https://www.smartprix.com/mobiles",
//   "sec-ch-ua":
//     '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
//   "sec-ch-ua-mobile": "?0",
//   "sec-ch-ua-platform": '"Windows"',
//   "sec-fetch-dest": "empty",
//   "sec-fetch-mode": "cors",
//   "sec-fetch-site": "same-origin",
//   "user-agent":
//     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
//   "x-requested-with": "fetch",
//   "x-sm-fe": "sm/2.0/3.4.11/1536/1.3/desktop/web//main//",
//   "x-ui-cid": "104",
// };

// runtime-only scraper flags
// let running = false;
// let currentAfter = 0;
// let SESSION_START = Date.now();
// let reqCount = 0;
// let nextRotation = 10 + Math.floor(Math.random() * 11);

// function maybeRotateSession() {
//   reqCount++;
//   if (reqCount >= nextRotation) {
//     SESSION_START = Date.now();
//     reqCount = 0;
//     nextRotation = 10 + Math.floor(Math.random() * 11);
//     console.log("session rotated:", SESSION_START);
//   }
// }

// async function fetchPage(after: number) {
//   // maybeRotateSession();
//   // const payload = {
//   //   url: "/mobiles",
//   //   data: { after },
//   //   referrer: "https://www.smartprix.com/",
//   //   t: Date.now(),
//   //   st: SESSION_START,
//   // };
//   const token = Pa(payload);
//   const url = `${LIST_API}?k=${encodeURIComponent(token)}`;
//   console.log("URL", url);
//   const res = await fetch(url, { method: "GET", headers: x });
//   const data = await res.text();
//   // console.log(JSON.stringify(data, null, 2));
//   console.log(data);
//   if (!res.ok) throw new Error(`HTTP ${res.status}`);
//   return res.json();
// }

// async function scraperLoop() {
//   console.log("scraper loop started");

//   let failureCount = 0;

//   while (running) {
//     try {
//       console.log("fetching after =", currentAfter);
//       const data = await fetchPage(currentAfter);

//       await smartPrixResponse.create({
//         after: currentAfter,
//         raw: data,
//         success: true,
//       });

//       failureCount = 0;

//       const sr = data?.item?.searchResults;

//       const hasNext = sr.pageInfo?.hasNextPage === true;

//       if (!hasNext) {
//         console.log("no next page → stop");
//         running = false;
//         break;
//       }

//       currentAfter += PAGE_SIZE;

//       await humanDelay();
//     } catch (err: any) {
//       failureCount++;
//       console.error("fetch error:", err.message);

//       await smartPrixResponse.create({
//         after: currentAfter,
//         raw: { error: err.message },
//         success: false,
//         error: err.message,
//       });

//       if (failureCount >= MAX_FAILURES) {
//         console.error("20 failures reached → stopping");
//         running = false;
//         break;
//       }

//       await new Promise((r) => setTimeout(r, 5000 + Math.random() * 10000));
//     }
//   }

//   console.log("scraper loop finished");
// }

// express server
const app = express();
app.use(express.json());

// === ADD: Playwright cookies/cid endpoint and logic ===
// async function collectCookiesAndCid() {
//   const browser = await chromium.launch({ headless: true });
//   const context = await browser.newContext();
//   const page = await context.newPage();
//   await page.goto("https://www.smartprix.com/mobiles", {
//     waitUntil: "networkidle",
//   });

//   // Wait for key content, adjust selector as needed
//   await page.waitForSelector(".sm-product");

//   // All cookies as header string
//   const cookies = await context.cookies();
//   const cookiesHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

//   await browser.close();
//   return { cookiesHeader };
// }

// app.get("/collect-cookies", async (req, res) => {
//   try {
//     // const { cookiesHeader, cid } = await collectCookiesAndCid();
//     res.json({ ok: true, cookies: cookiesHeader, cid });
//   } catch (err: any) {
//     res.status(500).json({ ok: false, error: err.message });
//   }
// });
// === END ADD ===
// START
app.get("/start", async (req, res) => {
  // if (running)
  //   return res.status(400).json({ ok: false, msg: "already running" });
  // currentAfter = 0;
  // running = true;
  // scraperLoop().catch((err) => console.error("loop crash:", err));
  failureCount = 0;
  startSmartprixScraping("https://www.smartprix.com/mobiles/samsung-brand");
  // fetchAndStoreHtmlSmartprix({ contextsCount: 3, maxDelay: 4, minDelay: 1 });
  MODE = "RUNNING";
  res.json({ ok: true, msg: "started" });
});

// STOP
app.post("/stop", (req, res) => {
  // if (!running) return res.status(400).json({ ok: false, msg: "not running" });
  // running = false;
  MODE = "STOPPED";
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
    MODE,
    total,
    loopCount,
    success,
    failed,
    failureCount,
    lastAfter: last?.after ?? null,
    lastStatus: last?.success === false ? "error" : "ok",
    lastError: last?.error ?? null,
  });
});

async function extractAndSaveSmartprixParsedSpecs() {
  // Get all docs with html not null/missing, and where parseHtmlSpec is missing
  const cursor = smartPrixResponse
    .find({
      brand: "Samsung",
      "normalizedSpecs.error": { $exists: true },
      $or: [
        { "parseHtmlSpec.meta.lifecycle": "considerable" },
        { "parseHtmlSpec.meta.lifecycle": "unknown" },
        // { "parseHtmlSpec.meta.lifecycle": "outdated" },
      ],
    })
    .cursor();
  let counter = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      // Log which document is being processed
      color.info(
        `Processing doc: _id=${doc._id} model=${doc.title || "?"} link=${
          doc.link || "?"
        }`
      );

      // "html" can be quite large
      const html = doc.html;
      const brand = doc.brand || "Samsung";
      if (!html || typeof html !== "string") {
        color.warn(
          `Doc ID ${doc._id}: Missing or invalid HTML, cannot parse specs.`
        );
        await smartPrixResponse.updateOne(
          { _id: doc._id },
          {
            $set: { parseHtmlSpec: { error: "Missing or invalid HTML" } },
          }
        );
        continue;
      }

      const parsed = parseSmartprixPhoneSpecs(html, brand);

      await smartPrixResponse.updateOne(
        { _id: doc._id },
        {
          $set: { parseHtmlSpec: parsed },
        }
      );
      counter++;
    } catch (err: any) {
      // Optionally, log or track errors per doc
      color.error("Spec parse error for doc id", doc._id, err?.message || err);
      await smartPrixResponse.updateOne(
        { _id: doc._id },
        {
          $set: { parseHtmlSpec: { error: err?.message || String(err) } },
        }
      );
    }
  }
  return counter;
}

async function normalizeSpecsAndSave() {
  // Only consider docs where "parseHtmlSpec" exists
  const cursor = smartPrixResponse
    .find({
      brand: "Samsung",
      "normalizedSpecs.error": { $exists: true },
      $or: [
        { "parseHtmlSpec.meta.lifecycle": "considerable" },
        { "parseHtmlSpec.meta.lifecycle": "unknown" },
        { "parseHtmlSpec.meta.lifecycle": "outdated" },
      ],
    })
    .cursor();
  let counter = 0;
  let shouldBreak = false;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    if (shouldBreak) {
      break;
    }
    shouldBreak = true;
    try {
      // Log which document is being processed
      color.info(
        `Processing doc: _id=${doc._id} model=${doc.title || "?"} link=${
          doc.link || "?"
        }`
      );

      // Check for already present parseHtmlSpec in db
      if (
        !doc.parseHtmlSpec ||
        typeof doc.parseHtmlSpec !== "object" ||
        !doc.parseHtmlSpec.meta
      ) {
        color.warn(
          `Doc ID ${doc._id}: No valid parseHtmlSpec present, skipping.`
        );
        continue;
      }

      // Normalize parseHtmlSpec (from existing)
      const normalized = await normalizeSpecs(doc.parseHtmlSpec);

      await smartPrixResponse.updateOne(
        { _id: doc._id },
        {
          $set: { normalizedSpecs: normalized },
        }
      );
      counter++;
    } catch (err: any) {
      // Optionally, log or track errors per doc
      color.error("Spec normalization error for doc id", doc._id, err);
      await smartPrixResponse.updateOne(
        { _id: doc._id },
        {
          $set: {
            normalizedSpecs: { error: err?.message || String(err) },
          },
        }
      );
    }
  }
  return counter;
}

// Example route handler to trigger this operation manually:
app.post("/extract-parsed-specs", async (req, res) => {
  // const count = await normalizeSpecsAndSave();
  const count = await extractAndSaveSmartprixParsedSpecs();
  res.json({ ok: true, processed: count });
});

// API endpoint: GET /api/smartprix-specs

// GET /api/smartprix-specs?brand=Samsung&lifecycle=considerable
app.get("/api/smartprix-specs", async (req, res) => {
  try {
    const { brand, lifecycle } = req.query;

    // Build query object for MongoDB
    const dbQuery: any = {
      "parseHtmlSpec.meta": { $exists: true },
    };
    if (brand) {
      dbQuery.brand = brand;
    }
    if (lifecycle) {
      dbQuery["parseHtmlSpec.meta.lifecycle"] = lifecycle;
    }

    // Fetch matching entries
    const docs = await smartPrixResponse.find(dbQuery).lean();

    // Map/format for response
    const results = docs.map((doc: any) => {
      const meta = doc.parseHtmlSpec?.meta || {};
      return {
        ...doc.parseHtmlSpec.specs.technical,
        // meta,
        // link: doc.link,
        // title: doc.title || meta.model || "",
      };
    });

    res.json({ ok: true, data: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.get("/api/flipkart-search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    if (!query || typeof query !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "Missing path parameter 'product'" });
    }

    const result = await productSearch(query, "flipkart.com", 3);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.get("/exe", async (req, res) => {
  const productsWithDetails = await populateProductDetails();
  const results = await sortProductList(productsWithDetails.enrichedList);

  return res.json(results);
});

export default app;
