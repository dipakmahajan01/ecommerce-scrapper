// src/scraper.ts
import puppeteer from "puppeteer";

export interface Product {
  title: string | null;
  price: string | null;
  description: string | null;
  link: string | null;
  image: string | null;
  rating: string | null;
}

/**
 * Extracts the base model name from product title
 * Removes color, RAM, storage, and other variants to get just the model name
 * Works generically for all mobile brands (Apple, Samsung, OnePlus, etc.)
 */
function extractBaseModel(title: string | null): string {
  if (!title) return "";

  let baseModel = title
    // Remove everything in parentheses (color, storage variants like "White Titanium, 512 GB")
    .replace(/\([^)]*\)/g, "")
    // Remove storage/RAM patterns (256 GB, 512 GB, 1 TB, 8GB RAM, 128GB ROM, etc.)
    .replace(/\b\d+\s*(?:GB|TB|MB|gb|tb|mb)\s*(?:ROM|RAM|rom|ram)?\b/gi, "")
    // Remove standalone storage numbers with units (256GB, 512GB, 1TB, etc.)
    .replace(/\b\d+\s*(?:GB|TB|gb|tb)\b/gi, "")
    // Remove common color words that might appear outside parentheses
    .replace(
      /\b(?:white|black|blue|red|green|yellow|pink|purple|orange|silver|gold|titanium|graphite|space|gray|grey)\b/gi,
      ""
    )
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return baseModel;
}

/**
 * Removes duplicate products based on model name only
 * Ignores color and RAM/storage variations
 * Keeps the first occurrence of each unique model
 * Generic solution that works for all mobile brands
 */
function removeDuplicateModels(data: Product[]): Product[] {
  const map = new Map<string, Product>();

  data.forEach((item) => {
    if (!item.title) return;

    // Get the base model name (without color, RAM, storage)
    const baseModel = extractBaseModel(item.title);

    // Only use base model name as the key (ignore color and RAM)
    // This ensures we get only one entry per model regardless of color/RAM variants
    if (baseModel && !map.has(baseModel)) {
      map.set(baseModel, item);
    }
  });

  return Array.from(map.values());
}

/**
 * Scrapes products from a single page
 */
async function scrapePage(page: any): Promise<Product[]> {
  const pageResults: Product[] = [];

  // Wait for product cards to be visible
  try {
    await page.waitForSelector("div[data-id]", { timeout: 15000 });
    console.log(`[Flipkart Scraper] Product cards found`);
  } catch (e) {
    console.log(
      `[Flipkart Scraper] Product cards selector not found, checking page content...`
    );
    const pageTitle = await page.title();
    console.log(`[Flipkart Scraper] Page title: ${pageTitle}`);
  }

  // Get all product cards using the correct selector
  const productCards = await page
    .$$eval("div[data-id]", (cards: Element[]) => {
      return cards.map((card: Element) => {
        // Title - using the actual class name from HTML
        const titleElem = card.querySelector("div.RG5Slk");
        const title = titleElem?.textContent?.trim() || null;

        // Link - using the actual class name from HTML
        const linkElem = card.querySelector("a.k7wcnx") as HTMLAnchorElement;
        const relativeHref = linkElem?.getAttribute("href");
        const link = relativeHref
          ? relativeHref.startsWith("http")
            ? relativeHref
            : "https://www.flipkart.com" + relativeHref
          : null;

        // Image - using the actual class name from HTML
        const imgElem = card.querySelector("img.UCc1lI") as HTMLImageElement;
        const image =
          imgElem?.getAttribute("src") ||
          imgElem?.getAttribute("data-src") ||
          null;

        // Price - using the actual class name from HTML
        const priceElem = card.querySelector("div.hZ3P6w.DeU9vF");
        const price = priceElem?.textContent?.trim() || null;

        // Rating - using the actual class name from HTML
        const ratingElem = card.querySelector("div.MKiFS6");
        let rating = ratingElem?.textContent?.trim() || null;
        // Extract just the rating number (e.g., "4.6" from "4.6<img...")
        if (rating) {
          const ratingMatch = rating.match(/^(\d+\.?\d*)/);
          rating = ratingMatch ? ratingMatch[1] : null;
        }

        // Description/Details - using the actual class name from HTML
        const detailElems = card.querySelectorAll("ul.HwRTzP li.DTBslk");
        const details: string[] = [];
        detailElems.forEach((li: Element) => {
          const text = li.textContent?.trim();
          if (text) details.push(text);
        });
        const description = details.length > 0 ? details.join(" | ") : null;

        return { title, price, description, link, image, rating };
      });
    })
    .catch((err: Error) => {
      console.log(
        `[Flipkart Scraper] Error extracting products: ${err.message}`
      );
      return [];
    });

  console.log(
    `[Flipkart Scraper] Found ${productCards.length} product cards on this page`
  );

  // Filter out products with no data and add to results
  productCards.forEach((product: any) => {
    // Only add if we have at least a title or link
    if (product.title || product.link) {
      pageResults.push({
        title: product.title,
        price: product.price,
        description: product.description,
        link: product.link,
        image: product.image,
        rating: product.rating,
      });
    }
  });

  return pageResults;
}

export async function scrapeFlipkartSearch(
  url: string,
  retryCount = 0,
  maxPages = 4
): Promise<Product[]> {
  const results: Product[] = [];
  const MAX_RETRIES = 2;
  let browser: any = null;
  let page: any = null;

  try {
    console.log(
      `[Flipkart Scraper] Starting fresh browser instance for: ${url}`
    );
    console.log(`[Flipkart Scraper] Will scrape ${maxPages} pages`);

    // Launch a fresh browser instance for each request
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
    });

    // Create a new page
    page = await browser.newPage();

    // Set a realistic user agent and headers
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    // Set viewport to a realistic size
    await page.setViewport({ width: 1920, height: 1080 });

    // Clear all cookies and cache before navigating
    try {
      const client = await page.target().createCDPSession();
      await client.send("Network.clearBrowserCookies");
      await client.send("Network.clearBrowserCache");
    } catch (e) {
      console.log(
        `[Flipkart Scraper] Could not clear cookies/cache before navigation: ${e}`
      );
    }

    // Navigate to the page with a small random delay to avoid detection
    const delay = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise((resolve) => setTimeout(resolve, delay));

    console.log(`[Flipkart Scraper] Navigating to page 1: ${url}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Clear local storage and session storage after navigation (when page is loaded)
    try {
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // Ignore if localStorage is not accessible
        }
      });
    } catch (e) {
      // Ignore if we can't clear storage
      console.log(`[Flipkart Scraper] Could not clear storage: ${e}`);
    }

    // Wait a bit for JavaScript to render
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Scrape page 1
    const page1Results = await scrapePage(page);
    results.push(...page1Results);
    console.log(
      `[Flipkart Scraper] Page 1: Found ${page1Results.length} products`
    );

    // Scrape additional pages (2, 3, 4, etc.)
    for (let pageNum = 2; pageNum <= maxPages; pageNum++) {
      try {
        console.log(
          `[Flipkart Scraper] Attempting to navigate to page ${pageNum}...`
        );

        // Try to find and click the page number button
        const pageButtonSelector = `nav.iu0OAI a.i2eZXn[href*="page=${pageNum}"]`;

        // Wait for pagination to be visible
        try {
          await page.waitForSelector("nav.iu0OAI", { timeout: 5000 });
        } catch (e) {
          console.log(
            `[Flipkart Scraper] Pagination not found, stopping at page ${
              pageNum - 1
            }`
          );
          break;
        }

        // Check if the page button exists
        const pageButton = await page.$(pageButtonSelector);
        if (!pageButton) {
          console.log(
            `[Flipkart Scraper] Page ${pageNum} button not found, stopping pagination`
          );
          break;
        }

        // Click the page button
        await pageButton.click();
        console.log(`[Flipkart Scraper] Clicked page ${pageNum} button`);

        // Wait for page to load and products to appear
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Wait for product cards to appear on new page
        try {
          await page.waitForSelector("div[data-id]", { timeout: 10000 });
        } catch (e) {
          console.log(
            `[Flipkart Scraper] Products not loaded on page ${pageNum}, skipping...`
          );
          continue;
        }

        // Scrape products from this page
        const pageResults = await scrapePage(page);
        results.push(...pageResults);
        console.log(
          `[Flipkart Scraper] Page ${pageNum}: Found ${pageResults.length} products`
        );

        // Small delay between pages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(
          `[Flipkart Scraper] Error scraping page ${pageNum}: ${error.message}`
        );
        // Continue to next page even if one fails
        continue;
      }
    }

    // Wait for product cards to be visible
    try {
      await page.waitForSelector("div[data-id]", { timeout: 15000 });
      console.log(`[Flipkart Scraper] Product cards found`);
    } catch (e) {
      console.log(
        `[Flipkart Scraper] Product cards selector not found, checking page content...`
      );
      // Log page title to debug
      const pageTitle = await page.title();
      console.log(`[Flipkart Scraper] Page title: ${pageTitle}`);

      // Check if we're blocked or redirected
      const currentUrl = page.url();
      if (currentUrl !== url && !currentUrl.includes("search")) {
        console.log(
          `[Flipkart Scraper] Possible redirect detected: ${currentUrl}`
        );
      }
    }

    // Get all product cards using the correct selector
    const productCards = await page
      .$$eval("div[data-id]", (cards: Element[]) => {
        return cards.map((card: Element) => {
          // Title - using the actual class name from HTML
          const titleElem = card.querySelector("div.RG5Slk");
          const title = titleElem?.textContent?.trim() || null;

          // Link - using the actual class name from HTML
          const linkElem = card.querySelector("a.k7wcnx") as HTMLAnchorElement;
          const relativeHref = linkElem?.getAttribute("href");
          const link = relativeHref
            ? relativeHref.startsWith("http")
              ? relativeHref
              : "https://www.flipkart.com" + relativeHref
            : null;

          // Image - using the actual class name from HTML
          const imgElem = card.querySelector("img.UCc1lI") as HTMLImageElement;
          const image =
            imgElem?.getAttribute("src") ||
            imgElem?.getAttribute("data-src") ||
            null;

          // Price - using the actual class name from HTML
          const priceElem = card.querySelector("div.hZ3P6w.DeU9vF");
          const price = priceElem?.textContent?.trim() || null;

          // Rating - using the actual class name from HTML
          const ratingElem = card.querySelector("div.MKiFS6");
          let rating = ratingElem?.textContent?.trim() || null;
          // Extract just the rating number (e.g., "4.6" from "4.6<img...")
          if (rating) {
            const ratingMatch = rating.match(/^(\d+\.?\d*)/);
            rating = ratingMatch ? ratingMatch[1] : null;
          }

          // Description/Details - using the actual class name from HTML
          const detailElems = card.querySelectorAll("ul.HwRTzP li.DTBslk");
          const details: string[] = [];
          detailElems.forEach((li: Element) => {
            const text = li.textContent?.trim();
            if (text) details.push(text);
          });
          const description = details.length > 0 ? details.join(" | ") : null;

          return { title, price, description, link, image, rating };
        });
      })
      .catch((err: Error) => {
        console.log(
          `[Flipkart Scraper] Error extracting products: ${err.message}`
        );
        return [];
      });

    console.log(
      `[Flipkart Scraper] Found ${productCards.length} product cards`
    );

    // Filter out products with no data and add to results
    productCards.forEach((product: any) => {
      // Only add if we have at least a title or link
      if (product.title || product.link) {
        results.push({
          title: product.title,
          price: product.price,
          description: product.description,
          link: product.link,
          image: product.image,
          rating: product.rating,
        });
      }
    });

    // If no products found on any page, try alternative approach
    if (results.length === 0) {
      console.log(
        `[Flipkart Scraper] No products found, trying alternative selectors...`
      );

      // Check if page has any content at all
      const bodyText = await page.$eval(
        "body",
        (el: any) => el.textContent || ""
      );
      const hasContent = bodyText && bodyText.length > 100;
      console.log(
        `[Flipkart Scraper] Page has content: ${hasContent}, body length: ${
          bodyText?.length || 0
        }`
      );

      // Try to find product cards using a different approach
      const cardCount = await page.$$eval(
        "div[data-id]",
        (cards: any[]) => cards.length
      );
      console.log(
        `[Flipkart Scraper] Found ${cardCount} div[data-id] elements`
      );

      if (cardCount > 0) {
        const altProducts = await page.evaluate(() => {
          const products: any[] = [];
          // Try to find product cards using data-id
          const cards = document.querySelectorAll("div[data-id]");

          cards.forEach((card, index) => {
            if (index >= 30) return; // Limit to first 30

            // Title
            const titleElem = card.querySelector("div.RG5Slk");
            const title = titleElem?.textContent?.trim() || null;

            // Link
            const linkElem = card.querySelector(
              "a.k7wcnx"
            ) as HTMLAnchorElement;
            const href = linkElem?.getAttribute("href");
            const linkUrl = href
              ? href.startsWith("http")
                ? href
                : "https://www.flipkart.com" + href
              : null;

            // Image
            const img = card.querySelector("img.UCc1lI") as HTMLImageElement;
            const image =
              img?.getAttribute("src") || img?.getAttribute("data-src") || null;

            // Price
            const priceElem = card.querySelector("div.hZ3P6w.DeU9vF");
            const price = priceElem?.textContent?.trim() || null;

            // Rating
            const ratingElem = card.querySelector("div.MKiFS6");
            let rating = ratingElem?.textContent?.trim() || null;
            if (rating) {
              const ratingMatch = rating.match(/^(\d+\.?\d*)/);
              rating = ratingMatch ? ratingMatch[1] : null;
            }

            // Description
            const detailElems = card.querySelectorAll("ul.HwRTzP li.DTBslk");
            const details: string[] = [];
            detailElems.forEach((li) => {
              const text = li.textContent?.trim();
              if (text) details.push(text);
            });
            const description = details.length > 0 ? details.join(" | ") : null;

            if (title || linkUrl) {
              products.push({
                title,
                price,
                description,
                link: linkUrl,
                image,
                rating,
              });
            }
          });

          return products;
        });

        altProducts.forEach((product: any) => {
          if (product.title || product.link) {
            results.push(product);
          }
        });

        console.log(
          `[Flipkart Scraper] Alternative method found ${altProducts.length} products`
        );
      } else {
        console.log(
          `[Flipkart Scraper] No product cards found. Page might be blocked or structure changed.`
        );
      }
    }
  } catch (error: any) {
    console.error(`[Flipkart Scraper] Error during scraping: ${error.message}`);
    console.error(`[Flipkart Scraper] Stack: ${error.stack}`);
    throw error;
  } finally {
    // Close the page and browser to free resources
    try {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
        console.log(
          `[Flipkart Scraper] Browser instance closed and cleaned up`
        );
      }
    } catch (e) {
      console.log(`[Flipkart Scraper] Cleanup warning: ${e}`);
    }
  }

  console.log(`[Flipkart Scraper] Raw results count: ${results.length}`);
  console.log("results", results);

  // If no results and we haven't exceeded retries, try again
  if (results.length === 0 && retryCount < MAX_RETRIES) {
    console.log(
      `[Flipkart Scraper] No results found, retrying... (attempt ${
        retryCount + 1
      }/${MAX_RETRIES})`
    );
    // Wait a bit before retrying
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return scrapeFlipkartSearch(url, retryCount + 1);
  }

  // Remove duplicate models based on same color and RAM
  const uniqueResults = removeDuplicateModels(results);

  console.log(
    `[Flipkart Scraper] Total products found: ${results.length}, Unique models (by color+RAM): ${uniqueResults.length}`
  );

  return uniqueResults;
}
