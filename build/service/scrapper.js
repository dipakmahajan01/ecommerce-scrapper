"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crawlee_1 = require("crawlee");
// PuppeteerCrawler crawls the web using a headless
// browser controlled by the Puppeteer library.
const crawler = new crawlee_1.PuppeteerCrawler({
    // Use the requestHandler to process each of the crawled pages.
    async requestHandler({ request, page, enqueueLinks, log }) {
        const title = await page.title();
        // Save results as JSON to ./storage/datasets/default
        // await Dataset.pushData({ title, url: request.loadedUrl });
        // Extract links from the current page
        // and add them to the crawling queue.
        // await enqueueLinks();
    },
    // Uncomment this option to see the browser window.
    // headless: false,
    // Let's limit our crawls to make our tests shorter and safer.
    maxRequestsPerCrawl: 1,
});
exports.default = crawler;
