/* eslint-disable no-console */
import * as bodyParser from "body-parser";
import dotenv from "dotenv";
import express, { Request, Response } from "express"; // NextFunction,
import http from "http";
// import helmet from 'helmet';
import cors from "cors";
import { StatusCodes } from "http-status-codes";
// import { Server } from 'socket.io';
import logger from "./lib/logger";
import { logInfo, responseValidation } from "./lib";
// import { testFindPhoneURL } from "./services/gsm-areana/get-gsm-areana-spec-url";
import { SpecParser, SpecsCrawler } from "./services";

const ProductSpecsScraper = new SpecsCrawler();
import productRoutes from "./routes/product/routes";
import { scrapeProcessorTable } from "./service/mobile-details-scrapper";
import { GsmArenaModel } from "./models/gsm-arena";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";

// import run from './service/scrapper';
// import crawler from './service/scrapper';

dotenv.config();

const app = express();

const server = new http.Server(app);
app.use(cors());
// const io = new Server(server,{cors: {origin: "*"}});
// app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: "1tb" }));
app.use((req, res, next) => {
  try {
    // set header for swagger.
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; frame-src 'self';"
    );

    // end
    const xForwardedFor = (
      (req.headers["x-forwarded-for"] || "") as string
    ).replace(/:\d+$/, "");
    const ip = xForwardedFor || req.connection.remoteAddress?.split(":").pop();
    logger.info(
      `------------ API Info ------------
      IMP - API called path: ${req.path},
      method: ${req.method},
      query: ${JSON.stringify(req.query)}, 
      remote address (main/proxy ip):${ip},
      reference: ${req.headers.referer} , 
      user-agent: ${req.headers["user-agent"]}
      ------------ End ------------  `
    );
  } catch (error) {
    logger.error(`error while printing caller info path: ${req.path}`);
  }

  next();
});

const health = (req: Request, res: Response) => {
  res.json({
    message: "ecomsoft is working properly please check your api",
    env: process.env.NODE_ENV,
    headers: req.headers,
  });
};

app.get("/", health);

app.use("/api/products", productRoutes);
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let isScrapping = false;
let lastScrap: null | string = null;
let lastError: string = "";
let shouldStopScraping = false;
let failedCountInSequence = 0;

// Provide progress info from DB, not the file
app.get("/scrap-status", async (req: Request, res: Response) => {
  let totalCount = 0;
  let failedCount = 0;
  try {
    totalCount = await GsmArenaModel.countDocuments();
    failedCount = await GsmArenaModel.countDocuments({ data: "FAILED" });
  } catch (err: any) {
    totalCount = 0;
    failedCount = 0;
    logger.error("Error querying GsmArenaModel for status:", err?.message);
  }
  res.json({
    isScrapping,
    lastScrap,
    count: totalCount,
    failed: failedCount,
    lastError,
    shouldStopScraping,
    failedCountInSequence,
  });
});

app.get("/run-code", async (req, res) => {
  try {
    // 1. Read which data to process from index-documents.json
    if (isScrapping) return res.send("One job is already running");
    shouldStopScraping = false; // reset stop flag
    const filePath = path.join(__dirname, "../data/index-documents.json");
    const rawData = readFileSync(filePath, "utf-8");
    let phones;
    try {
      phones = JSON.parse(rawData);
    } catch {
      phones = {};
      return res.send("PHONE IS EMPTY");
    }
    if (!Array.isArray(phones.phones)) {
      return res.send("The phones JSON is not an array");
    }
    const urls: string[] = phones.phones
      .map((phone: any) => phone.url)
      .filter(Boolean);

    // 2. Get already processed URLs from DB
    const existingDocs = await GsmArenaModel.find(
      { url: { $in: urls } },
      { url: 1 }
    ).lean();
    const processedUrlSet = new Set<string>(
      existingDocs.map((doc: any) => doc.url)
    );

    // 3. Figure out which URLs to process
    const toProcessUrls = urls.filter((url) => !processedUrlSet.has(url));

    if (toProcessUrls.length === 0) {
      return res.send("All URLs have already been processed.");
    }

    // 4. Process each remaining url with 10s delay, can be stopped by /stop-run-code
    (async () => {
      isScrapping = true;
      for (const url of toProcessUrls) {
        if (shouldStopScraping) {
          logger.info("Scraping process has been stopped by user.");
          break;
        }
        if (failedCountInSequence >= 20) {
          logger.error(
            "More than 20 requests failed in sequence. Stopping the scraping process."
          );
          break;
        }
        console.log("PROCESSING", url);
        try {
          const result = await ProductSpecsScraper.processURL(url);
          await GsmArenaModel.create(result);
          logger.info(`Processed: ${url}`);
          const ct = new Date();
          lastScrap = ct.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
          failedCountInSequence = 0; // Reset on success
        } catch (err: any) {
          logger.error(`Failed to process ${url}: ${(err as Error)?.message}`);
          await GsmArenaModel.create({ url, data: "FAILED" });
          lastError = err.message ?? `${url} FAILED`;
          failedCountInSequence += 1;
        }
        await sleep(10000);
      }
      isScrapping = false;
      shouldStopScraping = false;
      logger.info(
        "All phone URLs have been processed or scraping was stopped."
      );
    })();

    res.send(
      `Work Started. To be processed: ${toProcessUrls.length}. Already processed: ${processedUrlSet.size}.`
    );
  } catch (err: any) {
    logger.error("Error in /run-code endpoint:", err.message);
    res
      .status(500)
      .json({ error: "Could not process phone URLs", details: err.message });
  }
});

app.get("/stop-run-code", (req, res) => {
  if (!isScrapping) {
    res.json({ message: "No scraping job in progress." });
    return;
  }
  shouldStopScraping = true;
  res.json({ message: "Scraping job will be stopped soon." });
});

app.use((req: Request, res: Response) => {
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .send(
      responseValidation(StatusCodes.INTERNAL_SERVER_ERROR, "No route found")
    );
});

app.use((error: any, req: Request, res: Response) => {
  // , next: NextFunction
  logInfo("app error----------------->", error.message);
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
    responseValidation(
      StatusCodes.INTERNAL_SERVER_ERROR,
      /* If the environment is development, then return the error message, otherwise return an empty
        object. */
      process.env.NODE_ENV === "development" ? error.message : {}
    )
  );
});

// run().catch((err) => {
//     console.error(err);
//     process.exit(1);
// });
// scrapeProcessorTable("https://nanoreview.net/en/soc-list/rating").catch((err:any) => {
//     console.error(err);
//     process.exit(1);
// });
// crawlAllRows('https://nanoreview.net/en/soc-list/rating').catch((err) => {
//     console.error(err);
//     process.exit(1);
// });
process.on("unhandledRejection", function (reason, promise) {
  const errorMessage =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
      ? reason
      : JSON.stringify(reason, Object.getOwnPropertyNames(reason));
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error("Unhandled rejection", {
    error: errorMessage,
    stack,
    promise: promise?.toString?.() || "Promise object",
  });
});

export default app;
