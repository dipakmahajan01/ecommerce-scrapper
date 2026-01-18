import { writeFile } from "fs/promises";
import { join } from "path";
import { chromium, Page } from "playwright";

const color = {
  info: (...args: any[]) => console.log(`\x1b[36m[INFO]\x1b[0m`, ...args),
  warn: (...args: any[]) => console.log(`\x1b[33m[WARN]\x1b[0m`, ...args),
  error: (...args: any[]) => console.log(`\x1b[31m[ERROR]\x1b[0m`, ...args),
  success: (...args: any[]) => console.log(`\x1b[32m[SUCCESS]\x1b[0m`, ...args),
};

interface ApiResponse {
  success: boolean;
  status: number;
  responseTime: number;
  error?: string;
  data?: any;
  url?: string;
}

interface ExtractionResult {
  code: string;
  url: string;
  success: boolean;
  price?: string;
  error?: string;
}

interface TestResults {
  startTime: string;
  endTime: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requests: ApiResponse[];
  extractions: ExtractionResult[];
  totalExtractions: number;
  successfulExtractions: number;
  failedExtractions: number;
}

const API_URL = "https://pricehistory.app/api/search";
const TARGET_REQUESTS = 500;
const MIN_DELAY_MS = 1000; // 1 second minimum
const MAX_DELAY_MS = 3000; // 3 seconds maximum
const MAX_CONSECUTIVE_FAILURES = 20;
const EXTRACTION_TARGET = 500;

const FLIPKART_URLS = [
  "https://www.flipkart.com/oneplus-15-5g-infinite-black-512-gb/p/itm0106a23b51268?pid=MOBHHNF64HKFAZVE&lid=LSTMOBHHNF64HKFAZVESORELA&marketplace=FLIPKART&q=oneplus+15+16gb+512gb&store=tyy%2F4io&srno=s_1_1&otracker=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&otracker1=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&fm=Search&iid=a712ec5d-3c34-4f24-a154-35df91c4778e.MOBHHNF64HKFAZVE.SEARCH&ppt=sp&ppn=sp&ssid=mk2c4kdzuo0000001768488074226&qH=6c6bf0ecb6534a78",
  "https://www.flipkart.com/oneplus-15-5g-sand-storm-512-gb/p/itm0106a23b51268?pid=MOBHHNF23TQCQE63&lid=LSTMOBHHNF23TQCQE634RBCKU&marketplace=FLIPKART&q=oneplus+15+16gb+512gb&store=tyy%2F4io&srno=s_1_2&otracker=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&otracker1=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&fm=Search&iid=a712ec5d-3c34-4f24-a154-35df91c4778e.MOBHHNF23TQCQE63.SEARCH&ppt=sp&ppn=sp&ssid=mk2c4kdzuo0000001768488074226&qH=6c6bf0ecb6534a78",
  "https://www.flipkart.com/oneplus-13-black-eclipse-512-gb/p/itmb4659fd2a037f?pid=MOBHAXYUZ7QPYKCQ&lid=LSTMOBHAXYUZ7QPYKCQ5JNHAE&marketplace=FLIPKART&q=oneplus+15+16gb+512gb&store=tyy%2F4io&srno=s_1_3&otracker=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&otracker1=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&fm=Search&iid=a712ec5d-3c34-4f24-a154-35df91c4778e.MOBHAXYUZ7QPYKCQ.SEARCH&ppt=sp&ppn=sp&ssid=mk2c4kdzuo0000001768488074226&qH=6c6bf0ecb6534a78",
  "https://www.flipkart.com/oneplus-13-arctic-dawn-512-gb/p/itmb4659fd2a037f?pid=MOBH8CHZPMYBYN3D&lid=LSTMOBH8CHZPMYBYN3DZ9NCR9&marketplace=FLIPKART&q=oneplus+15+16gb+512gb&store=tyy%2F4io&srno=s_1_4&otracker=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&otracker1=AS_QueryStore_OrganicAutoSuggest_1_19_na_na_na&fm=Search&iid=a712ec5d-3c34-4f24-a154-35df91c4778e.MOBH8CHZPMYBYN3D.SEARCH&ppt=sp&ppn=sp&ssid=mk2c4kdzuo0000001768488074226&qH=6c6bf0ecb6534a78",
  "https://www.flipkart.com/samsung-galaxy-a35-5g-awesome-iceblue-128-gb/p/itm9684d2fe9201e?pid=MOBGYT2HEYWFCG8Q&lid=LSTMOBGYT2HEYWFCG8QSW6D6Y&marketplace=FLIPKART&q=smartphone+under+30000&store=tyy%2F4io&spotlightTagId=default_BestsellerId_tyy%2F4io&srno=s_1_1&otracker=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&otracker1=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&fm=search-autosuggest&iid=8f6e7df5-fe30-4e97-b0f3-ca9ab2d85837.MOBGYT2HEYWFCG8Q.SEARCH&ppt=sp&ppn=sp&ssid=s03vbbv74w0000001768488721170&qH=f86e97a4fe2b10a6",
  "https://www.flipkart.com/motorola-edge-60-fusion-5g-pantone-mykonos-blue-256-gb/p/itmdbb95e3f12ab6?pid=MOBH9ARFZXNHC7VZ&lid=LSTMOBH9ARFZXNHC7VZJODZOO&marketplace=FLIPKART&q=smartphone+under+30000&store=tyy%2F4io&spotlightTagId=default_BestsellerId_tyy%2F4io&srno=s_1_2&otracker=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&otracker1=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&fm=search-autosuggest&iid=8f6e7df5-fe30-4e97-b0f3-ca9ab2d85837.MOBH9ARFZXNHC7VZ.SEARCH&ppt=sp&ppn=sp&ssid=s03vbbv74w0000001768488721170&qH=f86e97a4fe2b10a6",
  "https://www.flipkart.com/cmf-nothing-phone-2-pro-white-256-gb/p/itm46a119f176627?pid=MOBHAUHAUDZUUQSF&lid=LSTMOBHAUHAUDZUUQSF5CFKOF&marketplace=FLIPKART&q=smartphone+under+30000&store=tyy%2F4io&srno=s_1_3&otracker=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&otracker1=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&fm=search-autosuggest&iid=8f6e7df5-fe30-4e97-b0f3-ca9ab2d85837.MOBHAUHAUDZUUQSF.SEARCH&ppt=sp&ppn=sp&ssid=s03vbbv74w0000001768488721170&qH=f86e97a4fe2b10a6",
  "https://www.flipkart.com/motorola-edge-60-fusion-5g-pantone-slipstream-256-gb/p/itm8553dc1ee56ee?pid=MOBH9ARFZHXSRYMA&lid=LSTMOBH9ARFZHXSRYMAFEL0WA&marketplace=FLIPKART&q=smartphone+under+30000&store=tyy%2F4io&srno=s_1_4&otracker=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&otracker1=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&fm=search-autosuggest&iid=8f6e7df5-fe30-4e97-b0f3-ca9ab2d85837.MOBH9ARFZHXSRYMA.SEARCH&ppt=sp&ppn=sp&ssid=s03vbbv74w0000001768488721170&qH=f86e97a4fe2b10a6",
  "https://www.flipkart.com/vivo-t4-pro-5g-nitro-blue-128-gb/p/itm4da1824b696d9?pid=MOBHF4F9H4PJUZGF&lid=LSTMOBHF4F9H4PJUZGF1DQ7FC&marketplace=FLIPKART&q=smartphone+under+30000&store=tyy%2F4io&srno=s_1_6&otracker=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&otracker1=AS_Query_OrganicAutoSuggest_5_16_na_na_ps&fm=search-autosuggest&iid=8f6e7df5-fe30-4e97-b0f3-ca9ab2d85837.MOBHF4F9H4PJUZGF.SEARCH&ppt=sp&ppn=sp&ssid=s03vbbv74w0000001768488721170&qH=f86e97a4fe2b10a6",
];

const HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  origin: "https://pricehistory.app",
  priority: "u=1, i",
  referer: "https://pricehistory.app/",
  "sec-ch-ua":
    '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
};

async function makeApiCall(
  requestNumber: number,
  url: string
): Promise<ApiResponse> {
  const startTime = Date.now();
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ url }),
    });

    const responseTime = Date.now() - startTime;
    const status = response.status;

    let data: any = null;
    try {
      data = await response.json();
    } catch (e) {
      // Response might not be JSON
    }

    return {
      success: response.ok,
      status,
      responseTime,
      data,
      url,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      status: 0,
      responseTime,
      error: error?.message || String(error),
      url,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay(): number {
  return (
    Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS
  );
}

async function extractPricingFromPage(
  page: Page,
  code: string,
  index: number
): Promise<ExtractionResult> {
  const url = `https://pricehistory.app/p/${code}`;
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector(".ph-pricing-pricing", {
      timeout: 10000,
    });

    const price = await page.$eval(
      ".ph-pricing-pricing",
      (el) => el.textContent?.trim() || ""
    );

    return {
      code,
      url,
      success: true,
      price,
    };
  } catch (error: any) {
    return {
      code,
      url,
      success: false,
      error: error?.message || String(error),
    };
  }
}

export async function testPriceHistoryApi(): Promise<void> {
  const startTime = new Date().toISOString();
  const testStartTime = Date.now();
  const requests: ApiResponse[] = [];
  const successfulCodes: string[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  let totalResponseTime = 0;
  let consecutiveFailures = 0;

  color.info("=== Phase 1: API Calls ===");
  color.info(`Target: ${TARGET_REQUESTS} requests`);
  color.info(
    `Random delay between requests: ${MIN_DELAY_MS}-${MAX_DELAY_MS}ms (expected duration: 10-20 minutes)`
  );
  color.info(
    `Will stop after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`
  );

  for (let i = 1; i <= TARGET_REQUESTS; i++) {
    const elapsed = Date.now() - testStartTime;
    const progress = ((i / TARGET_REQUESTS) * 100).toFixed(1);
    const elapsedMinutes = (elapsed / 60000).toFixed(2);

    const urlIndex = (i - 1) % FLIPKART_URLS.length;
    const url = FLIPKART_URLS[urlIndex];

    color.info(
      `[Request #${i}/${TARGET_REQUESTS}] (${progress}% - ${elapsedMinutes}min elapsed)`
    );

    const result = await makeApiCall(i, url);

    // Print result object for each API call
    console.log("API Result:", JSON.stringify(result, null, 2));

    requests.push(result);
    totalResponseTime += result.responseTime;

    if (result.success && result.data?.code) {
      successfulRequests++;
      consecutiveFailures = 0;
      successfulCodes.push(result.data.code);
      color.success(
        `[Request #${i}] Success (${result.status}) - Code: ${result.data.code} - ${result.responseTime}ms`
      );
    } else {
      failedRequests++;
      consecutiveFailures++;
      color.error(
        `[Request #${i}] Failed (${result.status}) - ${
          result.error || "Unknown error"
        } (Consecutive failures: ${consecutiveFailures})`
      );

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        color.warn(
          `Stopping test: ${MAX_CONSECUTIVE_FAILURES} consecutive failures reached`
        );
        break;
      }
    }

    if (i < TARGET_REQUESTS && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      const delay = getRandomDelay();
      await sleep(delay);
    }
  }

  const apiEndTime = new Date().toISOString();
  const averageResponseTime =
    requests.length > 0 ? totalResponseTime / requests.length : 0;

  color.success("=== Phase 1 Complete: API Calls ===");
  color.info(`Total API requests: ${requests.length}`);
  color.info(`Successful: ${successfulRequests}`);
  color.info(`Failed: ${failedRequests}`);
  color.info(`Codes collected: ${successfulCodes.length}`);

  // Wait 2 minutes before starting extraction
  color.info("Waiting 2 minutes before starting extraction phase...");
  await sleep(2 * 60 * 1000);

  // Phase 2: Extract pricing data using Playwright
  color.info("=== Phase 2: Extracting Pricing Data ===");
  color.info(`Target: ${EXTRACTION_TARGET} extractions`);
  color.info(`Available codes: ${successfulCodes.length}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Block images/fonts/media to speed up
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") {
      route.abort();
    } else {
      route.continue();
    }
  });

  const extractions: ExtractionResult[] = [];
  let successfulExtractions = 0;
  let failedExtractions = 0;
  const extractionStartTime = Date.now();

  // Use codes from API responses, repeat if needed to reach target
  const codesToExtract = [];
  while (
    codesToExtract.length < EXTRACTION_TARGET &&
    successfulCodes.length > 0
  ) {
    codesToExtract.push(...successfulCodes);
  }
  const finalCodes = codesToExtract.slice(0, EXTRACTION_TARGET);

  for (let i = 0; i < finalCodes.length; i++) {
    const code = finalCodes[i];
    const elapsed = Date.now() - extractionStartTime;
    const progress = (((i + 1) / finalCodes.length) * 100).toFixed(1);
    const elapsedMinutes = (elapsed / 60000).toFixed(2);

    color.info(
      `[Extraction #${i + 1}/${
        finalCodes.length
      }] (${progress}% - ${elapsedMinutes}min elapsed) - Code: ${code}`
    );

    const result = await extractPricingFromPage(page, code, i + 1);

    if (result.success) {
      successfulExtractions++;
      color.success(`[Extraction #${i + 1}] Success - Code: ${code}`);
      console.log("Price:", result.price);
    } else {
      failedExtractions++;
      color.error(
        `[Extraction #${i + 1}] Failed - Code: ${code} - ${result.error}`
      );
    }

    extractions.push(result);

    if (i < finalCodes.length - 1) {
      const delay = getRandomDelay();
      await sleep(delay);
    }
  }

  await browser.close();

  const endTime = new Date().toISOString();

  const results: TestResults = {
    startTime,
    endTime,
    totalRequests: requests.length,
    successfulRequests,
    failedRequests,
    averageResponseTime: Math.round(averageResponseTime),
    requests,
    extractions,
    totalExtractions: extractions.length,
    successfulExtractions,
    failedExtractions,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `pricehistory-bot-test-results-${timestamp}.json`;
  const filepath = join(process.cwd(), filename);

  await writeFile(filepath, JSON.stringify(results, null, 2), "utf-8");

  color.success("=== Test Completed ===");
  color.info(`Total API requests: ${requests.length}`);
  color.info(`Successful API: ${successfulRequests}`);
  color.info(`Failed API: ${failedRequests}`);
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    color.warn(
      `API test stopped early due to ${MAX_CONSECUTIVE_FAILURES} consecutive failures`
    );
  }
  color.info(`Average API response time: ${Math.round(averageResponseTime)}ms`);
  color.info(`Total extractions: ${extractions.length}`);
  color.info(`Successful extractions: ${successfulExtractions}`);
  color.info(`Failed extractions: ${failedExtractions}`);
  color.info(`Results saved to: ${filepath}`);
}
