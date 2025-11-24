import { PuppeteerCrawler } from 'crawlee';

export interface ProcessorRowScraped {
  name: string;
  detailUrl: string;
  specs: Record<string, string>;
}

export async function crawlAllRows(startHtmlFile: string): Promise<ProcessorRowScraped[]> {
  const fs = require('fs');
  const path = require('path');
console.log("Crawling all rows from:", startHtmlFile);
  // Load the local HTML file as the "homepage"
//   const startHtml = fs.readFileSync(startHtmlFile, 'utf-8');
//   const baseDir = path.dirname(startHtmlFile);

  // Extract all detail URLs from the list page
  const cheerio = require('cheerio');
  const $ = cheerio.load(startHtmlFile);
  // Adjust selector if needed
  const rowLinks: { name: string; href: string }[] = [];

  $("table.table-list tbody tr").each((_:any, row:any) => {
    const el = $(row).find("td").eq(1).find("a");
    if (el.length) {
      rowLinks.push({
        name: el.text().trim(),
        href: el.attr('href') // this could be a relative path
      });
    }
  });
  console.log("Extracting detail links from list page", rowLinks);
  // Setup PuppeteerCrawler
  const results: ProcessorRowScraped[] = [];
  const crawler = new PuppeteerCrawler({
    maxRequestsPerCrawl: rowLinks.length,
    // If the href is relative, you need to provide a base path or serve your files via local HTTP
    requestHandler: async ({ request, page }) => {
      await page.goto(request.url, { waitUntil: 'domcontentloaded' });
      const name = await page.title();
      // Example: scrape all specs from the detail
      const specs: Record<string, string> = {};
      const rows = await page.$$('table.specs-table tr');
      for (const row of rows) {
        const th = await row.$eval('td.cell-h', (el: any) => el.innerText).catch(() => null);
        const td = await row.$eval('td.cell-s', (el: any) => el.innerText).catch(() => null);
        if (th && td) specs[th] = td;
      }
      results.push({ name, detailUrl: request.url, specs });
    },
  });
  console.log("Enqueuing detail URLs for crawling:", results.length);
  console.log("results", results);

  // Enqueue all found detail URLs
  for (const { name, href } of rowLinks) {
    // If local HTML files, resolve full path, or construct file:// URLs as needed
    // const detailFilePath = path.join(baseDir, href.replace('/en/soc/', '')); // Adjust as per your structure
    console.log("Enqueuing detail URL:", href);
    const detailUrl = `https://${href}`; // Adjust if needed
    await crawler.addRequests([detailUrl]);
  }

  await crawler.run();
  console.log("Crawled processor detail pages:", results.length);
  console.log(results.slice(0, 3)); // Log first 3 results for verification
  return results;
}
