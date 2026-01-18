import { chromium, Page } from "playwright";
import { writeFile } from "fs/promises";
import { join } from "path";

const color = {
  info: (...args: any[]) => console.log(`\x1b[36m[INFO]\x1b[0m`, ...args),
  warn: (...args: any[]) => console.log(`\x1b[33m[WARN]\x1b[0m`, ...args),
  error: (...args: any[]) => console.log(`\x1b[31m[ERROR]\x1b[0m`, ...args),
  success: (...args: any[]) => console.log(`\x1b[32m[SUCCESS]\x1b[0m`, ...args),
  loop: (...args: any[]) => console.log(`\x1b[31m[LOOP]\x1b[0m`, ...args),
};

interface ProductData {
  link: string;
  price: string | null;
  extractedAt: string;
}

interface TestResults {
  startTime: string;
  endTime: string;
  totalLinks: number;
  totalRequests: number;
  queriesUsed: string[];
  products: ProductData[];
}

const SMARTPHONE_QUERIES = [
  "best smartphone under 80k",
  "smartphone with 256gb store",
  "realme smartphone under 20k",
  "smartphone under 50k",
  "best smartphone under 30k",
  "smartphone with 128gb storage",
  "xiaomi smartphone under 25k",
  "samsung smartphone under 40k",
  "oneplus smartphone under 60k",
  "vivo smartphone under 35k",
  "oppo smartphone under 30k",
  "smartphone with 8gb ram",
  "best smartphone under 15k",
  "smartphone with 5000mah battery",
  "5g smartphone under 20k",
  "smartphone with 64mp camera",
  "best smartphone under 10k",
  "smartphone with amoled display",
  "gaming smartphone under 50k",
  "smartphone with 12gb ram",
  "best smartphone under 25k",
  "smartphone with 128gb under 20k",
  "realme smartphone under 15k",
  "redmi smartphone under 20k",
  "best budget smartphone",
];

function buildAmazonSearchUrl(query: string, page: number = 1): string {
  const baseUrl = "https://www.amazon.in/s?k=";
  // Replace spaces with + and encode other special characters
  const encodedQuery = encodeURIComponent(query).replace(/%20/g, "+");
  if (page > 1) {
    return `${baseUrl}${encodedQuery}&page=${page}`;
  }
  return `${baseUrl}${encodedQuery}`;
}

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `https://www.amazon.in${url}`;
  }
  return `https://www.amazon.in/${url}`;
}

async function extractProductLinks(
  page: Page,
  requestCount: number
): Promise<string[]> {
  try {
    await page.waitForSelector('[role="listitem"].s-result-item', {
      timeout: 15000,
    });
  } catch (err) {
    color.warn(`[Request #${requestCount}] Timeout waiting for results`);
    return [];
  }

  const links = await page.$$eval(
    '[role="listitem"].s-result-item:not(.AdHolder)',
    (items) => {
      const extractedLinks: string[] = [];
      for (const item of items) {
        const anchor = item.querySelector("a.a-link-normal");
        if (anchor) {
          const href = (anchor as HTMLAnchorElement).getAttribute("href");
          if (href) {
            extractedLinks.push(href);
          }
        }
      }
      return extractedLinks;
    }
  );

  return links.map(normalizeUrl);
}

async function extractPrice(
  page: Page,
  requestCount: number
): Promise<string | null> {
  try {
    await page.waitForSelector(".a-price-whole", { timeout: 10000 });
    const price = await page.$eval(
      ".a-price-whole",
      (el) => el.textContent?.trim() || null
    );
    return price;
  } catch (err) {
    color.warn(`[Request #${requestCount}] Price not found`);
    return null;
  }
}

export async function testAmazonBotDetection(): Promise<void> {
  const startTime = new Date().toISOString();
  let totalRequests = 0;
  const productLinks: string[] = [];
  const queriesUsed: string[] = [];
  const TARGET_LINKS = 1000;

  color.info("Starting Amazon bot detection test");
  color.info(`Target: ${TARGET_LINKS} product links`);

  const browser = await chromium.launch({ headless: false });
  // "Warm up" the browser to avoid looking like a brand new visit
  let page = await browser.newPage();
  let pageRequestCount = 0;
  const MAX_REQUESTS_PER_PAGE = 50;

  // Helper function to recreate page and re-setup routes
  async function recreatePage(): Promise<void> {
    await page.close();
    page = await browser.newPage();
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "font" || type === "media") {
        route.abort();
      } else {
        route.continue();
      }
    });
    pageRequestCount = 0;
    color.info(`[Memory] Recreated page to free memory`);
  }

  // Visit some random common sites to generate history/cookies/profile noise
  const warmupSites = [
    "https://www.bing.com/search?q=weather",
    "https://www.reddit.com/",
    "https://news.ycombinator.com/",
    "https://www.wikipedia.org/",
    "https://www.youtube.com/",
  ];
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const site = warmupSites[Math.floor(Math.random() * warmupSites.length)];
    try {
      await page.goto(site, { waitUntil: "domcontentloaded", timeout: 15000 });
      // Scroll a bit, click random spot (simulate browsing)
      await page.mouse.move(
        100 + Math.random() * 800,
        100 + Math.random() * 400
      );
      await page.waitForTimeout(300 + Math.random() * 800);
      await page.evaluate(() =>
        window.scrollBy(0, 150 + Math.floor(Math.random() * 600))
      );
      await page.waitForTimeout(400 + Math.random() * 900);
    } catch (e) {}
  }

  // Then visit amazon.com homepage to look more like a real browsing session
  // try {
  //   await page.goto("https://www.amazon.com/", {
  //     waitUntil: "domcontentloaded",
  //     timeout: 15000,
  //   });
  //   await page.waitForTimeout(1000 + Math.random() * 1200);
  //   // Click search box and type a garbage search (optional)
  //   await page.click("#twotabsearchtextbox").catch(() => {});
  //   await page.keyboard.type("asdf" + Math.floor(Math.random() * 1000));
  //   await page.keyboard.press("Enter");
  //   await page.waitForTimeout(700 + Math.random() * 1500);
  // } catch (e) {}

  // // Optional: go back to homepage, as if user hit 'home' again
  // try {
  //   await page.goto("https://www.amazon.com/", {
  //     waitUntil: "domcontentloaded",
  //     timeout: 15000,
  //   });
  //   await page.waitForTimeout(700 + Math.random() * 1200);
  // } catch (e) {}

  // Setup route handler to block images/fonts/media
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") {
      route.abort();
    } else {
      route.continue();
    }
  });

  // Phase 1: Collect product links
  color.loop("=== Phase 1: Collecting Product Links ===");
  let queryIndex = 0;

  while (
    productLinks.length < TARGET_LINKS &&
    queryIndex < SMARTPHONE_QUERIES.length
  ) {
    const query = SMARTPHONE_QUERIES[queryIndex];
    queriesUsed.push(query);
    color.info(
      `[Query ${queryIndex + 1}/${
        SMARTPHONE_QUERIES.length
      }] Searching: "${query}"`
    );

    let pageNumber = 1;
    let hasMorePages = true;

    while (productLinks.length < TARGET_LINKS && hasMorePages) {
      // Recreate page periodically to prevent memory accumulation
      if (pageRequestCount >= MAX_REQUESTS_PER_PAGE) {
        await recreatePage();
      }

      const url = buildAmazonSearchUrl(query, pageNumber);
      totalRequests++;
      pageRequestCount++;
      color.info(
        `[Request #${totalRequests}] Navigating to page ${pageNumber} of "${query}"`
      );

      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        const links = await extractProductLinks(page, totalRequests);
        productLinks.push(...links);

        color.success(
          `[Request #${totalRequests}] Extracted ${links.length} links (Total: ${productLinks.length}/${TARGET_LINKS})`
        );

        if (links.length === 0) {
          color.warn(
            `[Request #${totalRequests}] No links found on page ${pageNumber}`
          );
          if (pageNumber === 1) {
            hasMorePages = false;
            color.warn(
              `[Request #${totalRequests}] No links on first page, moving to next query`
            );
          } else {
            hasMorePages = false;
            color.info(
              `[Request #${totalRequests}] Reached end of results for this query`
            );
          }
        } else {
          pageNumber++;
          await page.waitForTimeout(400);
        }
      } catch (err: any) {
        color.error(
          `[Request #${totalRequests}] Error: ${err?.message || err}`
        );
        hasMorePages = false;
      }
    }

    if (productLinks.length >= TARGET_LINKS) {
      color.success(`Reached target of ${TARGET_LINKS} links`);
      break;
    }

    queryIndex++;
  }

  const collectedLinks = productLinks.slice(0, TARGET_LINKS);
  color.success(`Collected ${collectedLinks.length} product links`);
  color.loop("=== Phase 2: Extracting Prices ===");

  // Phase 2: Extract prices
  const products: ProductData[] = [];

  for (let i = 0; i < collectedLinks.length; i++) {
    // Recreate page periodically to prevent memory accumulation
    if (pageRequestCount >= MAX_REQUESTS_PER_PAGE) {
      await recreatePage();
    }

    const link = collectedLinks[i];
    totalRequests++;
    pageRequestCount++;
    color.info(
      `[Request #${totalRequests}] Visiting product ${i + 1}/${
        collectedLinks.length
      }`
    );

    try {
      await page.goto(link, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      const price = await extractPrice(page, totalRequests);
      products.push({
        link,
        price,
        extractedAt: new Date().toISOString(),
      });

      if (price) {
        color.success(`[Request #${totalRequests}] Price extracted: ${price}`);
      } else {
        color.warn(`[Request #${totalRequests}] No price found`);
      }
    } catch (err: any) {
      color.error(
        `[Request #${totalRequests}] Error visiting link: ${
          err?.message || err
        }`
      );
      products.push({
        link,
        price: null,
        extractedAt: new Date().toISOString(),
      });
    }

    await page.waitForTimeout(400);
  }

  await browser.close();

  const endTime = new Date().toISOString();
  const results: TestResults = {
    startTime,
    endTime,
    totalLinks: collectedLinks.length,
    totalRequests,
    queriesUsed: [...new Set(queriesUsed)],
    products,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `amazon-bot-test-results-${timestamp}.json`;
  const filepath = join(process.cwd(), filename);

  await writeFile(filepath, JSON.stringify(results, null, 2), "utf-8");

  color.success(`Test completed!`);
  color.info(`Total requests: ${totalRequests}`);
  color.info(`Total links: ${collectedLinks.length}`);
  color.info(`Results saved to: ${filepath}`);
}
