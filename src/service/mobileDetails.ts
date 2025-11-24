import { CheerioCrawler, PlaywrightCrawler } from "crawlee";
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import { saveSoc } from "../models/soc";

interface ProcessorRow {
  name: string | null;
  brand: string | null;
  rating: string | null;
  antutu: string | null;
  geekbench: string | null;
  cores: string | null;
  clock: string | null;
  gpu: string | null;
  // details scraped from the linked detail page
  detailTitle?: string | null;
  detailTextSnippet?: string | null;
  detail?: any;
}

interface DetailData {
  title?: string | null;
  description?: string | null;
  reviewScores?: Array<{ name: string; value: string }>;
  antutu?: { total?: string | null; breakdown?: Record<string,string> } | null;
  recentAntutu?: Array<{ date: string; score: string; user: string; phone: string }>;
  geekbench?: { total?: string | null; breakdown?: Record<string,string> } | null;
  smartphones?: Array<{ name: string; url?: string | null; score?: string | null }>;
  sections?: Record<string, Record<string,string>>;
}

/**
 * Scrape processor table rows from a local HTML file and then visit each "name" link
 * one-by-one using PlaywrightCrawler to scrape details from the linked page.
 * This simulates: click name -> scrape details -> go back -> click next name ...
 *
 * filePath can be a local HTML file path or an HTTP(s) URL.
 */
export async function scrapeProcessorTable(filePath: string, maxDetails = 20): Promise<ProcessorRow[]> {
  // Normalize input to detect URLs that may have been passed with backslashes (Windows)
  const normalizedForCheck = filePath.replace(/\\/g, "/").replace(/\\/g, "/");

  // If the input looks like an HTTP(S) URL, fetch it with Playwright instead of fs.readFileSync
  let html: string;
  let baseForRelative = filePath;
  if (/^https?:\/\//i.test(normalizedForCheck) || /^https?:\//i.test(normalizedForCheck)) {
    // ensure proper protocol slashes
    const url = normalizedForCheck.replace(/^https?:\/+/i, (m) => (m.toLowerCase().startsWith("https") ? "https://" : "http://"));
    baseForRelative = url;

    const pageContents: { html?: string } = {};
    const fetcher = new PlaywrightCrawler({
      maxConcurrency: 1,
      requestHandler: async ({ page, request }) => {
        try {
          await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          pageContents.html = await page.content();
          console.log(`[mobileDetails] Fetched base page HTML from ${request.url} (${pageContents.html?.length ?? 0} bytes)`);
        } catch (err) {
          console.error('[mobileDetails] failed to fetch URL', request.url, err);
          pageContents.html = '';
        }
      },
    });

    await fetcher.run([{ url: url }]);
    html = pageContents.html ?? '';
  } else if (filePath.startsWith("file://")) {
    const local = filePath.replace(/^file:\/\//, "");
    html = fs.readFileSync(local, "utf-8");
    baseForRelative = `file://${path.dirname(local)}/`;
  } else {
    // treat as local file path
    html = fs.readFileSync(filePath, "utf-8");
    baseForRelative = `file://${path.dirname(path.resolve(filePath))}/`;
  }

  const $ = cheerio.load(html || '');
  const rows: ProcessorRow[] = [];
  const linkTargets: { url: string; index: number }[] = [];
  // delay between visiting detail pages (ms). Override with env MOBILE_SCRAPER_DELAY_MS
  const interRequestDelayMs = parseInt(process.env.MOBILE_SCRAPER_DELAY_MS || '1000', 10) || 1000;

  $("table.table-list.sortable tbody tr").each((_, el) => {
    const row = $(el);

    const name = row.find("td:eq(1) a").text()?.trim() || null;
    const href = row.find("td:eq(1) a").attr("href") || null;
    const brand = row.find("td:eq(1) span.text-gray-small").text()?.trim() || null;
    const rating = row.find("td:eq(2) .table-list-score-box").text()?.trim() || null;
    const antutu = row.find("td:eq(3) > div > div:first-child").text()?.trim() || null;
    const geekbench = row.find("td:eq(4) > div > div:first-child").text()?.trim() || null;
    const cores = row.find("td:eq(5) .table-list-custom-circle").text()?.trim() || null;
    const clock = row.find("td:eq(6)").text()?.trim() || null;
    const gpu = row.find("td:eq(7)").text()?.trim() || null;

  const entry: ProcessorRow = { name, brand, rating, antutu, geekbench, cores, clock, gpu };
  const idx = rows.push(entry) - 1;
  console.log(`[mobileDetails] Row ${idx} parsed: name=${name}, href=${href}`);

    if (href) {
      let target = href;
      // Resolve relative links against the base (either the remote URL or the local file directory)
      try {
        if (!/^https?:\/\//i.test(href) && !href.startsWith("file://")) {
          // use URL resolution when base is HTTP or file://
          try {
            const resolved = new URL(href, baseForRelative).href;
            target = resolved;
          } catch (e) {
            // fallback to filesystem resolution for relative paths
            const dir = path.dirname(filePath);
            const resolvedFs = path.resolve(dir, href);
            if (fs.existsSync(resolvedFs)) {
              target = `file://${resolvedFs}`;
            } else {
              target = href;
            }
          }
        }
      } catch (e) {
        target = href;
      }

  console.log(`[mobileDetails] Adding link target for row ${idx}: ${target}`);
  linkTargets.push({ url: target, index: idx });
    }
  });

  console.log(`Found ${rows.length} table rows and ${linkTargets.length} link targets`);

  // limit how many detail pages we will visit (user requested only first N phones)
  if (typeof maxDetails === 'number' && maxDetails > 0 && linkTargets.length > maxDetails) {
    console.log(`Limiting link targets from ${linkTargets.length} to ${maxDetails}`);
    linkTargets.length = maxDetails;
  }

  // Visit each link sequentially using PlaywrightCrawler. We pass userData.index so we can attach results back.
  const details: { [index: number]: { title?: string | null; snippet?: string | null } } = {};

  if (linkTargets.length > 0) {
    const crawler = new PlaywrightCrawler({
      // be conservative with concurrency to avoid browser/context limits
      maxConcurrency: 1,
      // retry failed requests a few times before giving up
      maxRequestRetries: 3,
      // launch options - helpful in some CI/hosted environments
      launchContext: {
        launchOptions: {
          // many sites block headless browsers; default to non-headless for reliability
          headless: false,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        },
      },
      // called when a request fails after all retries
      failedRequestHandler: async ({ request, error, log }) => {
        const idx = request.userData?.index ?? -1;
        console.error(`[mobileDetails] Failed request ${request.url} (index=${idx}):`, (error && (error as Error).message) ? (error as Error).message : error);
        // mark details as null so caller knows this index failed
        details[idx] = { title: null, snippet: null };
      },
      requestHandler: async ({ page, request, log }) => {
        const idx = (request.userData && request.userData.index) ?? -1;
        try {
          console.log(`[mobileDetails] Request handler start for index=${idx}, url=${request.url}`);
          // explicit navigation with larger timeout — this gives us more control and clearer errors
          try {
            console.log(`[mobileDetails] Navigating to ${request.url} (index=${idx})`);

            // set a realistic User-Agent and some common headers to reduce bot detection
            const userAgents = [
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
              'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
            ];
            const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
            try { await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9', 'user-agent': ua }); } catch (e) { /* ignore */ }

            // small randomized delay before navigation to mimic human behaviour
            const delay = 300 + Math.floor(Math.random() * 800);
            await page.waitForTimeout(delay);

            const resp = await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
            // If server returns 403, rethrow to trigger crawler retry logic (or further handling)
            const status = resp?.status?.() ?? undefined;
            if (status === 403) {
              console.error(`[mobileDetails] Received 403 for ${request.url} (index=${idx})`);
              // throw so Crawlee knows this request failed and can retry/enqueue according to settings
              throw new Error('403 Forbidden');
            }
          } catch (navErr) {
            // navigation may fail if the page/context was closed; log and mark as failed
            const errMsg = (navErr instanceof Error) ? navErr.message : String(navErr);
            console.error('[mobileDetails] Navigation failed for', request.url, errMsg);
            details[idx] = { title: null, snippet: null };
            return;
          }

          // get full HTML and parse with cheerio to extract structured fields
          const pageHtml = await page.content();
          const parsed: DetailData = parseDetailPage(pageHtml);
          console.log("parsed", parsed);
          details[idx] = parsed;
          console.log(`[mobileDetails] Parsed detail for index=${idx}: title=${parsed.title ?? 'N/A'}, smartphones=${parsed.smartphones?.length ?? 0}`);
          // persist parsed SoC to database (if DB connection available)
          try {
            const saved = await saveSoc(parsed as any);
            console.log(`[mobileDetails] Saved parsed SoC to DB for index=${idx}, id=${(saved as any)?._id ?? 'n/a'}`);
          } catch (dbErr) {
            const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            console.error('[mobileDetails] Failed to save parsed SoC to DB', msg);
          }
          // wait before proceeding to the next request to avoid hitting rate limits
          try {
            const extra = Math.floor(Math.random() * 500);
            const waitMs = interRequestDelayMs + extra;
            console.log(`[mobileDetails] Waiting ${waitMs}ms before next request`);
            await page.waitForTimeout(waitMs);
          } catch (e) {
            // ignore wait errors
          }
          log.debug(`Scraped detail for index=${idx} from ${request.url}`);
        } catch (err) {
          console.error('Error scraping detail page', request.url, err);
          details[idx] = { title: null, snippet: null };
        }
      },
    });

    // prepare requests with userData indexes
    const requests = linkTargets.map((t) => ({ url: t.url, userData: { index: t.index } }));
    await crawler.run(requests);
  }

  // helper: parse a detail page HTML and extract the requested fields
  function parseDetailPage(html: string): DetailData {
    const $d = cheerio.load(html || '');
    const out: DetailData = { sections: {} };

    out.title = $d('h1.title-h1').first().text().trim() || null;

    // description / intro block
    const desc = $d('div.card-block.pb.bt-light').first().text().trim();
    out.description = desc || null;

    // Review scores
    const reviewCard = $d('#review').closest('.card');
    if (reviewCard && reviewCard.length) {
      out.reviewScores = [];
      reviewCard.find('.score-bar').each((i, el) => {
        const name = $d(el).find('.score-bar-name').text().trim();
        const value = $d(el).find('.score-bar-result-square, .score-bar-result-square-dark').text().trim();
        if (name) out.reviewScores!.push({ name, value });
      });
    }

    // AnTuTu
    const antutuCard = $d('#antutu').closest('.card');
    if (antutuCard && antutuCard.length) {
      const total = antutuCard.find('.score-bar-result-number').first().text().trim() || null;
      const breakdown: Record<string,string> = {};
      antutuCard.find('table.specs-table tbody tr').each((i, tr) => {
        const key = $d(tr).find('td.cell-h').text().trim();
        const val = $d(tr).find('td.cell-s').text().trim();
        if (key) breakdown[key] = val;
      });
      out.antutu = { total, breakdown };
    }

    // Recent AnTuTu v11 Results
    const recentHead = $d("h3.title-h2:contains('Recent AnTuTu v11 Results')").first();
    if (recentHead && recentHead.length) {
      out.recentAntutu = [];
      const tbl = recentHead.closest('.card').find('table.table-list tbody');
      tbl.find('tr').each((i, tr) => {
        const td = $d(tr).find('td');
        const date = $d(td.eq(0)).text().replace(/\s+/g, ' ').trim();
        const score = $d(td.eq(1)).text().replace(/\s+/g, ' ').trim();
        const user = $d(td.eq(2)).text().trim();
        const phone = $d(td.eq(3)).text().trim();
        out.recentAntutu!.push({ date, score, user, phone });
      });
    }

    // GeekBench
    const geekCard = $d('#geekbench').closest('.card');
    if (geekCard && geekCard.length) {
      const breakdown: Record<string,string> = {};
      geekCard.find('table.specs-table tbody tr').each((i, tr) => {
        const key = $d(tr).find('td.cell-h').text().trim();
        const val = $d(tr).find('td.cell-s').text().trim();
        if (key) breakdown[key] = val;
      });
      out.geekbench = { breakdown };
    }

    // Smartphones list
    const phonesCard = $d('#phones').closest('.card');
    if (phonesCard && phonesCard.length) {
      out.smartphones = [];
      phonesCard.find('table.table-list tbody tr').each((i, tr) => {
        const a = $d(tr).find('td:eq(0) a');
        const name = a.text().trim() || $d(tr).find('td:eq(0)').text().trim();
        const url = a.attr('href') || null;
        const score = $d(tr).find('td:eq(1)').text().trim() || null;
        out.smartphones!.push({ name, url, score });
      });
    }

    // Generic sections: Graphics, AI Accelerator, Memory, Multimedia (ISP), Connectivity, Info, Specifications
    const sectionNames = ['Graphics','AI Accelerator','Memory','Multimedia (ISP)','Connectivity','Info','Specifications'];
    for (const name of sectionNames) {
      // match by heading text
      const sel = $d("h3.title-h2:contains('" + name + "'), h2.title-h2:contains('" + name + "')").first();
      if (sel && sel.length) {
        const card = sel.closest('.card');
        const map: Record<string,string> = {};
        card.find('table.specs-table tbody tr').each((i, tr) => {
          const key = $d(tr).find('td.cell-h').text().trim();
          const val = $d(tr).find('td.cell-s').text().trim();
          if (key) map[key] = val;
        });
        out.sections![name] = map;
      }
    }

    return out;
  }

  // merge details back into rows
  for (const [i, row] of rows.entries()) {
    const d = details[i];
    row.detailTitle = d ? d.title ?? null : null;
    row.detailTextSnippet = d ? d.snippet ?? null : null;
    row.detail = d ?? null;
    console.log(`[mobileDetails] Merged details for row ${i}: title=${row.detailTitle ?? 'N/A'}`);
  }

  console.log('Scraped processor rows with details:', rows.length);
  return rows;
}
