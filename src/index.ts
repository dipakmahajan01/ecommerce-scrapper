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
// import { SpecParser, SpecsCrawler } from "./services";

// const ProductSpecsScraper = new SpecsCrawler();
import productRoutes from './routes/product/routes';
import { scrapeProcessorTable } from './service/mobile-details-scrapper';

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

app.use('/api/products',productRoutes);
// app.post("/run-code", async (req, res) => {
//   // const result = await ProductSpecsScraper.processURL(url);
//   // await testFindPhoneURL();
//   const fs = require("fs");
//   const path = require("path");

//   // Read input data file
//   const inputPath = path.resolve(__dirname, "../data/out.json");
//   const outputPath = path.resolve(__dirname, "../data/out-processed.json");

//   let result: any = { success: true };
//   try {
//     const rawData = fs.readFileSync(inputPath, "utf8");
//     const data: any = JSON.parse(rawData);
//     // If the data is an array, process all items, otherwise process single object
//     const filter = Object.values(data).filter(
//       (item) => Object.keys(item.result.data ?? {}).length > 0
//     );
//     const processed = filter.map((spec) => {
//       const s: any = spec;
//       console.log(s);
//       const parser = new SpecParser(s.result.data);
//       return parser.process();
//     });

//     // Write processed data to output file
//     fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2), "utf8");
//     result = { success: true, message: "Data processed", outputPath };
//   } catch (err: any) {
//     console.error(err);
//     result = { success: false, error: err.message || err.toString() };
//   }
//   res.json(result);
// });

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
scrapeProcessorTable("https://nanoreview.net/en/soc-list/rating").catch((err:any) => {
    console.error(err);
    process.exit(1);
});
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
