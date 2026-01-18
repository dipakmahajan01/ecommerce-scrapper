import { chromium, Browser, BrowserContext, Page } from "playwright";
import { smartPrixResponse } from "../models/smartprix";

const color = {
  info: (...args: any[]) => console.log(`\x1b[36m[INFO]\x1b[0m`, ...args),
  warn: (...args: any[]) => console.log(`\x1b[33m[WARN]\x1b[0m`, ...args),
  error: (...args: any[]) => console.log(`\x1b[31m[ERROR]\x1b[0m`, ...args),
  success: (...args: any[]) => console.log(`\x1b[32m[SUCCESS]\x1b[0m`, ...args),
  loop: (...args: any[]) => console.log(`\x1b[31m[LOOP]\x1b[0m`, ...args),
};

type Options = {
  contextsCount?: number;
  minDelay?: number;
  maxDelay?: number;
};

/**
 * Normalizes price string to number
 * Removes ₹ symbol, commas, and whitespace, then parses as integer
 */
function normalizePrice(priceStr: string): number {
  if (!priceStr || typeof priceStr !== "string") {
    return 0;
  }
  const cleaned = priceStr
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extracts and saves prices for Smartprix products
 * Queries MongoDB for documents with lifecycle "unknown" or "considerable"
 * Visits each link, extracts price using .pg-prd-pricewrap > .price selector
 * Stores both raw extracted price and normalized numeric value
 * Uses parallel browser contexts for faster processing
 */
export async function extractAndSaveSmartprixPrices({
  contextsCount = 3,
  minDelay = 2500,
  maxDelay = 5000,
}: Options = {}): Promise<number> {
  let browser: Browser | undefined;

  try {
    // Query MongoDB for documents with lifecycle "unknown" or "considerable"
    const docs = await smartPrixResponse
      .find({
        "parseHtmlSpec.meta.lifecycle": { $in: ["unknown", "considerable"] },
        link: { $exists: true },
        $or: [{ price: { $exists: false } }, { price: { $eq: 0 } }],
      })
      .lean();

    if (docs.length === 0) {
      color.warn("No documents found matching the query criteria.");
      return 0;
    }

    const total = docs.length;
    color.info(
      `Preparing to extract prices for ${total} links using ${contextsCount} parallel contexts.`
    );

    // Launch browser
    browser = await chromium.launch({ headless: false });

    // Create multiple browser contexts
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
    const buckets: (typeof docs)[] = Array.from(
      { length: contextsCount },
      () => []
    );

    docs.forEach((doc, i) => {
      buckets[i % contextsCount].push(doc);
    });

    let overallProcessed = 0;
    let overallCounter = 0;

    async function worker(
      ctx: BrowserContext,
      jobs: typeof docs,
      tag: string
    ): Promise<void> {
      color.loop(`[${tag}] Starting batch: ${jobs.length} links assigned.`);
      const page: Page = await ctx.newPage();

      for (let j = 0; j < jobs.length; ++j) {
        const obj = jobs[j];
        const jobId = `${tag}#${j + 1}/${jobs.length}`;
        color.info(
          `[${jobId}] [{${overallProcessed + 1}/${total}}] Processing: ${
            obj.title || "?"
          } - ${obj.link}`
        );

        try {
          if (!obj.link || typeof obj.link !== "string") {
            color.warn(`[${jobId}] Missing or invalid link, skipping.`);
            await smartPrixResponse.updateOne(
              { _id: obj._id },
              {
                $set: {
                  extractedPrice: "ERROR - Missing or invalid link",
                },
              }
            );
            overallProcessed++;
            continue;
          }

          color.info(`[${jobId}] Navigating to link...`);
          await page.goto(obj.link, {
            waitUntil: "domcontentloaded",
            timeout: 45_000,
          });

          color.info(
            `[${jobId}] Waiting for price selector '.pg-prd-pricewrap > .price'...`
          );
          await page.waitForSelector(".pg-prd-pricewrap > .price", {
            timeout: 15_000,
          });

          color.info(`[${jobId}] Extracting price...`);
          const extractedPrice = await page.$eval(
            ".pg-prd-pricewrap > .price",
            (el) => el.textContent?.trim() || ""
          );

          if (!extractedPrice) {
            color.warn(`[${jobId}] Price not found on page.`);
            await smartPrixResponse.updateOne(
              { _id: obj._id },
              {
                $set: {
                  extractedPrice: "ERROR - Price not found on page",
                },
              }
            );
            overallProcessed++;
            continue;
          }

          // Normalize price
          const price = normalizePrice(extractedPrice);

          if (price === 0) {
            color.warn(
              `[${jobId}] Could not normalize price from "${extractedPrice}"`
            );
          }

          color.info(`[${jobId}] Storing price data to DB...`);
          await smartPrixResponse.updateOne(
            { _id: obj._id },
            {
              $set: {
                extractedPrice,
                price,
              },
            }
          );

          color.success(
            `[${jobId}] Success: Extracted price "${extractedPrice}" (normalized: ${price})`
          );
          overallCounter++;
        } catch (err: any) {
          const errorMsg = err?.message || String(err);
          color.warn(`[${jobId}] Failed: ${obj.link}. Reason: ${errorMsg}`);
          await smartPrixResponse.updateOne(
            { _id: obj._id },
            {
              $set: {
                extractedPrice: errorMsg,
              },
            }
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
      `All batches complete. Processed ${overallCounter} / ${total} documents successfully.`
    );
    return overallCounter;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    color.error(`Fatal price extraction error: ${msg}`);
    throw err;
  } finally {
    // Browser cleanup is optional (commented out in similar functions)
    // if (browser) {
    //   await browser.close().catch(() => {});
    // }
  }
}
