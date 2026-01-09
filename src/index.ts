/* eslint-disable no-console */
import * as bodyParser from "body-parser";
import dotenv from "dotenv";
import express, { Request, Response } from "express"; // NextFunction,
import http from "http";
import cors from "cors";
import { StatusCodes } from "http-status-codes";
import { logger, logInfo, responseValidation } from "./lib";
import productRoutes from "./routes/product/routes";
import {
  getProductDetails,
  scoreAndRankProductList,
} from "./service/productRelevanceEngine";
import {
  CategoryWeights,
  SmartPrixRecord,
} from "./service/productRelevanceEngine/types";

dotenv.config();

const app = express();

const server = new http.Server(app);
app.use(cors());
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
// app.get("/start", async (req, res) => {
//   const dummyInput = [
//     {
//       name: "Samsung Galaxy S24 5G Snapdragon (Onyx Black, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-onyx-black-256-gb/p/itm0eb31619428e4?pid=MOBHDVFKVGGGHBDX",
//       current_price: 30000,
//       original_price: 30000,
//       discounted: false,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/r/8/1/-original-imahfz2tenzpsd3p.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-snapdragon-onyx-black-256-gb/p/itm0eb31619428e4?pid=MOBHDVFKVGGGHBDX",
//     },
//     {
//       name: "Samsung Galaxy S24 5G Snapdragon (Cobalt Violet, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-cobalt-violet-256-gb/p/itm0e4552c03ca7c?pid=MOBHDVFKKYGS2K9T",
//       current_price: 45999,
//       original_price: 79999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/a/8/s/-original-imahfz2tvjqak9v3.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-snapdragon-cobalt-violet-256-gb/p/itm0e4552c03ca7c?pid=MOBHDVFKKYGS2K9T",
//     },
//     {
//       name: "Samsung Galaxy S23 5G (Green, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s23-5g-green-256-gb/p/itm6840743bfd1ef?pid=MOBGMFFXB7RGPNET",
//       current_price: 49999,
//       original_price: 95999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/p/w/p/-original-imah4zp8tfzndmmh.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s23-5g-green-256-gb/p/itm6840743bfd1ef?pid=MOBGMFFXB7RGPNET",
//     },
//     {
//       name: "Samsung Galaxy S23 5G (Phantom Black, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s23-5g-phantom-black-256-gb/p/itm347e695feffe7?pid=MOBGMFFXPNSHBGRC",
//       current_price: 49999,
//       original_price: 95999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/t/0/g/-original-imah4zp7fvqp8wev.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s23-5g-phantom-black-256-gb/p/itm347e695feffe7?pid=MOBGMFFXPNSHBGRC",
//     },
//     {
//       name: "Samsung Galaxy S24 5G Snapdragon (Marble Gray, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-marble-gray-128-gb/p/itm8f6413060b707?pid=MOBHDVFKCP3DZG4G",
//       current_price: 40999,
//       original_price: 74999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/i/b/d/-original-imahfz2tuqdczpfg.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-snapdragon-marble-gray-128-gb/p/itm8f6413060b707?pid=MOBHDVFKCP3DZG4G",
//     },
//     {
//       name: "Samsung Galaxy S24 5G Snapdragon (Amber Yellow, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-amber-yellow-256-gb/p/itm170d9f8c2ec9c?pid=MOBHDVFKDNDVPYMK",
//       current_price: 45999,
//       original_price: 79999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/f/a/6/-original-imahfz2tnafhmagr.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-snapdragon-amber-yellow-256-gb/p/itm170d9f8c2ec9c?pid=MOBHDVFKDNDVPYMK",
//     },
//     {
//       name: "Samsung Galaxy S24 5G Snapdragon (Marble Gray, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-marble-gray-256-gb/p/itmc60e0c4fb63b7?pid=MOBHDVFKAWDVHJTU",
//       current_price: 45999,
//       original_price: 79999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/i/b/d/-original-imahfz2tuqdczpfg.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-snapdragon-marble-gray-256-gb/p/itmc60e0c4fb63b7?pid=MOBHDVFKAWDVHJTU",
//     },
//     {
//       name: "Samsung Galaxy A55 5G (Awesome Iceblue, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a55-5g-awesome-iceblue-256-gb/p/itm9d66e3d4ee04f?pid=MOBGYT2H76JPBMXB",
//       current_price: 31889,
//       original_price: 48999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/8/c/j/-original-imahbzpyfv8gpku7.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a55-5g-awesome-iceblue-256-gb/p/itm9d66e3d4ee04f?pid=MOBGYT2H76JPBMXB",
//     },
//     {
//       name: "Samsung Galaxy A56 5G (Awesome Olive, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a56-5g-awesome-olive-256-gb/p/itm59cee56c2f868?pid=MOBH9RNG6YW8ABAG",
//       current_price: 41990,
//       original_price: 52999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/x/4/e/-original-imahggs43enf9dns.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a56-5g-awesome-olive-256-gb/p/itm59cee56c2f868?pid=MOBH9RNG6YW8ABAG",
//     },
//     {
//       name: "Samsung Galaxy A36 5G (Awesome Lavender, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a36-5g-awesome-lavender-256-gb/p/itm7cd1681f527cb?pid=MOBH9RNGJZSYWDKR",
//       current_price: 34499,
//       original_price: 45499,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/m/2/s/-original-imahghmrgjrgc37p.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a36-5g-awesome-lavender-256-gb/p/itm7cd1681f527cb?pid=MOBH9RNGJZSYWDKR",
//     },
//     {
//       name: "Samsung Galaxy S24 FE 5G (Mint, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-fe-5g-mint-256-gb/p/itme960199e26f23?pid=MOBH4ZG3JACNJMZC",
//       current_price: 37999,
//       original_price: 65999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/4/p/o/-original-imahfw4aasyhherc.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-fe-5g-mint-256-gb/p/itme960199e26f23?pid=MOBH4ZG3JACNJMZC",
//     },
//     {
//       name: "Samsung Galaxy S24 5G Snapdragon (Onyx Black, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-onyx-black-128-gb/p/itm3469a7107606f?pid=MOBHDVFKSSHPUYHB",
//       current_price: 40999,
//       original_price: 74999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/r/8/1/-original-imahfz2tenzpsd3p.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-snapdragon-onyx-black-128-gb/p/itm3469a7107606f?pid=MOBHDVFKSSHPUYHB",
//     },
//     {
//       name: "Samsung Galaxy A55 5G (Awesome Navy, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a55-5g-awesome-navy-256-gb/p/itmfb3db0f07b36b?pid=MOBGYT2HY8JZCSPW",
//       current_price: 31953,
//       original_price: 48999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/q/q/t/-original-imahbzpzhcptykzf.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a55-5g-awesome-navy-256-gb/p/itmfb3db0f07b36b?pid=MOBGYT2HY8JZCSPW",
//     },
//     {
//       name: "Samsung Galaxy A56 5G (Awesome Graphite, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a56-5g-awesome-graphite-256-gb/p/itm33a726cc39ea5?pid=MOBH9RNGGNNYZPCH",
//       current_price: 41990,
//       original_price: 52999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/w/g/q/-original-imahggs4qhqjpuwr.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a56-5g-awesome-graphite-256-gb/p/itm33a726cc39ea5?pid=MOBH9RNGGNNYZPCH",
//     },
//     {
//       name: "Samsung Galaxy A54 5G (Awesome Violet, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a54-5g-awesome-violet-256-gb/p/itmb5157c4fec810?pid=MOBGNE4SXSWFUKEQ",
//       current_price: 31999,
//       original_price: 45999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/t/h/6/-original-imagnrhk2jpnnajr.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a54-5g-awesome-violet-256-gb/p/itmb5157c4fec810?pid=MOBGNE4SXSWFUKEQ",
//     },
//     {
//       name: "Samsung Galaxy S24 Exynos 5G (Amber Yellow, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-exynos-5g-amber-yellow-128-gb/p/itm62889e2615d7c?pid=MOBHYJ6QMSGJG28G",
//       current_price: 49999,
//       original_price: 74999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/n/c/d/-original-imahfvuab7e6shug.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-exynos-5g-amber-yellow-128-gb/p/itm62889e2615d7c?pid=MOBHYJ6QMSGJG28G",
//     },
//     {
//       name: "Samsung Galaxy S24 5G Snapdragon (Amber Yellow, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-snapdragon-amber-yellow-128-gb/p/itmd4baa945a78ef?pid=MOBHDVFKSZNEZGXW",
//       current_price: 40999,
//       original_price: 74999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/f/a/6/-original-imahfz2tnafhmagr.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-snapdragon-amber-yellow-128-gb/p/itmd4baa945a78ef?pid=MOBHDVFKSZNEZGXW",
//     },
//     {
//       name: "Samsung Galaxy A36 5G (Awesome White, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a36-5g-awesome-white-256-gb/p/itm2f14454f7dc29?pid=MOBH9RNGWSX2XDZX",
//       current_price: 31499,
//       original_price: 42499,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/s/y/s/-original-imahghmrpjysyghq.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a36-5g-awesome-white-256-gb/p/itm2f14454f7dc29?pid=MOBH9RNGWSX2XDZX",
//     },
//     {
//       name: "Samsung Galaxy A36 5G (Awesome Black, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a36-5g-awesome-black-256-gb/p/itmb641e1c77cc60?pid=MOBH9RNG5BH5JHPE",
//       current_price: 34499,
//       original_price: 45499,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/j/d/y/-original-imahghmrwujyqzy7.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a36-5g-awesome-black-256-gb/p/itmb641e1c77cc60?pid=MOBH9RNG5BH5JHPE",
//     },
//     {
//       name: "Samsung Galaxy A36 5G (Awesome Lavender, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a36-5g-awesome-lavender-256-gb/p/itma5b5834a73d65?pid=MOBH9RNG3KTYVZKE",
//       current_price: 31499,
//       original_price: 42499,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/m/2/s/-original-imahghmrgjrgc37p.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a36-5g-awesome-lavender-256-gb/p/itma5b5834a73d65?pid=MOBH9RNG3KTYVZKE",
//     },
//     {
//       name: "Samsung Galaxy S23 5G (Cream, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s23-5g-cream-128-gb/p/itmc77ff94cdf044?pid=MOBGMFFX5XYE8MZN",
//       current_price: 44999,
//       original_price: 89999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/y/8/i/-original-imah4zp7fgtezhsz.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s23-5g-cream-128-gb/p/itmc77ff94cdf044?pid=MOBGMFFX5XYE8MZN",
//     },
//     {
//       name: "Samsung Galaxy S24 Exynos 5G (Cobalt Violet, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-exynos-5g-cobalt-violet-128-gb/p/itm588425527a2f1?pid=MOBHYJ6Q3ZAFJTF7",
//       current_price: 49999,
//       original_price: 74999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/0/a/j/-original-imahfvuadz9gaebf.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-exynos-5g-cobalt-violet-128-gb/p/itm588425527a2f1?pid=MOBHYJ6Q3ZAFJTF7",
//     },
//     {
//       name: "Samsung Galaxy S23 FE (Mint, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s23-fe-mint-256-gb/p/itmdb72279972171?pid=MOBGVTA2R8ZH4G3C",
//       current_price: 44990,
//       original_price: 84999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/8/v/0/-original-imah5ywfebrs9bfg.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s23-fe-mint-256-gb/p/itmdb72279972171?pid=MOBGVTA2R8ZH4G3C",
//     },
//     {
//       name: "Samsung Galaxy A54 5G (Awesome Graphite, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a54-5g-awesome-graphite-128-gb/p/itm3474dcb32e38b?pid=MOBGNE4SFB9HPZST",
//       current_price: 33320,
//       original_price: 41999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/2/a/t/-original-imagnrhknw9pbg3t.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a54-5g-awesome-graphite-128-gb/p/itm3474dcb32e38b?pid=MOBGNE4SFB9HPZST",
//     },
//     {
//       name: "Samsung Galaxy S24 Exynos 5G (Marble Gray, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-exynos-5g-marble-gray-128-gb/p/itme9ce56159db66?pid=MOBHYJ6QZP2UA4X9",
//       current_price: 30000,
//       original_price: 30000,
//       discounted: false,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/h/c/y/-original-imahfvuadzkwayf7.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-exynos-5g-marble-gray-128-gb/p/itme9ce56159db66?pid=MOBHYJ6QZP2UA4X9",
//     },
//     {
//       name: "Samsung Galaxy S23 5G (Lavender, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s23-5g-lavender-256-gb/p/itmfbae75e3840e1?pid=MOBGMFFXDQTGNWVK",
//       current_price: 49999,
//       original_price: 95999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/6/g/j/-original-imah4zp7pfzx7fqu.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s23-5g-lavender-256-gb/p/itmfbae75e3840e1?pid=MOBGMFFXDQTGNWVK",
//     },
//     {
//       name: "RoarX 25 W HyperCharge 3.1 A Wall Charger for Mobile",
//       link: "https://www.flipkart.com/roarx-25-w-hypercharge-3-1-wall-charger-mobile/p/itmea6b0c9d54d81?pid=ACCH5YNHM6YBGBPF",
//       current_price: 678,
//       original_price: 1999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/battery-charger/x/r/y/super-fast-charger-for-galaxy-a15-5g-fast-charger-adapter-roarx-original-imah5ynh2whntab7.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/roarx-25-w-hypercharge-3-1-wall-charger-mobile/p/itmea6b0c9d54d81?pid=ACCH5YNHM6YBGBPF",
//     },
//     {
//       name: "Samsung Galaxy S23 5G (Cream, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s23-5g-cream-128-gb/p/itm9619b045369d0?pid=MOBH92ADXZYNYUTX",
//       current_price: 47999,
//       original_price: 89999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/j/2/x/-original-imah4zp7myudnufp.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s23-5g-cream-128-gb/p/itm9619b045369d0?pid=MOBH92ADXZYNYUTX",
//     },
//     {
//       name: "Samsung Galaxy S21 FE 5G with Snapdragon 888 (Lavender, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s21-fe-5g-snapdragon-888-lavender-128-gb/p/itm9189006529d08?pid=MOBGTKQGKGYZDJZY",
//       current_price: 45999,
//       original_price: 69999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/y/s/l/-original-imagtnqjjuc6dh6v.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s21-fe-5g-snapdragon-888-lavender-128-gb/p/itm9189006529d08?pid=MOBGTKQGKGYZDJZY",
//     },
//     {
//       name: "RoarX 25 W Supercharge 3.1 A Wall Charger for Mobile with Detachable Cable",
//       link: "https://www.flipkart.com/roarx-25-w-supercharge-3-1-wall-charger-mobile-detachable-cable/p/itm6e4d78839c3dd?pid=ACCHY683X5UFFZGX",
//       current_price: 416,
//       original_price: 2999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/battery-charger/y/4/8/25w-fast-charger-charger-with-c-to-c-cable-sam-sung-roarx-original-imah6ekazdgp9urd.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/roarx-25-w-supercharge-3-1-wall-charger-mobile-detachable-cable/p/itm6e4d78839c3dd?pid=ACCHY683X5UFFZGX",
//     },
//     {
//       name: "Samsung Galaxy S21 FE 5G with Snapdragon 888 (Graphite, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s21-fe-5g-snapdragon-888-graphite-128-gb/p/itm5a614a9761bc7?pid=MOBGTKQGXJDVF95N",
//       current_price: 45999,
//       original_price: 69999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/d/o/c/-original-imagtnqjmfqxxbj2.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s21-fe-5g-snapdragon-888-graphite-128-gb/p/itm5a614a9761bc7?pid=MOBGTKQGXJDVF95N",
//     },
//     {
//       name: "Samsung Galaxy A73 5G (Awesome Mint, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a73-5g-awesome-mint-256-gb/p/itm77ee3121850b5?pid=MOBGCS4JEGWBUWEN",
//       current_price: 44999,
//       original_price: 49990,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/l3xcr680/mobile/k/j/f/-original-imagexf3pyq5m5va.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a73-5g-awesome-mint-256-gb/p/itm77ee3121850b5?pid=MOBGCS4JEGWBUWEN",
//     },
//     {
//       name: "Samsung Galaxy S21 FE 5G with Snapdragon 888 (Olive, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s21-fe-5g-snapdragon-888-olive-128-gb/p/itm628856d2794e5?pid=MOBGTKQGTQW4PZUF",
//       current_price: 45999,
//       original_price: 69999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/a/y/g/-original-imagtnqkutcyzhgq.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s21-fe-5g-snapdragon-888-olive-128-gb/p/itm628856d2794e5?pid=MOBGTKQGTQW4PZUF",
//     },
//     {
//       name: "Samsung Galaxy A73 5G (Awesome Gray, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a73-5g-awesome-gray-128-gb/p/itme09eaea734554?pid=MOBGCS4JSYRGZPZR",
//       current_price: 41999,
//       original_price: 47490,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/r/c/s/galaxy-a73-5g-sm-a736bzaginu-sm-a736bzagins-samsung-original-imah4fbzsz8jfpah.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a73-5g-awesome-gray-128-gb/p/itme09eaea734554?pid=MOBGCS4JSYRGZPZR",
//     },
//     {
//       name: "Samsung Galaxy S7 (Gold Platinum, 32 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s7-gold-platinum-32-gb/p/itmeuyda4qgqetc6?pid=MOBEGFZPWJHYT7NX",
//       current_price: 46000,
//       original_price: 46000,
//       discounted: false,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/mobile/7/n/x/samsung-galaxy-s7-na-original-imaegmjszvhghyzc.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s7-gold-platinum-32-gb/p/itmeuyda4qgqetc6?pid=MOBEGFZPWJHYT7NX",
//     },
//     {
//       name: "Samsung Galaxy S8 (Burgundy Red, 64 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s8-burgundy-red-64-gb/p/itmf3zs5kcmtztcv?pid=MOBF3ZRVC9VZXKVG",
//       current_price: 49990,
//       original_price: 51000,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/jfwuz680/mobile/k/v/g/samsung-galaxy-s8-sm-g950fzrdins-original-imaf49qmsmz4yhhh.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s8-burgundy-red-64-gb/p/itmf3zs5kcmtztcv?pid=MOBF3ZRVC9VZXKVG",
//     },
//     {
//       name: "Samsung Galaxy A80 (Phantom Black, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a80-phantom-black-128-gb/p/itmfghz3gneezbyh?pid=MOBFGHZ2CHC2SYSA",
//       current_price: 52000,
//       original_price: 52000,
//       discounted: false,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/k2jbyq80pkrrdj/mobile-refurbished/f/z/v/galaxy-a80-128-b-sm-a805fzkuins-samsung-8-original-imafgj4ht2dqgvgy.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a80-phantom-black-128-gb/p/itmfghz3gneezbyh?pid=MOBFGHZ2CHC2SYSA",
//     },
//     {
//       name: "Samsung Galaxy A35 5G (Awesome Iceblue, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a35-5g-awesome-iceblue-128-gb/p/itm9684d2fe9201e?pid=MOBGYT2HEYWFCG8Q",
//       current_price: 18499,
//       original_price: 33999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/o/j/d/-original-imahgy25zuwqzzye.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a35-5g-awesome-iceblue-128-gb/p/itm9684d2fe9201e?pid=MOBGYT2HEYWFCG8Q",
//     },
//     {
//       name: "Samsung Galaxy A55 5G (Awesome Navy, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a55-5g-awesome-navy-128-gb/p/itm7ac5d2771f7a0?pid=MOBGYT2H4PGHBRHJ",
//       current_price: 24259,
//       original_price: 42999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/q/q/t/-original-imahbzpzhcptykzf.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a55-5g-awesome-navy-128-gb/p/itm7ac5d2771f7a0?pid=MOBGYT2H4PGHBRHJ",
//     },
//     {
//       name: "Samsung Galaxy A55 5G (Awesome Iceblue, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a55-5g-awesome-iceblue-256-gb/p/itmf96a733c20399?pid=MOBGYT2HGMHT5GFZ",
//       current_price: 26999,
//       original_price: 45999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/8/c/j/-original-imahbzpyfv8gpku7.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a55-5g-awesome-iceblue-256-gb/p/itmf96a733c20399?pid=MOBGYT2HGMHT5GFZ",
//     },
//     {
//       name: "Samsung Galaxy A35 5G (Awesome Lilac, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a35-5g-awesome-lilac-256-gb/p/itm8f49f29e842cc?pid=MOBGYT2HRXWTHACK",
//       current_price: 20499,
//       original_price: 36999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/2/s/8/-original-imahgy26fu3z2hez.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a35-5g-awesome-lilac-256-gb/p/itm8f49f29e842cc?pid=MOBGYT2HRXWTHACK",
//     },
//     {
//       name: "Samsung Galaxy A55 5G (Awesome Navy, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a55-5g-awesome-navy-256-gb/p/itmc9f5e13bbf84d?pid=MOBGYT2HAUQNPZYV",
//       current_price: 26892,
//       original_price: 45999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/q/q/t/-original-imahbzpzhcptykzf.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a55-5g-awesome-navy-256-gb/p/itmc9f5e13bbf84d?pid=MOBGYT2HAUQNPZYV",
//     },
//     {
//       name: "Samsung Galaxy A56 5G (Awesome Olive, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a56-5g-awesome-olive-256-gb/p/itm7e0f6a3b05352?pid=MOBH9RNGFAS4SU4U",
//       current_price: 38999,
//       original_price: 52999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/x/4/e/-original-imahggs43enf9dns.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a56-5g-awesome-olive-256-gb/p/itm7e0f6a3b05352?pid=MOBH9RNGFAS4SU4U",
//     },
//     {
//       name: "Samsung Galaxy A56 5G (Awesome Olive, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a56-5g-awesome-olive-128-gb/p/itm81265b7c9602c?pid=MOBH9RNG5SA9ADHS",
//       current_price: 35990,
//       original_price: 45999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/x/4/e/-original-imahggs43enf9dns.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a56-5g-awesome-olive-128-gb/p/itm81265b7c9602c?pid=MOBH9RNG5SA9ADHS",
//     },
//     {
//       name: "Samsung Galaxy A56 5G (Awesome Light Gray, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a56-5g-awesome-light-gray-256-gb/p/itmc0a5efd53f7c2?pid=MOBH9RNG8GZVGY7H",
//       current_price: 38999,
//       original_price: 52999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/h/o/y/-original-imahggs4rjkjea8p.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a56-5g-awesome-light-gray-256-gb/p/itmc0a5efd53f7c2?pid=MOBH9RNG8GZVGY7H",
//     },
//     {
//       name: "Samsung Galaxy A36 5G (Awesome White, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a36-5g-awesome-white-128-gb/p/itm5be3c74d46c0c?pid=MOBH9RNGK9ACFMRQ",
//       current_price: 27949,
//       original_price: 35999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/s/y/s/-original-imahghmrpjysyghq.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a36-5g-awesome-white-128-gb/p/itm5be3c74d46c0c?pid=MOBH9RNGK9ACFMRQ",
//     },
//     {
//       name: "Samsung Galaxy Tab S9 FE 8 GB RAM 256 GB ROM 10.9 inch with Wi-Fi+5G Tablet (Gray)",
//       link: "https://www.flipkart.com/samsung-galaxy-tab-s9-fe-8-gb-ram-256-rom-10-9-inch-wi-fi-5g-tablet-gray/p/itmacf5e87940ecc?pid=TABGTDU93RYH3HJW",
//       current_price: 46999,
//       original_price: 61999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/tablet/z/l/8/-original-imagu28sxtrba9b2.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-tab-s9-fe-8-gb-ram-256-rom-10-9-inch-wi-fi-5g-tablet-gray/p/itmacf5e87940ecc?pid=TABGTDU93RYH3HJW",
//     },
//     {
//       name: "Samsung Galaxy A56 5G (Awesome Graphite, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a56-5g-awesome-graphite-256-gb/p/itmfc74a277c6fb4?pid=MOBH9RNGDAUAZUGG",
//       current_price: 38999,
//       original_price: 52999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/w/g/q/-original-imahggs4qhqjpuwr.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a56-5g-awesome-graphite-256-gb/p/itmfc74a277c6fb4?pid=MOBH9RNGDAUAZUGG",
//     },
//     {
//       name: "RoarX 25 W Adaptive Charging 3.1 A Wall Charger for Mobile",
//       link: "https://www.flipkart.com/roarx-25-w-adaptive-charging-3-1-wall-charger-mobile/p/itm74ea081612164?pid=ACCHYYN4CXHKNXCN",
//       current_price: 439,
//       original_price: 1999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/battery-charger/b/q/o/25w-charger-for-samsung-galaxy-a55-5g-fast-charger-adapter-roarx-original-imahy65knszpqasq.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/roarx-25-w-adaptive-charging-3-1-wall-charger-mobile/p/itm74ea081612164?pid=ACCHYYN4CXHKNXCN",
//     },
//     {
//       name: "Samsung Galaxy A54 5G (Awesome Violet, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-a54-5g-awesome-violet-128-gb/p/itm4bbcb0b5e1b2d?pid=MOBGNE4SRZG7HKW4",
//       current_price: 28999,
//       original_price: 41999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/t/h/6/-original-imagnrhk2jpnnajr.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-a54-5g-awesome-violet-128-gb/p/itm4bbcb0b5e1b2d?pid=MOBGNE4SRZG7HKW4",
//     },
//     {
//       name: "Samsung Galaxy S24+ 5G (Onyx Black, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-onyx-black-256-gb/p/itm325da4a26d7bb?pid=MOBGX2F3HVJYNHUV",
//       current_price: 59999,
//       original_price: 99999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/i/r/d/-original-imahfvuacucncbbn.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-onyx-black-256-gb/p/itm325da4a26d7bb?pid=MOBGX2F3HVJYNHUV",
//     },
//     {
//       name: "Samsung Galaxy F17 5G (Violet Pop, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-f17-5g-violet-pop-128-gb/p/itmeba452a75d14c?pid=MOBHF6KMGBPWSUR9",
//       current_price: 14499,
//       original_price: 17999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/h/b/h/-original-imahftgfjn6a9kpw.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-f17-5g-violet-pop-128-gb/p/itmeba452a75d14c?pid=MOBHF6KMGBPWSUR9",
//     },
//     {
//       name: "Samsung Galaxy S21 FE 5G with Snapdragon 888 (Olive, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s21-fe-5g-snapdragon-888-olive-256-gb/p/itmb3a0b1e650a0e?pid=MOBGSXD7TZZTJQXE",
//       current_price: 39999,
//       original_price: 65000,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/h/c/2/galaxy-s21-fe-5g-sm-g990blg4ins-samsung-original-imah4yeuthzf92qg.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s21-fe-5g-snapdragon-888-olive-256-gb/p/itmb3a0b1e650a0e?pid=MOBGSXD7TZZTJQXE",
//     },
//     {
//       name: "Samsung Galaxy S20+ (Cosmic Gray, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s20-cosmic-gray-128-gb/p/itm7087be7ae167c?pid=MOBFZXZ25TPA68VH",
//       current_price: 34990,
//       original_price: 83000,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/k6mibgw0/mobile/8/v/h/samsung-galaxy-s20-sm-g985fzadinu-original-imafpfkbqg3hpmgt.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s20-cosmic-gray-128-gb/p/itm7087be7ae167c?pid=MOBFZXZ25TPA68VH",
//     },
//     {
//       name: "Samsung Galaxy S24+ 5G (Cobalt Violet, 256 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-5g-cobalt-violet-256-gb/p/itm46fc37ddc7255?pid=MOBGX2F3GDX7QYFT",
//       current_price: 59999,
//       original_price: 99999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/g/d/6/-original-imahfvuakpzdrzzx.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-5g-cobalt-violet-256-gb/p/itm46fc37ddc7255?pid=MOBGX2F3GDX7QYFT",
//     },
//     {
//       name: "Samsung Galaxy S24 FE 5G (Mint, 128 GB)",
//       link: "https://www.flipkart.com/samsung-galaxy-s24-fe-5g-mint-128-gb/p/itme960199e26f23?pid=MOBH4ZG3TSXHKXH2",
//       current_price: 33999,
//       original_price: 59999,
//       discounted: true,
//       thumbnail:
//         "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/4/p/o/-original-imahfw4aasyhherc.jpeg?q=70",
//       query_url:
//         "https://flipkart.com/product/samsung-galaxy-s24-fe-5g-mint-128-gb/p/itme960199e26f23?pid=MOBH4ZG3TSXHKXH2",
//     },
//   ] as unknown as { name: string }[];

//   const productDetailsList = await getProductDetails(dummyInput);

//   const categoryWeights: CategoryWeights = {
//     batteryEndurance: 26,
//     displayQuality: 14,
//     cpuPerformance: 10,
//     cameraQuality: 4,
//     gpuPerformance: 2,
//   };

//   const sortedData = scoreAndRankProductList(
//     productDetailsList,
//     categoryWeights,
//     20
//   );
//   return res.json({ sortedData });
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
