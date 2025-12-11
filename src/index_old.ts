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

const ProductSpecsScraper = null;
import productRoutes from "./routes/product/routes";
import { scrapeProcessorTable } from "./service/mobile-details-scrapper";
import { GsmArenaModel } from "./models/gsm-arena";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import product from "./services/flipkart-product-spec-scrapper";
import { SpecExtractor } from "./services/flipkart-product-spec-scrapper/specs-extraction";
import { data } from "cheerio/dist/commonjs/api/attributes";

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

const health = async (req: Request, res: Response) => {
  // res.json({
  //   message: "ecomsoft is working properly please check your api",
  //   env: process.env.NODE_ENV,
  //   headers: req.headers,
  // });

  // const data = [
  //   "samsung-galaxy-a17-5g-black-256-gb/p/itm9b0b7e6d52859?pid=MOBHGVECDVCNA5JK&lid=LSTMOBHGVECDVCNA5JKQKYIG7",
  //   "motorola-g35-5g-leaf-green-128-gb/p/itma3ca32cc93927?pid=MOBH3YGPQHRSNQED&lid=LSTMOBH3YGPQHRSNQEDYQVXQ1",
  //   "poco-m7-5g-satin-black-128-gb/p/itmfcda6248f1fdd?pid=MOBH9HFJYGH7VTMD&lid=LSTMOBH9HFJYGH7VTMDVLSKLL",
  //   "xiaomi-11lite-ne-tuscany-coral-128-gb/p/itmcbb760145271b?pid=MOBGHDXFGFPZVQAT&lid=LSTMOBGHDXFGFPZVQATFU1VRO",
  //   "oneplus-nord-5-5g-phantom-grey-512-gb/p/itme333f56ade583?pid=MOBHDVHGTTQQB3FY&lid=LSTMOBHDVHGTTQQB3FYM7AL2H",
  //   "samsung-galaxy-a55-5g-awesome-iceblue-256-gb/p/itm9d66e3d4ee04f?pid=MOBGYT2H76JPBMXB&lid=LSTMOBGYT2H76JPBMXBNZZMN0",
  //   "xiaomi-14-civi-matcha-green-512-gb/p/itmc3aadec8b5596?pid=MOBHFGU7HKHZCJGE&lid=LSTMOBHFGU7HKHZCJGEVQABLU",
  //   "samsung-galaxy-s24-5g-snapdragon-cobalt-violet-128-gb/p/itm994d8dcac3256?pid=MOBHDVFKTRZHMETK&lid=LSTMOBHDVFKTRZHMETKIJ2HY7",
  //   "google-pixel-9a-obsidian-256-gb/p/itmf9d1fcfa566cf?pid=MOBH9YMEQUGCHPHN&lid=LSTMOBH9YMEQUGCHPHNSFHZNA",
  //   "oneplus-13r-5g-nebula-noir-256-gb/p/itmff6561809fab8?pid=MOBH8EWQ6GUDHGFK&lid=LSTMOBH8EWQ6GUDHGFKJOYZTU",
  //   "samsung-galaxy-a55-5g-awesome-iceblue-128-gb/p/itm0bb662185bcc4?pid=MOBGYT2HX4A4QAWW&lid=LSTMOBGYT2HX4A4QAWWGMGEQS",
  //   "google-pixel-9a-porcelain-256-gb/p/itmfe749ceddac9a?pid=MOBH9YME35EYPV4K&lid=LSTMOBH9YME35EYPV4K5K7UZW",
  //   "samsung-galaxy-s24-fe-5g-graphite-128-gb/p/itme960199e26f23?pid=MOBH4ZG33EBNZKS7&lid=LSTMOBH4ZG33EBNZKS751CITE",
  //   "samsung-galaxy-s24-fe-5g-blue-128-gb/p/itme960199e26f23?pid=MOBH4ZG3Z5NCBW2H&lid=LSTMOBH4ZG3Z5NCBW2HWQMO2K",
  //   "motorola-razr-60-pantone-gibraltar-sea-256-gb/p/itmbad80b506f2c8?pid=MOBHAYH2G8UWPFQH&lid=LSTMOBHAYH2G8UWPFQHK2YTIW",
  //   "samsung-galaxy-s24-5g-snapdragon-onyx-black-256-gb/p/itm0eb31619428e4?pid=MOBHDVFKVGGGHBDX&lid=LSTMOBHDVFKVGGGHBDXFWSCXD",
  //   "oneplus-13r-5g-astral-trail-256-gb/p/itmff6561809fab8?pid=MOBH8EVKZHTE7A32&lid=LSTMOBH8EVKZHTE7A322CFX7O",
  //   "samsung-galaxy-s24-5g-snapdragon-cobalt-violet-256-gb/p/itm0e4552c03ca7c?pid=MOBHDVFKKYGS2K9T&lid=LSTMOBHDVFKKYGS2K9TLJAFPP",
  //   "oppo-reno14-5g-forest-green-256-gb/p/itm4d9e853eee6cf?pid=MOBHDDQ9UMHXGZ8P&lid=LSTMOBHDDQ9UMHXGZ8PJXEB9R",
  //   "google-pixel-6a-chalk-128-gb/p/itme5ae89135d44e?pid=MOBGFWEZ5SKU84Z8&lid=LSTMOBGFWEZ5SKU84Z8HVX0OY",
  //   "oppo-reno14-5g-pearl-white-512-gb/p/itm4d9e853eee6cf?pid=MOBHDDQ9FRQHAGAB&lid=LSTMOBHDDQ9FRQHAGABPTTSBP",
  //   "oneplus-11-5g-marble-odyssey-256-gb/p/itm4d6999d9b201d?pid=MOBGQJJRREZMZ63N&lid=LSTMOBGQJJRREZMZ63NUBJ9IP",
  // ];

  // const data = [
  //   "google-pixel-9a-obsidian-256-gb/p/itmf9d1fcfa566cf?pid=MOBH9YMEQUGCHPHN&lid=LSTMOBH9YMEQUGCHPHNSFHZNA",
  //   "oneplus-13r-5g-nebula-noir-256-gb/p/itmff6561809fab8?pid=MOBH8EWQ6GUDHGFK&lid=LSTMOBH8EWQ6GUDHGFKQ4MCXG",
  //   "oneplus-nord-5-5g-phantom-grey-512-gb/p/itme333f56ade583?pid=MOBHDVHGTTQQB3FY&lid=LSTMOBHDVHGTTQQB3FY0YHKRL",
  //   "iqoo-neo-10-titanium-chrome-256-gb/p/itm4faf25d0485ec?pid=MOBHCJMFG5ZUY3DP&lid=LSTMOBHCJMFG5ZUY3DPE83UOD",
  //   "samsung-galaxy-a55-5g-awesome-iceblue-256-gb/p/itm9d66e3d4ee04f?pid=MOBGYT2H76JPBMXB&lid=LSTMOBGYT2H76JPBMXBLAJW4I",
  //   "oneplus-13s-5g-black-velvet-256-gb/p/itmb6d10cf953b5d?pid=MOBHCTQTGUGEJHMG&lid=LSTMOBHCTQTGUGEJHMGJPKHKD",
  //   "oneplus-11-5g-eternal-green-256-gb/p/itm668119d115289?pid=MOBGMUHCGYAU8WX6&lid=LSTMOBGMUHCGYAU8WX66ZRNGW",
  //   "oppo-reno14-5g-pearl-white-512-gb/p/itm4d9e853eee6cf?pid=MOBHDDQ9FRQHAGAB&lid=LSTMOBHDDQ9FRQHAGABPTTSBP",
  //   "google-pixel-6a-charcoal-128-gb/p/itme5ae89135d44e?pid=MOBGFKX5YUXD74Z3&lid=LSTMOBGFKX5YUXD74Z3MXA2OB",
  //   "apple-iphone-13-midnight-128-gb/p/itmca361aab1c5b0?pid=MOBG6VF5Q82T3XRS&lid=LSTMOBG6VF5Q82T3XRSSTRVFD",
  // ];

  // const allPromise = [...data].map(async (item) => {
  //   const d = await product(item, "general");
  //   console.log("ITEM", "DONE");
  //   return d;
  // });

  // const result = await Promise.allSettled(allPromise);
  const data = [
    {
      status: "fulfilled",
      value: {
        name: "Google Pixel 9A (Obsidian, 256 GB)  (8 GB RAM)",
        current_price: 44999,
        original_price: 49999,
        discounted: true,
        discount_percent: 10,
        rating: 4.4,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/google-pixel-9a-obsidian-256-gb/p/itmf9d1fcfa566cf",
        seller: {
          seller_name: "MPDSLERetail",
          seller_rating: 4.3,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/x/b/u/-original-imahadxg2fazkzub.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/cms-brand/e5e7f2f1c25176753af9c4390b9c0124712a01145d504876f32d2cac02b69eec.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/c/3/2/-original-imahadxgjufkypv5.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/x/b/u/-original-imahadxg2fazkzub.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/0/q/f/-original-imahadxg8mgjzrfh.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/c5cef226b9bd4b028b6f4b61278f1261_19589c31037_Screenshot2025-03-10at7.30.40PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/1212318f1d7b46c6a2a64ffe723e307e_19589c2f94c_Screenshot2025-03-10at7.40.19PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/a55d82fe1ab34c95b074eb2a7518c506_19589c2ef22_Screenshot2025-03-10at7.37.49PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/0415e869693a4532937fb62475a73128_19589c2e44c_Screenshot2025-03-10at7.31.18PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/3c1500cd38e2460f8f9433971ed9a178_19589c2d97e_Screenshot2025-03-10at7.34.44PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/354ce73c0f994cfd9da2b5ad1257f27a_19589c2cd42_Screenshot2025-03-10at7.32.37PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/db1ae69f9019428c9ee4b0e00f118ab1_19589c380e1_Screenshot2025-03-10at7.34.17PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/820445f5a12d417b85ea3eacfd8d73fc_19589c2e422_Screenshot2025-03-10at7.34.02PM.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/72e3327d80cc438f9c874397c02dd513_19589c35930_Screenshot2025-03-10at7.30.57PM.jpg.jpeg?q=90",
        ],
        highlights: [
          "8 GB RAM | 256 GB ROM",
          "15.96 cm (6.285 inch) Full HD+ Display",
          "48MP + 12MP | 12MP Front Camera",
          "5100 mAh Battery",
          "Tensor G4 Processor",
        ],
        product_id: "MOBH9YMEQUGCHPHN",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/c/3/2/-original-imahadxgjufkypv5.jpeg?q={@quality}",
            colorName: "Iris",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/x/b/u/-original-imahadxg2fazkzub.jpeg?q={@quality}",
            colorName: "Obsidian",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/0/q/f/-original-imahadxg8mgjzrfh.jpeg?q={@quality}",
            colorName: "Porcelain",
          },
        ],
        ramVariants: [],
        storageVariants: [],
        offers: [
          "Bank Offer : ₹5000 Off On HDFC Bank Credit Card EMI Transactions.",
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Special Price : Get extra ₹5000 off",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value: "1 Year Domestic Warranty",
              },
              {
                property: "Domestic Warranty",
                value: "1 Year",
              },
              {
                property: "Warranty Period",
                value: "1 Year",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "5100 mAh",
              },
              {
                property: "Battery Type",
                value: "UN3481",
              },
            ],
          },
          {
            title: "Dimensions",
            details: [
              {
                property: "Width",
                value: "73.25 mm",
              },
              {
                property: "Height",
                value: "154.71 mm",
              },
              {
                property: "Depth",
                value: "8.94 mm",
              },
              {
                property: "Weight",
                value: "185.89 g",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "15.96 cm (6.285 inch)",
              },
              {
                property: "Resolution",
                value: "2424 x 1080 Pixels",
              },
              {
                property: "Resolution Type",
                value: "Full HD+",
              },
              {
                property: "GPU",
                value: "Mali-G715 MP7",
              },
              {
                property: "Display Type",
                value: "Full HD+ pOLED",
              },
              {
                property: "Other Display Features",
                value:
                  "Aspect Ratio: 20:9, 2D Gorilla Glass, Luminosity: 2700 Nits, Refresh Rate: 60Hz - 120Hz",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android 15",
              },
              {
                property: "Processor Brand",
                value: "Google",
              },
              {
                property: "Processor Type",
                value: "Tensor G4",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera Available",
                value: "Yes",
              },
              {
                property: "Primary Camera",
                value: "48MP + 12MP",
              },
              {
                property: "Primary Camera Features",
                value:
                  "Dual Camera Setup: 48MP Wide Camera (OnSemi LC898129DP1XH, f/1.7 Aperture, 1/2 inch Sensor Size, Ultra HDR Resolution, 8X Zoom, Ball Type Autofocus, Features: QuadPD, 8k30, UDCG, sHDR) + 13MP Ultra WIde Camera (AKM AK7316, f/2.2 Aperture, 1/3.1 inch Sensor Size, Autofocus, Features: QuadPD, 8k30, UDCG, sHDR)",
              },
              {
                property: "Optical Zoom",
                value: "No",
              },
              {
                property: "Secondary Camera Available",
                value: "Yes",
              },
              {
                property: "Secondary Camera",
                value: "12MP Front Camera",
              },
              {
                property: "Secondary Camera Features",
                value:
                  "Front Camera: 13MP (f/2.2 Aperture, 1/3.1 inch Sensor Size, 4X Zoom, Ultra HDR)",
              },
              {
                property: "Flash",
                value: "Rear Flash",
              },
              {
                property: "Video Recording",
                value: "Yes",
              },
              {
                property: "Video Recording Resolution",
                value: "4K UHD (at 60 fps)",
              },
              {
                property: "Digital Zoom",
                value: "Yes",
              },
              {
                property: "Frame Rate",
                value: "60.0 fps",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Other Details",
            details: [
              {
                property: "Smartphone",
                value: "Yes",
              },
              {
                property: "SIM Size",
                value: "Nano Sim",
              },
              {
                property: "MMS",
                value: "Yes",
              },
              {
                property: "Graphics PPI",
                value: "422.2 PPI",
              },
              {
                property: "Sensors",
                value: "Under Display Fingerprint Sensor",
              },
              {
                property: "Upgradable Operating System",
                value: "7 Major Android Updates",
              },
              {
                property: "Other Features",
                value:
                  "Stereo Speakers, Supports Google Wallet, IP68 Rating, HDR10+, ARCore, Screen Mirroring via USB C",
              },
            ],
          },
          {
            title: "Multimedia Features",
            details: [
              {
                property: "DLNA Support",
                value: "Yes",
              },
              {
                property: "Music Player",
                value: "Yes",
              },
              {
                property: "Video Formats",
                value: "MP4",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "Google",
              },
              {
                property: "In The Box",
                value:
                  "Handset, Sim Ejector Pin, Cable (USB C to USB C), Warranty Booklet",
              },
              {
                property: "Model Number",
                value: "GA09566-IN",
              },
              {
                property: "Model Name",
                value: "Pixel 9A",
              },
              {
                property: "Color",
                value: "Obsidian",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim(Nano + eSIM)",
              },
              {
                property: "Hybrid Sim Slot",
                value: "No",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Quick Charging",
                value: "Yes",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
            ],
          },
          {
            title: "Call Features",
            details: [
              {
                property: "Video Call Support",
                value: "Yes",
              },
              {
                property: "Speaker Phone",
                value: "Yes",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "256 GB",
              },
              {
                property: "RAM",
                value: "8 GB",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "5G",
              },
              {
                property: "Supported Networks",
                value: "5G",
              },
              {
                property: "Bluetooth Support",
                value: "Yes",
              },
              {
                property: "Bluetooth Version",
                value: "v5.3",
              },
              {
                property: "Wi-Fi",
                value: "Yes",
              },
              {
                property: "Wi-Fi Hotspot",
                value: "Yes",
              },
              {
                property: "NFC",
                value: "Yes",
              },
              {
                property: "USB Connectivity",
                value: "Yes",
              },
              {
                property: "Audio Jack",
                value: "USB C",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "OnePlus 13R 5G (Nebula Noir, 256 GB)  (12 GB RAM)",
        current_price: 38937,
        original_price: 44999,
        discounted: true,
        discount_percent: 13,
        rating: 4.5,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/oneplus-13r-5g-nebula-noir-256-gb/p/itmff6561809fab8",
        seller: {
          seller_name: "SmartDealsPartner",
          seller_rating: 4.8,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/z/1/5/-original-imah8vc2a8dg7xea.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/prod-fk-cms-brand-images/a58a41ba254f8bb3cf8d32f4b9cb056dc892a6cb042273deee1d9e750d35621c.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/x/1/e/-original-imahgkgx48kvhgys.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/z/1/5/-original-imah8vc2a8dg7xea.jpeg?q=50",
        ],
        highlights: [
          "12 GB RAM | 256 GB ROM",
          "17.22 cm (6.78 inch) Display",
          "50MP Rear Camera",
          "6000 mAh Battery",
        ],
        product_id: "MOBH8EWQ6GUDHGFK",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/x/1/e/-original-imahgkgx48kvhgys.jpeg?q={@quality}",
            colorName: "Astral Trail",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/z/1/5/-original-imah8vc2a8dg7xea.jpeg?q={@quality}",
            colorName: "Nebula Noir",
          },
        ],
        ramVariants: [],
        storageVariants: [],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
          "Special Price : Get extra ₹3861 off",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value:
                  "1 year manufacturer warranty for device and 1 year manufacturer warranty for in-box accessories including batteries from the date of purchase",
              },
              {
                property: "Warranty Period",
                value: "1 Year",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "6000 mAh",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "OnePlus",
              },
              {
                property: "In The Box",
                value:
                  "13R ,SUPERVOOC Power Adapter ,Type-A to C Cable, Quick Start Guide ,Protective Case, SIM Tray Ejector",
              },
              {
                property: "Model Number",
                value: "CPH2691",
              },
              {
                property: "Model Name",
                value: "13R 5G",
              },
              {
                property: "Color",
                value: "Nebula Noir",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "No",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "17.22 cm (6.78 inch)",
              },
              {
                property: "Resolution",
                value: "2780 X 1264",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android Oxygen 15",
              },
              {
                property: "Processor Brand",
                value: "Snapdragon",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
              {
                property: "Primary Clock Speed",
                value: "3.3 GHz",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "256 GB",
              },
              {
                property: "RAM",
                value: "12 GB",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera",
                value: "50MP Rear Camera",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "5G",
              },
              {
                property: "Supported Networks",
                value: "5G, 4G VoLTE",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "OnePlus Nord 5 5G (Phantom Grey, 512 GB)  (12 GB RAM)",
        current_price: 38256,
        original_price: 40999,
        discounted: true,
        discount_percent: 6,
        rating: 4.5,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/oneplus-nord-5-5g-phantom-grey-512-gb/p/itme333f56ade583",
        seller: {
          seller_name: "Lumetra",
          seller_rating: 4.9,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/a/v/1/-original-imahgkgxn9gp4b9j.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/prod-fk-cms-brand-images/a58a41ba254f8bb3cf8d32f4b9cb056dc892a6cb042273deee1d9e750d35621c.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/b/i/o/-original-imahgkgxdvjepups.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/f/b/q/-original-imahgkgxqudkynwc.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/a/v/1/-original-imahgkgxn9gp4b9j.jpeg?q=50",
        ],
        highlights: [
          "12 GB RAM | 512 GB ROM",
          "17.35 cm (6.83 inch) Display",
          "50MP Rear Camera",
          "6800 mAh Battery",
        ],
        product_id: "MOBHDVHGTTQQB3FY",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/b/i/o/-original-imahgkgxdvjepups.jpeg?q={@quality}",
            colorName: "Dry Ice",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/f/b/q/-original-imahgkgxqudkynwc.jpeg?q={@quality}",
            colorName: "Marble Sands",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/a/v/1/-original-imahgkgxn9gp4b9j.jpeg?q={@quality}",
            colorName: "Phantom Grey",
          },
        ],
        ramVariants: ["8 GB", "12 GB"],
        storageVariants: ["256 GB", "512 GB"],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
          "Bank Offer : Up To ₹50 Cashback on BHIM Payments App. Min Order Value ₹199. Offer Valid Once Per User",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value: "1 Year Warranty",
              },
              {
                property: "Warranty Period",
                value: "12 Months",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "6800 mAh",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "OnePlus",
              },
              {
                property: "In The Box",
                value:
                  "Handset, Power Adapter, SIM Tray Ejector, Phone Case, USB Cable",
              },
              {
                property: "Model Number",
                value: "CPH2707",
              },
              {
                property: "Model Name",
                value: "Nord 5 5G",
              },
              {
                property: "Color",
                value: "Phantom Grey",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "Yes",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "17.35 cm (6.83 inch)",
              },
              {
                property: "Resolution",
                value: "2800*1272$$ Pixel",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android Oxygen 15",
              },
              {
                property: "Processor Brand",
                value: "Snapdragon",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
              {
                property: "Primary Clock Speed",
                value: "3 GHz",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "512 GB",
              },
              {
                property: "RAM",
                value: "12 GB",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera",
                value: "50MP Rear Camera",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "2G, 3G, 4G, 5G",
              },
              {
                property: "Supported Networks",
                value: "5G",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "IQOO Neo 10 (Titanium Chrome, 256 GB)  (12 GB RAM)",
        current_price: 40978,
        original_price: 40999,
        discounted: true,
        discount_percent: 0,
        rating: 4.5,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/iqoo-neo-10-titanium-chrome-256-gb/p/itm4faf25d0485ec",
        seller: {
          seller_name: "Phonologic",
          seller_rating: 4.8,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/s/d/e/-original-imahdjgufajggchq.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/c/s/r/neo-10-i2405-iqoo-original-imahcgtx6xwxzydz.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/s/d/e/-original-imahdjgufajggchq.jpeg?q=50",
        ],
        highlights: [
          "12 GB RAM | 256 GB ROM",
          "17.22 cm (6.78 inch) Full HD+ E3 Super AMOLED Display",
          "50MP + 50MP + 8MP | 32MP + 32MP Dual Front Camera",
          "7000 mAh Battery",
          "Qualcomm Processor",
        ],
        product_id: "MOBHCJMFG5ZUY3DP",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/c/s/r/neo-10-i2405-iqoo-original-imahcgtx6xwxzydz.jpeg?q={@quality}",
            colorName: "Inferno Red",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/s/d/e/-original-imahdjgufajggchq.jpeg?q={@quality}",
            colorName: "Titanium Chrome",
          },
        ],
        ramVariants: ["8 GB", "12 GB", "16 GB"],
        storageVariants: ["128 GB", "256 GB", "512 GB"],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
          "Bank Offer : Up To ₹50 Cashback on BHIM Payments App. Min Order Value ₹199. Offer Valid Once Per User",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value:
                  "Domestic warranty 1 year for handset and 6 months for accessories",
              },
              {
                property: "Warranty Service Type",
                value: "Manufacturing",
              },
              {
                property: "Covered in Warranty",
                value:
                  "Domestic warranty 1 year for handset and 6 months for accessories",
              },
              {
                property: "Domestic Warranty",
                value: "1 Year",
              },
              {
                property: "International Warranty",
                value: "1 Year",
              },
              {
                property: "Warranty Period",
                value: "1 Year",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "7000 mAh",
              },
              {
                property: "Battery Type",
                value: "Li-ion",
              },
              {
                property: "Dual Battery",
                value: "No",
              },
            ],
          },
          {
            title: "Dimensions",
            details: [
              {
                property: "Width",
                value: "75.88 mm",
              },
              {
                property: "Height",
                value: "163.72 mm",
              },
              {
                property: "Depth",
                value: "8.09 mm",
              },
              {
                property: "Weight",
                value: "206 g",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "17.22 cm (6.78 inch)",
              },
              {
                property: "Resolution",
                value: "2800 × 1260",
              },
              {
                property: "Resolution Type",
                value: "Full HD+ E3 Super AMOLED Display",
              },
              {
                property: "GPU",
                value: "Adreno 825",
              },
              {
                property: "Display Type",
                value: "Amoled",
              },
              {
                property: "HD Game Support",
                value: "Yes",
              },
              {
                property: "Display Colors",
                value: "10Bit",
              },
              {
                property: "Other Display Features",
                value: "wireless",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android Oxygen 15",
              },
              {
                property: "Processor Brand",
                value: "Snapdragon",
              },
              {
                property: "Processor Type",
                value: "Qualcomm",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
              {
                property: "Primary Clock Speed",
                value: "3.2 GHz",
              },
              {
                property: "Secondary Clock Speed",
                value: "2.8 GHz",
              },
              {
                property: "Tertiary Clock Speed",
                value: "2.01 GHz",
              },
              {
                property: "Operating Frequency",
                value:
                  "2G GSM: 850/900/1800MHz\n3G WCDMA: B1/B5/B6/B8/B19\n4G FDD-LTE: B1/B3/B5/B7/B8/B18/B19/B20/B26/B28A/B28B\n4G TDD-LTE: B38/B40/B41/B42/B48\n5G-\nSA: n1/n3/n5/n7/n8/n18/n20/n26/n28A/n28B/n38/n40/n41/n48/n77/n78 | NSA: n1/n3/n5/n7/n8/n20/n28A/n28B/n38/n40/n41/n77/n78",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera Available",
                value: "Yes",
              },
              {
                property: "Primary Camera",
                value: "50MP + 50MP + 8MP",
              },
              {
                property: "Primary Camera Features",
                value:
                  '50MP (1/1.953" Portrait Camera), 8 MP (Ultra Wide-Angle)',
              },
              {
                property: "Optical Zoom",
                value: "Yes",
              },
              {
                property: "Secondary Camera Available",
                value: "Yes",
              },
              {
                property: "Secondary Camera",
                value: "32MP + 32MP Dual Front Camera",
              },
              {
                property: "Secondary Camera Features",
                value: "32MP",
              },
              {
                property: "Flash",
                value: "LED Flash",
              },
              {
                property: "HD Recording",
                value: "Yes",
              },
              {
                property: "Full HD Recording",
                value: "Yes",
              },
              {
                property: "Video Recording",
                value: "Yes",
              },
              {
                property: "Video Recording Resolution",
                value: "4k@60fps",
              },
              {
                property: "Frame Rate",
                value: "60/30fps fps",
              },
              {
                property: "Image Editor",
                value: "Yes",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Other Details",
            details: [
              {
                property: "Smartphone",
                value: "Yes",
              },
              {
                property: "Touchscreen Type",
                value: "capacitive",
              },
              {
                property: "SIM Size",
                value: "Dual nano",
              },
              {
                property: "Keypad Type",
                value: "QWERTY",
              },
              {
                property: "User Interface",
                value: "Funtouch Os 15",
              },
              {
                property: "Social Networking Phone",
                value: "Yes",
              },
              {
                property: "Instant Message",
                value: "Yes",
              },
              {
                property: "Business Phone",
                value: "Yes",
              },
              {
                property: "Removable Battery",
                value: "No",
              },
              {
                property: "MMS",
                value: "Yes",
              },
              {
                property: "SMS",
                value: "Yes",
              },
              {
                property: "Keypad",
                value: "Yes",
              },
              {
                property: "Voice Input",
                value: "Yes",
              },
              {
                property: "Graphics PPI",
                value: "450 ppi",
              },
              {
                property: "Predictive Text Input",
                value: "Yes",
              },
              {
                property: "SIM Access",
                value: "Dual standby",
              },
              {
                property: "Sensors",
                value:
                  "Accelerometer,Ambient Light Sensor,Proximity Sensor,E-compass,Gyroscope,Infrared",
              },
              {
                property: "Series",
                value: "Iqoo Neo 10",
              },
              {
                property: "Browser",
                value: "chrome",
              },
              {
                property: "Ringtones Format",
                value: ".MP3, .WAV & OGG",
              },
              {
                property: "GPS Type",
                value: "GPS;GLONASS;GALILEO;BeiDou;NavIC;GNSS, QZSS",
              },
            ],
          },
          {
            title: "Multimedia Features",
            details: [
              {
                property: "Audio Formats",
                value: "MP3,WAV,FLAC,AAC",
              },
              {
                property: "Video Formats",
                value: "MP4",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "IQOO",
              },
              {
                property: "In The Box",
                value:
                  "Quick Start Guide , Charger , USB Cable , Phone Case , Phone , Eject tool , Warranty card",
              },
              {
                property: "Model Number",
                value: "‎I2405",
              },
              {
                property: "Model Name",
                value: "Neo 10",
              },
              {
                property: "Color",
                value: "Titanium Chrome",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "Yes",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Quick Charging",
                value: "Yes",
              },
              {
                property: "Additional Content",
                value:
                  "Quick Start Guide | Charger | USB Cable | Phone Case | Phone | Eject tool | Warranty card",
              },
              {
                property: "Notch Design",
                value: "Punch Hole",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Dolby Speakers",
                value: "Yes",
              },
              {
                property: "Charging Time",
                value: "36",
              },
              {
                property: "Phablet",
                value: "No",
              },
              {
                property: "RAM Type",
                value: "LPDDR5X Ultra",
              },
            ],
          },
          {
            title: "Call Features",
            details: [
              {
                property: "Call Wait/Hold",
                value: "Yes",
              },
              {
                property: "Conference Call",
                value: "Yes",
              },
              {
                property: "Hands Free",
                value: "Yes",
              },
              {
                property: "Video Call Support",
                value: "Yes",
              },
              {
                property: "Call Divert",
                value: "Yes",
              },
              {
                property: "Call Timer",
                value: "Yes",
              },
              {
                property: "Speaker Phone",
                value: "Yes",
              },
              {
                property: "Speed Dialing",
                value: "Yes",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "256 GB",
              },
              {
                property: "RAM",
                value: "12 GB",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "5G, 4G, 3G, 2G",
              },
              {
                property: "Supported Networks",
                value: "5G, 4G LTE, WCDMA, GSM",
              },
              {
                property: "GPRS",
                value: "Yes",
              },
              {
                property: "WAP",
                value: "Yes",
              },
              {
                property: "Micro USB Port",
                value: "Yes",
              },
              {
                property: "Micro USB Version",
                value: "2.0",
              },
              {
                property: "Bluetooth Support",
                value: "Yes",
              },
              {
                property: "Bluetooth Version",
                value: "v5.4",
              },
              {
                property: "Wi-Fi",
                value: "Yes",
              },
              {
                property: "Wi-Fi Version",
                value: "7",
              },
              {
                property: "NFC",
                value: "Yes",
              },
              {
                property: "USB Tethering",
                value: "Yes",
              },
              {
                property: "Infrared",
                value: "Yes",
              },
              {
                property: "USB Connectivity",
                value: "Yes",
              },
              {
                property: "Map Support",
                value: "Google Maps",
              },
              {
                property: "GPS Support",
                value: "Yes",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "Samsung Galaxy A55 5G (Awesome Iceblue, 256 GB)  (12 GB RAM)",
        current_price: 33990,
        original_price: 48999,
        discounted: true,
        discount_percent: 30,
        rating: 4.3,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/samsung-galaxy-a55-5g-awesome-iceblue-256-gb/p/itm9d66e3d4ee04f",
        seller: {
          seller_name: "Phonologic",
          seller_rating: 4.8,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/8/c/j/-original-imahbzpyfv8gpku7.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/prod-fk-cms-brand-images/9a95c8afa921a5b7f48302b1cb9d994a0a5e9f5b718ebab4affbae158c9a0068.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/8/c/j/-original-imahbzpyfv8gpku7.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/q/q/t/-original-imahbzpzhcptykzf.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/08f140bae974423788d4f6eb4741cc73_19666543f85_1.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/f9c4fc86bbb8454b890ca095e2a92b3e_19666546d35_2.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/ad0b9df2b1534c7f94793b38ef804d87_1966654a584_4.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/228fa9c8308d4d749357d9831ca498c4_1966654b978_5.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/a337fbc92f2e4fc29803742b196b295a_1966654dce3_6.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/423eb6070add42d78b37577a4eb91174_1966654fe40_7.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/68dcac262d3942be91c609bb16b50fb0_19666550f99_8.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/c7000311d0ad4b2fb91e9588d76a044e_19666552552_9.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/7e89ba6fc721434eadcae93fcdef5555_19666553761_10.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/84fa247b55c1421d9896e8f71670ac3a_19666554fab_11.jpg.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/cc9aeb8988354bb8a6ed3876ee5db486_19666556f52_12.jpg.jpeg?q=90",
        ],
        highlights: [
          "12 GB RAM | 256 GB ROM | Expandable Upto 1 TB",
          "16.76 cm (6.6 inch) Full HD+ Display",
          "50MP + 12MP + 5MP | 32MP Front Camera",
          "5000 mAh Battery",
          "Exynos 1480 Processor",
        ],
        product_id: "MOBGYT2H76JPBMXB",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/8/c/j/-original-imahbzpyfv8gpku7.jpeg?q={@quality}",
            colorName: "Awesome Iceblue",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/q/q/t/-original-imahbzpzhcptykzf.jpeg?q={@quality}",
            colorName: "Awesome Navy",
          },
        ],
        ramVariants: ["8 GB", "12 GB"],
        storageVariants: ["128 GB", "256 GB"],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
          "Special Price : Get extra ₹3005 off",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value:
                  "1 Year Manufacturer Warranty for Device and 6 Months for In-Box Accessories",
              },
              {
                property: "Covered in Warranty",
                value: "Manufacturing Defects Only",
              },
              {
                property: "Domestic Warranty",
                value: "1 Year",
              },
              {
                property: "Warranty Period",
                value: "1 Year",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "5000 mAh",
              },
              {
                property: "Battery Type",
                value: "Lithium-ion",
              },
              {
                property: "Dual Battery",
                value: "No",
              },
            ],
          },
          {
            title: "Dimensions",
            details: [
              {
                property: "Width",
                value: "77.4 mm",
              },
              {
                property: "Height",
                value: "161.1 mm",
              },
              {
                property: "Depth",
                value: "8.2 mm",
              },
              {
                property: "Weight",
                value: "213 g",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "16.76 cm (6.6 inch)",
              },
              {
                property: "Resolution",
                value: "2340 x 1080 Pixels",
              },
              {
                property: "Resolution Type",
                value: "Full HD+",
              },
              {
                property: "GPU",
                value: "AMD Titan",
              },
              {
                property: "Display Type",
                value: "Full HD+ Super AMOLED",
              },
              {
                property: "HD Game Support",
                value: "Yes",
              },
              {
                property: "Display Colors",
                value: "16 Million",
              },
              {
                property: "Other Display Features",
                value:
                  "Aspect Ratio: 19.5:9, 120Hz Refresh Rate, Corning Gorilla Glass Victus+",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android 14",
              },
              {
                property: "Processor Brand",
                value: "Exynos",
              },
              {
                property: "Processor Type",
                value: "Exynos 1480",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
              {
                property: "Primary Clock Speed",
                value: "2.75 GHz",
              },
              {
                property: "Secondary Clock Speed",
                value: "2 GHz",
              },
              {
                property: "Operating Frequency",
                value:
                  "N1(2100)/N3(1800)/N5(850)/N7(2600)/N8(900)/N26(850)/N28(700)/N66(AWS-3)",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera Available",
                value: "Yes",
              },
              {
                property: "Primary Camera",
                value: "50MP + 12MP + 5MP",
              },
              {
                property: "Primary Camera Features",
                value:
                  "Triple Camera Setup: 50MP + 12MP + 5MP, Features: AR Zone, Bixby Vision, Food, Fun, Hyperlapse, Macro, Night, Panorama, Photo, Portrait, Pro, Pro Video, Single Take, Slow Motion, Super Slow-Mo, Video",
              },
              {
                property: "Optical Zoom",
                value: "No",
              },
              {
                property: "Secondary Camera Available",
                value: "Yes",
              },
              {
                property: "Secondary Camera",
                value: "32MP Front Camera",
              },
              {
                property: "Secondary Camera Features",
                value: "Front Camera Setup: 32MP Camera, Features: Fixed Focus",
              },
              {
                property: "Flash",
                value: "Rear Flash",
              },
              {
                property: "HD Recording",
                value: "Yes",
              },
              {
                property: "Full HD Recording",
                value: "Yes",
              },
              {
                property: "Video Recording",
                value: "Yes",
              },
              {
                property: "Video Recording Resolution",
                value: "UHD 4K (3840 x 2160) (at 30 fps)",
              },
              {
                property: "Digital Zoom",
                value: "Upto 10X",
              },
              {
                property: "Frame Rate",
                value: "30 fps",
              },
              {
                property: "Image Editor",
                value: "Yes",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Other Details",
            details: [
              {
                property: "Smartphone",
                value: "Yes",
              },
              {
                property: "Touchscreen Type",
                value: "Full Touch Capacitance",
              },
              {
                property: "SIM Size",
                value: "Nano Sim",
              },
              {
                property: "Mobile Tracker",
                value: "No",
              },
              {
                property: "Social Networking Phone",
                value: "Yes",
              },
              {
                property: "Instant Message",
                value: "Yes",
              },
              {
                property: "Business Phone",
                value: "No",
              },
              {
                property: "Removable Battery",
                value: "No",
              },
              {
                property: "MMS",
                value: "Yes",
              },
              {
                property: "SMS",
                value: "Yes",
              },
              {
                property: "Keypad",
                value: "No",
              },
              {
                property: "Voice Input",
                value: "Yes",
              },
              {
                property: "Graphics PPI",
                value: "389 PPI",
              },
              {
                property: "Predictive Text Input",
                value: "Yes",
              },
              {
                property: "User Memory",
                value: "219.0",
              },
              {
                property: "SIM Access",
                value: "Dual/Single",
              },
              {
                property: "Sensors",
                value:
                  "Accelerometer, Fingerprint Sensor, Gyro Sensor, Geomagnetic Sensor, Hall Sensor, Light Sensor, Virtual Proximity Sensing",
              },
              {
                property: "Upgradable Operating System",
                value: "4 OS Upgrade Expectation Count",
              },
              {
                property: "Browser",
                value: "Go",
              },
              {
                property: "Ringtones Format",
                value: "MP3, M4A",
              },
            ],
          },
          {
            title: "Multimedia Features",
            details: [
              {
                property: "FM Radio",
                value: "No",
              },
              {
                property: "FM Radio Recording",
                value: "No",
              },
              {
                property: "DLNA Support",
                value: "No",
              },
              {
                property: "Audio Formats",
                value: "MP3, M4A,",
              },
              {
                property: "Music Player",
                value: "Yes",
              },
              {
                property: "Video Formats",
                value: "MP4, M4V, 3GP, 3G2, AVI, FLV, MKV, WEBM",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "Samsung",
              },
              {
                property: "In The Box",
                value:
                  "Handset, Data Cable(C to C), Sim Ejection Pin, Quick Start Guide",
              },
              {
                property: "Model Number",
                value: "SM-A556ELBHINS",
              },
              {
                property: "Model Name",
                value: "Galaxy A55 5G",
              },
              {
                property: "Color",
                value: "Awesome Iceblue",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "Yes",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Quick Charging",
                value: "Yes",
              },
              {
                property: "Notch Design",
                value: "Punch Hole",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Dolby Speakers",
                value: "Yes",
              },
              {
                property: "User Available Internal Memory",
                value: "219 GB",
              },
              {
                property: "Phablet",
                value: "No",
              },
              {
                property: "RAM Type",
                value: "LPDDR5",
              },
            ],
          },
          {
            title: "Call Features",
            details: [
              {
                property: "Call Wait/Hold",
                value: "Yes",
              },
              {
                property: "Conference Call",
                value: "Yes",
              },
              {
                property: "Hands Free",
                value: "Yes",
              },
              {
                property: "Video Call Support",
                value: "Yes",
              },
              {
                property: "Call Divert",
                value: "Yes",
              },
              {
                property: "Phone Book",
                value: "Yes",
              },
              {
                property: "Call Timer",
                value: "Yes",
              },
              {
                property: "Speaker Phone",
                value: "Yes",
              },
              {
                property: "Speed Dialing",
                value: "Yes",
              },
              {
                property: "Call Records",
                value: "Outgoing, Missed",
              },
              {
                property: "Logs",
                value:
                  "Incoming Calls, Outgoing Calls, Missed Calls, Spam Calls",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "256 GB",
              },
              {
                property: "RAM",
                value: "12 GB",
              },
              {
                property: "Total Memory",
                value: "256 GB",
              },
              {
                property: "Expandable Storage",
                value: "1 TB",
              },
              {
                property: "Supported Memory Card Type",
                value: "MicroSD",
              },
              {
                property: "Memory Card Slot Type",
                value: "Hybrid Slot",
              },
              {
                property: "Phone Book Memory",
                value: "Yes",
              },
              {
                property: "Call Log Memory",
                value: "Yes",
              },
              {
                property: "SMS Memory",
                value: "Yes",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "2G, 3G, 4G, 5G",
              },
              {
                property: "Supported Networks",
                value: "4G LTE, 5G, GSM, WCDMA",
              },
              {
                property: "Internet Connectivity",
                value: "5G, 4G LTE, 3G, 2G, Wi-Fi, GPRS",
              },
              {
                property: "3G",
                value: "Yes",
              },
              {
                property: "3G Speed",
                value: "HSPA+ 42.2, 5.76 Mbps",
              },
              {
                property: "GPRS",
                value: "Yes",
              },
              {
                property: "Pre-installed Browser",
                value: "Google Chrome | Samsung Internet",
              },
              {
                property: "Micro USB Port",
                value: "Yes",
              },
              {
                property: "Micro USB Version",
                value: "USB 2.0",
              },
              {
                property: "Mini USB Port",
                value: "No",
              },
              {
                property: "Bluetooth Support",
                value: "Yes",
              },
              {
                property: "Bluetooth Version",
                value: "v5.3",
              },
              {
                property: "Wi-Fi",
                value: "Yes",
              },
              {
                property: "Wi-Fi Version",
                value:
                  "802.11 a/b/g/n/ac/ax (2.4 GHz | 5 GHz), HE80, MIMO, 1024-QAM",
              },
              {
                property: "Wi-Fi Hotspot",
                value: "Yes",
              },
              {
                property: "Mini HDMI Port",
                value: "No",
              },
              {
                property: "NFC",
                value: "No",
              },
              {
                property: "USB Tethering",
                value: "Yes",
              },
              {
                property: "TV Out",
                value: "No",
              },
              {
                property: "Infrared",
                value: "No",
              },
              {
                property: "USB Connectivity",
                value: "Yes",
              },
              {
                property: "Audio Jack",
                value: "USB Type-C",
              },
              {
                property: "Map Support",
                value: "Google Maps",
              },
              {
                property: "GPS Support",
                value: "Yes",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "OnePlus 13s 5G (Black Velvet, 256 GB)  (12 GB RAM)",
        current_price: 52429,
        original_price: 57999,
        discounted: true,
        discount_percent: 9,
        rating: 4.5,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/oneplus-13s-5g-black-velvet-256-gb/p/itmb6d10cf953b5d",
        seller: {
          seller_name: "SmartDealsPartner",
          seller_rating: 4.8,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/z/m/3/13s-5g-cph2723-oneplus-original-imahctqtzhtfzbhf.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/prod-fk-cms-brand-images/a58a41ba254f8bb3cf8d32f4b9cb056dc892a6cb042273deee1d9e750d35621c.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/z/m/3/13s-5g-cph2723-oneplus-original-imahctqtzhtfzbhf.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/4/o/w/13s-5g-cph2723-oneplus-original-imahctqt6mkuxrzw.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/f/u/v/13s-cph2723-realme-original-imahctwyv9gvhcds.jpeg?q=50",
        ],
        highlights: [
          "12 GB RAM | 256 GB ROM",
          "16.05 cm (6.32 inch) Display",
          "50MP Rear Camera",
          "5850 mAh Battery",
        ],
        product_id: "MOBHCTQTGUGEJHMG",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/z/m/3/13s-5g-cph2723-oneplus-original-imahctqtzhtfzbhf.jpeg?q={@quality}",
            colorName: "Black Velvet",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/4/o/w/13s-5g-cph2723-oneplus-original-imahctqt6mkuxrzw.jpeg?q={@quality}",
            colorName: "Green Silk",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/f/u/v/13s-cph2723-realme-original-imahctwyv9gvhcds.jpeg?q={@quality}",
            colorName: "Pink Satin",
          },
        ],
        ramVariants: [],
        storageVariants: ["256 GB", "512 GB"],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
          "Special Price : Get extra ₹5570 off",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value: "1 Year Warranty",
              },
              {
                property: "Warranty Period",
                value: "12 Months",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "5850 mAh",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "OnePlus",
              },
              {
                property: "In The Box",
                value:
                  "Handset, Power Adapter, SIM Tray Ejector, Phone Case, Screen Protector, USB Cable",
              },
              {
                property: "Model Number",
                value: "CPH2723",
              },
              {
                property: "Model Name",
                value: "13s 5G",
              },
              {
                property: "Color",
                value: "Black Velvet",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "Yes",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "16.05 cm (6.32 inch)",
              },
              {
                property: "Resolution",
                value: "2640*1216$$ Pixel",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android Oxygen 15",
              },
              {
                property: "Processor Brand",
                value: "Snapdragon",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
              {
                property: "Primary Clock Speed",
                value: "4.32 GHz",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "256 GB",
              },
              {
                property: "RAM",
                value: "12 GB",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera",
                value: "50MP Rear Camera",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "2G, 3G, 4G, 5G",
              },
              {
                property: "Supported Networks",
                value: "5G",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "OnePlus 11 5G (Eternal Green, 256 GB)  (16 GB RAM)",
        current_price: 39110,
        original_price: 61999,
        discounted: true,
        discount_percent: 36,
        rating: 4.5,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/oneplus-11-5g-eternal-green-256-gb/p/itm668119d115289",
        seller: {
          seller_name: "VTMPVTLTD",
          seller_rating: 4.8,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/b/n/y/11-5g-cph2447-oneplus-original-imah4fq3cywdrqvf.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/prod-fk-cms-brand-images/a58a41ba254f8bb3cf8d32f4b9cb056dc892a6cb042273deee1d9e750d35621c.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/b/n/y/11-5g-cph2447-oneplus-original-imah4fq3cywdrqvf.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/c/2/a/11-5g-cph2447-oneplus-original-imagqjjruwa6gauc.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/screen-guard/edge-to-edge-tempered-glass/p/n/8/uv-glass-1plus-11-5g-s3-snmart-original-imah39bvkby8vjeh.jpeg?q=50",
        ],
        highlights: [
          "16 GB RAM | 256 GB ROM",
          "17.02 cm (6.7 inch) Display",
          "50MP Rear Camera",
          "5000 mAh Battery",
        ],
        product_id: "MOBGMUHCGYAU8WX6",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/b/n/y/11-5g-cph2447-oneplus-original-imah4fq3cywdrqvf.jpeg?q={@quality}",
            colorName: "Eternal Green",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/c/2/a/11-5g-cph2447-oneplus-original-imagqjjruwa6gauc.jpeg?q={@quality}",
            colorName: "Marble Odyssey",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/screen-guard/edge-to-edge-tempered-glass/p/n/8/uv-glass-1plus-11-5g-s3-snmart-original-imah39bvkby8vjeh.jpeg?q={@quality}",
            colorName: "Titan Black",
          },
        ],
        ramVariants: ["8 GB", "16 GB"],
        storageVariants: ["128 GB", "256 GB"],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
          "Special Price : Get extra ₹3889 off",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value:
                  "domestic warranty of 12 months on phone & 6 months on accessories",
              },
              {
                property: "Warranty Service Type",
                value: "NA",
              },
              {
                property: "Warranty Period",
                value: "12 Months",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "5000 mAh",
              },
              {
                property: "Battery Type",
                value: "NA",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "OnePlus",
              },
              {
                property: "In The Box",
                value:
                  "Data cable, Quick Guide, SIM ejector tool, Protective case,Charger, user guide & phone",
              },
              {
                property: "Model Number",
                value: "CPH2447",
              },
              {
                property: "Model Name",
                value: "11 5G",
              },
              {
                property: "Color",
                value: "Eternal Green",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "No",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "17.02 cm (6.7 inch)",
              },
              {
                property: "Resolution",
                value: "3216x1440",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android OxygenOS based on Android 13",
              },
              {
                property: "Processor Brand",
                value: "Snapdragon",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
              {
                property: "Primary Clock Speed",
                value: "3.2 GHz",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "256 GB",
              },
              {
                property: "RAM",
                value: "16 GB",
              },
              {
                property: "Memory Card Slot Type",
                value: "Dedicated Slot",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera",
                value: "50MP Rear Camera",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "5G",
              },
              {
                property: "Supported Networks",
                value: "5G",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "OPPO Reno14 5G (Pearl White, 512 GB)  (12 GB RAM)",
        current_price: 44999,
        original_price: 47999,
        discounted: true,
        discount_percent: 6,
        rating: 4.5,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/oppo-reno14-5g-pearl-white-512-gb/p/itm4d9e853eee6cf",
        seller: {
          seller_name: "XONIGHT E-Commerce",
          seller_rating: 4.7,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/3/f/o/-original-imahfbycehzhzdun.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/prod-fk-cms-brand-images/27c267d3af3f52088640d24dc2872abd23d2713e6e6fb6dc4f3034e416e5b541.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/q/l/t/-original-imahfbycas2qckgk.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/t/m/r/-original-imahfbyczstvdyz2.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/3/f/o/-original-imahfbycehzhzdun.jpeg?q=50",
        ],
        highlights: [
          "12 GB RAM | 512 GB ROM",
          "16.74 cm (6.59 inch) Display",
          "50MP + 8MP + 50MP | 50MP Front Camera",
          "6000 mAh Battery",
          "Dimensity 8350 Processor",
        ],
        product_id: "MOBHDDQ9FRQHAGAB",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/q/l/t/-original-imahfbycas2qckgk.jpeg?q={@quality}",
            colorName: "Forest Green",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/t/m/r/-original-imahfbyczstvdyz2.jpeg?q={@quality}",
            colorName: "Mint Green",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/3/f/o/-original-imahfbycehzhzdun.jpeg?q={@quality}",
            colorName: "Pearl White",
          },
        ],
        ramVariants: ["8 GB", "12 GB"],
        storageVariants: ["256 GB", "512 GB"],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
        ],
        specs: [
          {
            title: "Other Details",
            details: [
              {
                property: "Smartphone",
                value: "Yes",
              },
              {
                property: "SIM Size",
                value: "Nano Sim",
              },
              {
                property: "User Interface",
                value: "ColorOS 15.0 (Based on Android 15)",
              },
              {
                property: "SMS",
                value: "Yes",
              },
              {
                property: "Graphics PPI",
                value: "460 PPI",
              },
              {
                property: "Sensors",
                value:
                  "Proximity Sensor, Ambient Light Sensor, E-Compass, Accelerometer, Gyroscope, In Display Optical Fingerprint Sensor, Infrared Remote Control",
              },
              {
                property: "Other Features",
                value:
                  "UFS 3.1 ROM, Biometrics: Fingerprint, Facial Recognition, Bluetooth Audio Codec: SBC, AAC, aptX, aptX HD, LDAC, LHDC 5.0",
              },
              {
                property: "GPS Type",
                value:
                  "BEIDOU, GPS, GLONASS, GALILEO, QZSS, Supports A-GNSS Assisted Positioning, WLAN Positioning, Cellular Network Positioning",
              },
            ],
          },
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value:
                  "1 Year Manufacturer Warranty for Device and 6 Months Manufacturer Warranty for Inbox Accessories",
              },
              {
                property: "Domestic Warranty",
                value: "1 Year",
              },
              {
                property: "Warranty Period",
                value: "1 Year",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "6000 mAh",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "OPPO",
              },
              {
                property: "In The Box",
                value:
                  "Handset, USB Data Cable, Charger, Sim Ejector Tool, Protective Case, Quick Guide, Safety Guide",
              },
              {
                property: "Model Number",
                value: "CPH2737",
              },
              {
                property: "Model Name",
                value: "Reno14 5G",
              },
              {
                property: "Color",
                value: "Pearl White",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "Yes",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Quick Charging",
                value: "Yes",
              },
              {
                property: "Notch Design",
                value: "Punch Hole",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
              {
                property: "RAM Type",
                value: "LPDDR5X",
              },
            ],
          },
          {
            title: "Dimensions",
            details: [
              {
                property: "Width",
                value: "74.73 mm",
              },
              {
                property: "Height",
                value: "157.9 mm",
              },
              {
                property: "Depth",
                value: "7.42 mm",
              },
              {
                property: "Weight",
                value: "187 g",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "16.74 cm (6.59 inch)",
              },
              {
                property: "Resolution",
                value: "2760 x 1256 Pixels",
              },
              {
                property: "GPU",
                value: "ARM G615 MC6",
              },
              {
                property: "Display Type",
                value: "AMOLED Flexible",
              },
              {
                property: "Display Colors",
                value: "1.07 Billion Colors (10 Bit)",
              },
              {
                property: "Other Display Features",
                value:
                  "Screen Ratio: 93.4%, Refresh Rate: 120Hz, Touch Sampling Rate: 240Hz (Maximum), 120Hz (Default), Color Gamut: 100% DCI-P3 (Natural Mode), 100% DCI-P3 (Pro Mode), 100% DCI-P3 (Vivid Mode), Brightness: 600nits (Normal), 1200nits (HBM), Corning Gorilla Glass 7i",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android 15",
              },
              {
                property: "Processor Brand",
                value: "Mediatek",
              },
              {
                property: "Processor Type",
                value: "Dimensity 8350",
              },
              {
                property: "Processor Core",
                value: "Octa Core",
              },
              {
                property: "Primary Clock Speed",
                value: "3.35 GHz",
              },
              {
                property: "Secondary Clock Speed",
                value: "3.2 GHz",
              },
              {
                property: "Tertiary Clock Speed",
                value: "2.2 GHz",
              },
              {
                property: "Operating Frequency",
                value:
                  "2G GSM: 850 MHz/900 MHz/1800 MHz/1900 MHz, 3G WCDMA: B1/B2/B4/B5/B6/B8/B19, 4G LTE FDD: B1/B2/B3/B4/B5/B7/B8/B12/B13/B17/B18/B19/B20/B26/B28/B32/B66, 4G LTE TDD: B38/B39/B40/B41, 5G NR: n1/n2/n3/n5/n7/n8/n12/n20/n26/n28/n38/n40/n41/n66/n77/n78",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "512 GB",
              },
              {
                property: "RAM",
                value: "12 GB",
              },
              {
                property: "Memory Card Slot Type",
                value: "Hybrid Slot",
              },
              {
                property: "Call Log Memory",
                value: "Yes",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera Available",
                value: "Yes",
              },
              {
                property: "Primary Camera",
                value: "50MP + 8MP + 50MP",
              },
              {
                property: "Primary Camera Features",
                value:
                  "Triple Camera Setup: 50MP Wide Angle Camera (f/1.8 Aperture, FOV: 79 Degree, 5P Lens, Auto Focus Supported, 2-Axis OIS Supported) + 8MP Ultra Wide Angle Camera (f/2.2 Aperture, FOV: 116 Degree, 5P Lens, Auto Focus Supported) + 50MP Telephoto Camera (f/2.8 Aperture, FOV: 30 Degree, 4P Lens, Auto Focus Supported, 2-Axis OIS Supported), Features: Photo, Video, Portrait, Night, Pro, Pano, Slo-Mo, Dual View Video, Timelapse, Sticker, Hi-Res, Underwater, Breeno Scan, Google Lens",
              },
              {
                property: "Optical Zoom",
                value: "Yes",
              },
              {
                property: "Secondary Camera Available",
                value: "Yes",
              },
              {
                property: "Secondary Camera",
                value: "50MP Front Camera",
              },
              {
                property: "Secondary Camera Features",
                value:
                  "Front Camera Setup: 50MP Camera (f/2.0 Aperture, FOV: 90 Degree, 5P Lens, Auto Focus Supported), Features: Photo, Video, Portrait, Night, Pano, Dual View Video, Timelapse, Sticker, Retouch, Screen Fill Light, Hi-Res",
              },
              {
                property: "HD Recording",
                value: "Yes",
              },
              {
                property: "Full HD Recording",
                value: "Yes",
              },
              {
                property: "Video Recording",
                value: "Yes",
              },
              {
                property: "Video Recording Resolution",
                value:
                  "Rear Camera: 4K (at 60 fps/at 30 fps), 1080P (at 60 fps/at 30 fps), 720P (at 30 fps), 4K EIS/OIS (at 60 fps/at 30 fps), 1080P EIS/OIS (at 60 fps/at 30 fps), 1080P Slo-Mo (at 480 fps/at 120 fps), 720P Slo-Mo (at 960 fps/at 240 fps), 4K Timelapse (at 30 fps), 1080P Timelapse (at 30 fps), Support Underwater Video Shooting, Support Dual View Video Shooting, Support HDR Video Shooting, Support Video Zoom Shooting (Optical Zoom: Upto 3.5X, Digital Zoom: Upto 18X)| Front Camera: 4K (at 60 fps/at 30 fps), 1080P (at 60 fps/at 30 fps), 720P (at 30 fps), 1080P EIS (at 30 fps), 720P EIS (at 30 fps), 4K Timelapse (at 30 fps), 1080P Timelapse (at 30 fps), Support Dual View Video Shooting, Support HDR Video Shooting, Support Video Zoom Shooting (Digital Zoom: Upto 2X)",
              },
              {
                property: "Digital Zoom",
                value: "Rear Camera: Upto 18X | Front Camera: Upto 2X",
              },
              {
                property: "Frame Rate",
                value: "960 fps, 480 fps, 240 fps, 120 fps, 60 fps, 30 fps",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "5G, 4G, 3G, 2G",
              },
              {
                property: "Supported Networks",
                value: "5G, 4G LTE, WCDMA, GSM",
              },
              {
                property: "Internet Connectivity",
                value: "5G, 4G, 3G, Wi-Fi",
              },
              {
                property: "3G",
                value: "Yes",
              },
              {
                property: "Micro USB Port",
                value: "Yes",
              },
              {
                property: "Micro USB Version",
                value: "USB (Type C)",
              },
              {
                property: "Bluetooth Support",
                value: "Yes",
              },
              {
                property: "Bluetooth Version",
                value: "v5.4, Low Energy",
              },
              {
                property: "Wi-Fi",
                value: "Yes",
              },
              {
                property: "Wi-Fi Version",
                value:
                  "Wi-Fi 2.4 GHz, Wi-Fi 5 GHz, Wi-Fi 6 (802.11 ax), Wi-Fi 5 (802.11 ac), 802.11 b/g/a/n, WLAN (2.4 GHz |5.1 GHz |5 GHz |5.4 GHz |5.8 GHz), WLAN Display, WLAN Tethering, WLAN Overlay, Wi-Fi 2.4 GHz 20M, Wi-Fi 2.4 GHz 40M, Wi-Fi 5 GHz 20M, Wi-Fi 5 GHz 40M, Wi-Fi 5 GHz 80M, Wi-Fi 5 GHz 160M, 2 x 2 MIMO, Wi-Fi 6E, WLAN 6 GHz, Wi-Fi 6 GHz 20M, Wi-Fi 6 GHz 40M, Wi-Fi 6 GHz 80M, Wi-Fi 6 GHz 160M",
              },
              {
                property: "Wi-Fi Hotspot",
                value: "Yes",
              },
              {
                property: "NFC",
                value: "No",
              },
              {
                property: "Infrared",
                value: "Yes",
              },
              {
                property: "USB Connectivity",
                value: "Yes",
              },
              {
                property: "Audio Jack",
                value: "Type C",
              },
              {
                property: "GPS Support",
                value: "Yes",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "Google Pixel 6a (Charcoal, 128 GB)  (6 GB RAM)",
        current_price: 43999,
        original_price: 43999,
        discounted: false,
        discount_percent: 0,
        rating: null,
        in_stock: true,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/google-pixel-6a-charcoal-128-gb/p/itme5ae89135d44e",
        seller: {
          seller_name: "Vision Star",
          seller_rating: 4.7,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/xif0q/mobile/s/y/0/-original-imaggbrbxkqr3v3u.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/cms-brand/e5e7f2f1c25176753af9c4390b9c0124712a01145d504876f32d2cac02b69eec.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/g/g/3/-original-imaggbrccwsnygar.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/s/y/0/-original-imaggbrbxkqr3v3u.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/xif0q/mobile/n/8/x/pixel-6a-gx7as-google-original-imahg5xuvpfpacbk.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/9bde6f371e2540bb904424f6ced18f70_1821b4a5fc4_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/c36ec1f09b434cf9bd88a3aaaa3529e0_1821b4a7d9d_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/e83ce10404844e8886a953be59f3d697_1821b4aad12_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/78feaebd33d64893a8d788d2b3942ce4_1821b4ad628_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/2e14cd52f8c74eeea8c11b12976750bf_1821b4afde8_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/d228183d1c994c3591c49ec4db67b666_1821b4b2197_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/1efd30b31e1b423899adac33b7c5dba3_1821b4b3e41_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/9c2b7d272dd749909d1540dde5a82533_1821b4b5d03_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/10fa6ab42d884b739ef6e99688c2170e_1821b4c4638_image.jpeg?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-images/212eb213cd0f474cab387df6045a3e66_1821b4c5f9d_image.jpeg?q=90",
        ],
        highlights: [
          "6 GB RAM | 128 GB ROM",
          "15.6 cm (6.14 inch) Full HD+ Display",
          "12.2MP + 12MP | 8MP Front Camera",
          "4410 mAh Battery",
          "Google Tensor Processor",
        ],
        product_id: "MOBGFKX5YUXD74Z3",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/g/g/3/-original-imaggbrccwsnygar.jpeg?q={@quality}",
            colorName: "Chalk",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/s/y/0/-original-imaggbrbxkqr3v3u.jpeg?q={@quality}",
            colorName: "Charcoal",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/xif0q/mobile/n/8/x/pixel-6a-gx7as-google-original-imahg5xuvpfpacbk.jpeg?q={@quality}",
            colorName: "Sage",
          },
        ],
        ramVariants: [],
        storageVariants: [],
        offers: [
          "Bank Offer : 5% cashback on Axis Bank Flipkart Debit Card up to ₹750",
          "Bank Offer : 5% cashback on Flipkart SBI Credit Card upto ₹4,000 per calendar quarter",
          "Bank Offer : 5% cashback on Flipkart Axis Bank Credit Card upto ₹4,000 per statement quarter",
          "Bank Offer : Up To ₹50 Cashback on BHIM Payments App. Min Order Value ₹199. Offer Valid Once Per User",
        ],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value: "1 Year Brand Warranty",
              },
              {
                property: "Warranty Service Type",
                value: "NA",
              },
              {
                property: "Domestic Warranty",
                value: "1 Year",
              },
              {
                property: "Warranty Period",
                value: "1 Year",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "4410 mAh",
              },
            ],
          },
          {
            title: "Dimensions",
            details: [
              {
                property: "Width",
                value: "71.8 mm",
              },
              {
                property: "Height",
                value: "152.2 mm",
              },
              {
                property: "Depth",
                value: "8.9 mm",
              },
              {
                property: "Weight",
                value: "178 g",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "15.6 cm (6.14 inch)",
              },
              {
                property: "Resolution",
                value: "2400 x 1080 PIxels",
              },
              {
                property: "Resolution Type",
                value: "Full HD+",
              },
              {
                property: "Display Type",
                value: "Full HD+ OLED Display",
              },
              {
                property: "Other Display Features",
                value: "1,000,000:1, HDR Support",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "Android 12",
              },
              {
                property: "Processor Brand",
                value: "Google",
              },
              {
                property: "Processor Type",
                value: "Google Tensor",
              },
              {
                property: "Operating Frequency",
                value:
                  "2G GSM/EDGE: Quad Band (850/900/1800/1900 MHz), 3G UMTS/HSPA+/HSDPA: B1/B2/B4/B5/B6/B8/B19, 4G LTE: B1/B2/B3/B4/B5/B7/B8/B12/B13/B14/B17/B18/B19/B20/B25/B26/B28/B29/B30/B38/B39/B40/B41/B42/B48/B66/B71, 5G Sub-62: n1/n2/n3/n5/n7/n8/n12/n20/n25/n28/n30/n38/n40/n41/n48/n66/n71/n77/n78",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera Available",
                value: "Yes",
              },
              {
                property: "Primary Camera",
                value: "12.2MP + 12MP",
              },
              {
                property: "Primary Camera Features",
                value:
                  "Dual Camera Setup: 12.2MP Dual Pixel Wide Camera (1.4um Pixel Width, f/1.7 Aperture, FOV: 77 Degree field, 1/2.55 inch Image Sensor Size, Super Res Zoom Upto 7x1) + 12MP Ultrawide Camera (1.25um Pixel Width, f/2.2 Aperture, FOV: 114 Degree), Lens Correction, Optical + Electronic Image Stabilization, Fast Camera Launcher, Camera Feature: Magic Eraser, Real Tone, Face Unblur, Panorama, Manual White Balancing, Locked Folder, Night Sight, Top Shot, Portrait Mode, Portrait Light, Super Res Zoom, Motion Auto Focus, Frequent Faces, Dual Exposure Controls, Live HDR+, Cinematic Pan, Video Feature: Cinematic Pan, Slow Motion Video Support, 4K Timelapse with Stabilisation, Astrophotography Timelapse, Optical Image Stabilisation, Fused Video Stabilisation, 4K Cinematic Pan Video Stabilisation, 4K Locked Video Stabilisation, 1080p Active Video Stabilisation",
              },
              {
                property: "Secondary Camera Available",
                value: "Yes",
              },
              {
                property: "Secondary Camera",
                value: "8MP Front Camera",
              },
              {
                property: "Secondary Camera Features",
                value:
                  "8MP Camera Setup: (1.12um Pixel Width, f/2.0 Aperture, Fixed Focus, FOV: 84 Degree Wide)",
              },
              {
                property: "HD Recording",
                value: "Yes",
              },
              {
                property: "Full HD Recording",
                value: "Yes",
              },
              {
                property: "Video Recording Resolution",
                value:
                  "Rear Camera: 4K (at 30 fps/60 fps), 1080p (at 30 fps/60 fps) | Front Camera: 1080p (at 30 fps)",
              },
              {
                property: "Digital Zoom",
                value: "5X",
              },
              {
                property: "Frame Rate",
                value: "240 fps, 60 fps, 30 fps",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Other Details",
            details: [
              {
                property: "Smartphone",
                value: "Yes",
              },
              {
                property: "SIM Size",
                value: "Nano Sim",
              },
              {
                property: "SMS",
                value: "Yes",
              },
              {
                property: "Voice Input",
                value: "Yes",
              },
              {
                property: "Graphics PPI",
                value: "429 PPI",
              },
              {
                property: "Sensors",
                value:
                  "Proximity Sensor, Ambient Light Sensor, Accelerometer, Gyrometer, Magnetometer, Barometer",
              },
              {
                property: "Upgradable Operating System",
                value:
                  "Five Years of Pixel Updates (Pixel Security Updates for Atleast Five Years from When the Device First Became Available on the Google Store in the US. Updates May Also Include Feature Drops and Other Software Updates. See g.co/pixel/updates for more information.)",
              },
              {
                property: "Supported Languages",
                value: "Supports 11 Languages",
              },
              {
                property: "Other Features",
                value:
                  "Google Tensor, Adaptive Battery, Extreme Battery Saver, Live Translate, 18W Fast Wired Charging, Face Unblur, Magic Eraser, Real Tone, Titan M2TM and Google Tensor Security Core, IP67 Water Protection, Fingerprint Unlock with Under Display Fingerprint Sensor, Security Lock Method: Pattern, Pin, Password",
              },
              {
                property: "GPS Type",
                value: "GPS, GLONASS, GALILEO, QZSS, BEIDOU",
              },
            ],
          },
          {
            title: "Multimedia Features",
            details: [
              {
                property: "Video Formats",
                value: "HEVC (H.265), AVC (H.264)",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "Google",
              },
              {
                property: "In The Box",
                value:
                  "Handset, 1 M USB-C to USB-C Cable (USB 2.0), Quick Start Guide, Quick Switch Adaptor, Sim Tool",
              },
              {
                property: "Model Number",
                value: "GX7AS",
              },
              {
                property: "Model Name",
                value: "Pixel 6a",
              },
              {
                property: "Color",
                value: "Charcoal",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "No",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "Yes",
              },
              {
                property: "Quick Charging",
                value: "Yes",
              },
              {
                property: "Sound Enhancements",
                value:
                  "Stereo Recording, Speech Enhancement, Wind Noise Reduction",
              },
              {
                property: "Notch Design",
                value: "Punch Hole",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
              {
                property: "RAM Type",
                value: "LPDDR5",
              },
            ],
          },
          {
            title: "Call Features",
            details: [
              {
                property: "Speaker Phone",
                value: "Yes",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "128 GB",
              },
              {
                property: "RAM",
                value: "6 GB",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "5G, 4G, 3G, 2G",
              },
              {
                property: "Supported Networks",
                value: "5G, 4G LTE, UMTS, GSM",
              },
              {
                property: "Internet Connectivity",
                value: "5G, 4G, 3G, Wi-Fi, EDGE",
              },
              {
                property: "Pre-installed Browser",
                value: "Google Chrome",
              },
              {
                property: "Micro USB Version",
                value: "USB 2.0",
              },
              {
                property: "Bluetooth Support",
                value: "Yes",
              },
              {
                property: "Bluetooth Version",
                value: "v5.2",
              },
              {
                property: "Wi-Fi Version",
                value: "Wi-Fi 6 (802.11 ax), Wi-Fi 6E with MIMO",
              },
              {
                property: "Wi-Fi Hotspot",
                value: "Yes",
              },
              {
                property: "NFC",
                value: "Yes",
              },
              {
                property: "GPS Support",
                value: "Yes",
              },
            ],
          },
        ],
      },
    },
    {
      status: "fulfilled",
      value: {
        name: "Apple iPhone 13 (Midnight, 128 GB)",
        current_price: 41999,
        original_price: 49900,
        discounted: true,
        discount_percent: 15,
        rating: 4.6,
        in_stock: false,
        f_assured: false,
        share_url:
          "https://dl.flipkart.com/dl/apple-iphone-13-midnight-128-gb/p/itmca361aab1c5b0",
        seller: {
          seller_name: null,
          seller_rating: null,
        },
        thumbnails: [
          "https://rukminim2.flixcart.com/image/416/416/ktketu80/mobile/s/l/c/iphone-13-mlpf3hn-a-apple-original-imag6vzz5qvejz8z.jpeg?q=70&crop=false",
          "https://rukminim2.flixcart.com/image/160/160/prod-fk-cms-brand-images/9d5696196cfb3f4440ca99b1018c8ff91a53716d1948ba73ee3bb68f36571d7a.jpg?q=90",
          "https://rukminim2.flixcart.com/image/144/144/ktketu80/mobile/s/l/c/iphone-13-mlpf3hn-a-apple-original-imag6vzz5qvejz8z.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/144/144/ktketu80/mobile/6/n/d/iphone-13-mlpg3hn-a-apple-original-imag6vpyghayhhrh.jpeg?q=50",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/f911cab85917488bad55094596200ceb_18359bfe18b_image.png?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/4dc94e380a844cfaa8976dc502fbfd1a_18359c0013a_image.png?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/7b3bf64047794add8f4d55e079ba1cce_18359c02a77_image.png?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/3b21f240f0d74efb9e32566c693c7f95_18359c04946_image.png?q=90",
          "https://rukminim2.flixcart.com/image/200/200/cms-rpd-img/fd06e35acb7943f1b82397a594efd7f5_18359c06f48_image.png?q=90",
        ],
        highlights: [
          "128 GB ROM",
          "15.49 cm (6.1 inch) Super Retina XDR Display",
          "12MP + 12MP | 12MP Front Camera",
          "A15 Bionic Chip Processor",
        ],
        product_id: "MOBG6VF5Q82T3XRS",
        colorVariants: [
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/ktketu80/mobile/s/l/c/iphone-13-mlpf3hn-a-apple-original-imag6vzz5qvejz8z.jpeg?q={@quality}",
            colorName: "Midnight",
          },
          {
            colorImg:
              "http://rukmini1.flixcart.com/image/{@width}/{@height}/ktketu80/mobile/6/n/d/iphone-13-mlpg3hn-a-apple-original-imag6vpyghayhhrh.jpeg?q={@quality}",
            colorName: "Starlight",
          },
        ],
        ramVariants: [],
        storageVariants: ["128 GB", "512 GB"],
        offers: [],
        specs: [
          {
            title: "Warranty",
            details: [
              {
                property: "Warranty Summary",
                value:
                  "1 year warranty for phone and 1 year warranty for in Box Accessories.",
              },
              {
                property: "Warranty Service Type",
                value: "NA",
              },
              {
                property: "Domestic Warranty",
                value: "1 Year",
              },
              {
                property: "Warranty Period",
                value: "1 Year",
              },
            ],
          },
          {
            title: "Battery & Power Features",
            details: [
              {
                property: "Battery Capacity",
                value: "3240 mAh",
              },
            ],
          },
          {
            title: "Dimensions",
            details: [
              {
                property: "Width",
                value: "71.5 mm",
              },
              {
                property: "Height",
                value: "146.7 mm",
              },
              {
                property: "Depth",
                value: "7.65 mm",
              },
              {
                property: "Weight",
                value: "173 g",
              },
            ],
          },
          {
            title: "Display Features",
            details: [
              {
                property: "Display Size",
                value: "15.49 cm (6.1 inch)",
              },
              {
                property: "Resolution",
                value: "2532 x 1170 Pixels",
              },
              {
                property: "Resolution Type",
                value: "Super Retina XDR Display",
              },
              {
                property: "Display Type",
                value: "Super Retina XDR Display",
              },
              {
                property: "Other Display Features",
                value:
                  "Super Retina XDR Display, 6.1‑inch (Diagonal) All‑screen OLED Display, HDR Display, True Tone, Wide Colour (P3), Haptic Touch, 20,00,000:1 Contrast Ratio (Typical), 800 nits max Brightness (Typical), 1,200 nits max Brightness (HDR), Fingerprint-resistant Oleophobic Coating, Support for Display of Multiple Languages and Characters Simultaneously",
              },
            ],
          },
          {
            title: "Os & Processor Features",
            details: [
              {
                property: "Operating System",
                value: "iOS 15",
              },
              {
                property: "Processor Brand",
                value: "Apple",
              },
              {
                property: "Processor Type",
                value: "A15 Bionic Chip",
              },
              {
                property: "Processor Core",
                value: "Hexa Core",
              },
              {
                property: "Operating Frequency",
                value:
                  "2G GSM/EDGE: 850, 900, 1800, 1900 MHz, 3G UMTS/HSPA+/DC-HSDPA: 850, 900, 1700/2100, 1900, 2100 MHz, 4G TD-LTE: Bands 34, 38, 39, 40, 41, 42, 46, 48, 4G FDD-LTE: Bands 1, 2, 3, 4, 5, 7, 8, 12, 13, 17, 18, 19, 20, 25, 26, 28, 30, 32, 66, 5G NR: Bands n1, n2, n3, n5, n7, n8, n12, n20, n25, n28, n30, n38, n40, n41, n48, n66, n77, n78, n79",
              },
            ],
          },
          {
            title: "Camera Features",
            details: [
              {
                property: "Primary Camera Available",
                value: "Yes",
              },
              {
                property: "Primary Camera",
                value: "12MP + 12MP",
              },
              {
                property: "Primary Camera Features",
                value:
                  "Dual 12MP Camera System (Wide and Ultra Wide), Wide: f/1.6 Aperture, Ultra Wide: f/2.4 Aperture, 120 Degree FOV, 2x Optical Zoom out, Digital Zoom up to 5x, Portrait Mode with Advanced Bokeh and Depth Control, Portrait Lighting with Six Effects (Natural, Studio, Contour, Stage, Stage Mono, High‑Key Mono), Sensor-shift Optical Image Stabilisation (Wide), Seven‑element Lens (Wide), Five‑element Lens (Ultra Wide), Panorama (up to 63MP), Crystal Lens Cover, 100% Focus Pixels (Wide), Night Mode\nDeep Fusion, Smart HDR 4, Photographic Styles, Wide Colour Capture for Photos and Live Photos, Lens Correction (Ultra Wide), Advanced Red‑eye Correction, Auto Image Stabilisation, Burst Mode, Photo Geotagging, Image Formats Captured: HEIF and JPEG, Video Recording: Sensor-shift OIS for Video (Wide), Audio Zoom, QuickTake Video, Time‑lapse Video with Stabilisation, Night Mode Time-lapse, Cinematic Video Stabilisation (4K, 1080p and 720p), Continuous AF Video, Playback Zoom, Stereo Recording",
              },
              {
                property: "Secondary Camera Available",
                value: "Yes",
              },
              {
                property: "Secondary Camera",
                value: "12MP Front Camera",
              },
              {
                property: "Secondary Camera Features",
                value:
                  "12MP TrueDepth Camera, f/2.2 Aperture, Portrait Mode with Advanced Bokeh and Depth Control, Portrait Lighting with Six Effects (Natural, Studio, Contour, Stage, Stage Mono, High‑Key Mono), Animoji and Memoji, Night Mode, Deep Fusion, Smart HDR 4, Photographic Styles, Cinematic Mode for Recording Videos with Shallow Depth of Field (1080p at 30 fps), HDR Video Recording with Dolby Vision up to 4K at 60 fps, Time‑lapse Video with Stabilisation, Night Mode Time-lapse, Cinematic Video Stabilisation (4K, 1080p and 720p), QuickTake Video, Wide Colour Capture for Photos and Live Photos, Lens Correction, Auto Image Stabilisation, Burst Mode",
              },
              {
                property: "Flash",
                value:
                  "Rear: True Tone Flash with Slow Sync | Front: Retina Flash",
              },
              {
                property: "HD Recording",
                value: "Yes",
              },
              {
                property: "Full HD Recording",
                value: "Yes",
              },
              {
                property: "Video Recording",
                value: "Yes",
              },
              {
                property: "Video Recording Resolution",
                value:
                  "4K Video Recording (at 24 fps, 25 fps, 30 fps or 60 fps), 1080p HD Video Recording (at 25 fps, 30 fps or 60 fps), 720p HD Video Recording (at 30 fps), Slow‑motion Video Support: Rear Camera (1080p at 120 fps or 240 fps), Front Camera (1080p at 120 fps)",
              },
              {
                property: "Digital Zoom",
                value:
                  "Photo: Digital Zoom Upto 5x, Video: Digital Zoom Upto 3x",
              },
              {
                property: "Frame Rate",
                value: "24 fps, 25 fps, 30 fps, 60 fps",
              },
              {
                property: "Dual Camera Lens",
                value: "Primary Camera",
              },
            ],
          },
          {
            title: "Other Details",
            details: [
              {
                property: "Smartphone",
                value: "Yes",
              },
              {
                property: "SIM Size",
                value: "Nano + eSIM",
              },
              {
                property: "Mobile Tracker",
                value: "Yes",
              },
              {
                property: "Removable Battery",
                value: "No",
              },
              {
                property: "SMS",
                value: "Yes",
              },
              {
                property: "Graphics PPI",
                value: "460 PPI",
              },
              {
                property: "Sensors",
                value:
                  "Face ID, Barometer, Three‑axis Gyro, Accelerometer, Proximity Sensor, Ambient Light Sensor",
              },
              {
                property: "Browser",
                value: "Safari",
              },
              {
                property: "Other Features",
                value:
                  "Splash, Water and Dust Resistant IP68 Rated (Maximum Depth of 6 metres up to 30 minutes) under IEC Standard 60529, Face ID Enabled by TrueDepth Camera for Facial Recognition, Compatible with MagSafe Accessories and Wireless Chargers",
              },
              {
                property: "GPS Type",
                value: "Built-in GPS, GLONASS, Galileo, QZSS and BeiDou",
              },
            ],
          },
          {
            title: "Multimedia Features",
            details: [
              {
                property: "Video Formats",
                value:
                  "HEVC, H.264, MPEG‑4 Part 2 and Motion JPEG, HDR with Dolby Vision, HDR10 and HLG",
              },
            ],
          },
          {
            title: "General",
            details: [
              {
                property: "Brand",
                value: "Apple",
              },
              {
                property: "In The Box",
                value: ", USB-C to Lightning Cable, Documentation",
              },
              {
                property: "Model Number",
                value: "MLPF3HN/A",
              },
              {
                property: "Model Name",
                value: "iPhone 13",
              },
              {
                property: "Color",
                value: "Midnight",
              },
              {
                property: "Browse Type",
                value: "Smartphones",
              },
              {
                property: "SIM Type",
                value: "Dual Sim",
              },
              {
                property: "Hybrid Sim Slot",
                value: "No",
              },
              {
                property: "Touchscreen",
                value: "Yes",
              },
              {
                property: "OTG Compatible",
                value: "No",
              },
              {
                property: "Quick Charging",
                value: "Yes",
              },
              {
                property: "Sound Enhancements",
                value:
                  "Dolby Digital (AC‑3), Dolby Digital Plus (E‑AC‑3), Dolby Atmos and Audible (formats 2, 3, 4, Audible Enhanced Audio, AAX and AAX+), Spatial Audio Playback",
              },
              {
                property: "Headset Present",
                value: "No",
              },
              {
                property: "Phablet",
                value: "No",
              },
            ],
          },
          {
            title: "Call Features",
            details: [
              {
                property: "Call Wait/Hold",
                value: "Yes",
              },
            ],
          },
          {
            title: "Memory & Storage Features",
            details: [
              {
                property: "Internal Storage",
                value: "128 GB",
              },
            ],
          },
          {
            title: "Connectivity Features",
            details: [
              {
                property: "Network Type",
                value: "5G, 4G, 3G, 2G",
              },
              {
                property: "Supported Networks",
                value: "5G, 4G VoLTE, 4G LTE, UMTS, GSM",
              },
              {
                property: "Internet Connectivity",
                value: "5G, 4G, 3G, Wi-Fi, EDGE",
              },
              {
                property: "3G",
                value: "Yes",
              },
              {
                property: "Pre-installed Browser",
                value: "Safari",
              },
              {
                property: "Bluetooth Support",
                value: "Yes",
              },
              {
                property: "Bluetooth Version",
                value: "v5.0",
              },
              {
                property: "Wi-Fi",
                value: "Yes",
              },
              {
                property: "Wi-Fi Version",
                value: "Wi-Fi 6 (802.11ax) with 2x2 MIMO",
              },
              {
                property: "Wi-Fi Hotspot",
                value: "Yes",
              },
              {
                property: "NFC",
                value: "Yes",
              },
              {
                property: "EDGE",
                value: "Yes",
              },
              {
                property: "Map Support",
                value: "Maps",
              },
              {
                property: "GPS Support",
                value: "Yes",
              },
            ],
          },
        ],
      },
    },
  ];
  const allSpecs = data.map((item) => {
    const s = SpecExtractor.normalize(item.value);
    return {
      ...s,
    };
  });
  res.json(allSpecs);
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

app.get("/ok", async (req, res) => {
  try {
    console.log("API HI API HIT API HI");
    const da = product(
      "motorola-g96-5g-pantone-ashleigh-blue-128-gb/p/itm93452c0761719?pid=MOBHB3SZ2ZUQQQ9U",
      "general"
    );

    res.json(da);
  } catch (error) {
    console.error("ERROR ERROR ERROR", error);
  }
});

// app.get("/run-code", async (req, res) => {
//   try {
//     // 1. Read which data to process from index-documents.json
//     if (isScrapping) return res.send("One job is already running");
//     shouldStopScraping = false; // reset stop flag
//     const filePath = path.join(__dirname, "../data/index-documents.json");
//     const rawData = readFileSync(filePath, "utf-8");
//     let phones;
//     try {
//       phones = JSON.parse(rawData);
//     } catch {
//       phones = {};
//       return res.send("PHONE IS EMPTY");
//     }
//     if (!Array.isArray(phones.phones)) {
//       return res.send("The phones JSON is not an array");
//     }
//     const urls: string[] = phones.phones
//       .map((phone: any) => phone.url)
//       .filter(Boolean);

//     // 2. Get already processed URLs from DB
//     const existingDocs = await GsmArenaModel.find(
//       { url: { $in: urls } },
//       { url: 1 }
//     ).lean();
//     const processedUrlSet = new Set<string>(
//       existingDocs.map((doc: any) => doc.url)
//     );

//     // 3. Figure out which URLs to process
//     const toProcessUrls = urls.filter((url) => !processedUrlSet.has(url));

//     if (toProcessUrls.length === 0) {
//       return res.send("All URLs have already been processed.");
//     }

//     // 4. Process each remaining url with 10s delay, can be stopped by /stop-run-code
//     (async () => {
//       isScrapping = true;
//       for (const url of toProcessUrls) {
//         if (shouldStopScraping) {
//           logger.info("Scraping process has been stopped by user.");
//           break;
//         }
//         if (failedCountInSequence >= 20) {
//           logger.error(
//             "More than 20 requests failed in sequence. Stopping the scraping process."
//           );
//           break;
//         }
//         console.log("PROCESSING", url);
//         try {
//           const result = await ProductSpecsScraper.processURL(url);
//           // await GsmArenaModel.create(result);
//           logger.info(`Processed: ${url}`);
//           const ct = new Date();
//           lastScrap = ct.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
//           failedCountInSequence = 0; // Reset on success
//         } catch (err: any) {
//           logger.error(`Failed to process ${url}: ${(err as Error)?.message}`);
//           // await GsmArenaModel.create({ url, data: "FAILED" });
//           lastError = err.message ?? `${url} FAILED`;
//           failedCountInSequence += 1;
//         }
//         await sleep(10000);
//       }
//       isScrapping = false;
//       shouldStopScraping = false;
//       logger.info(
//         "All phone URLs have been processed or scraping was stopped."
//       );
//     })();

//     res.send(
//       `Work Started. To be processed: ${toProcessUrls.length}. Already processed: ${processedUrlSet.size}.`
//     );
//   } catch (err: any) {
//     logger.error("Error in /run-code endpoint:", err.message);
//     res
//       .status(500)
//       .json({ error: "Could not process phone URLs", details: err.message });
//   }
// });

// app.get("/stop-run-code", async (req, res) => {
//   try {
//     const re = await ProductSpecsScraper.processURL(
//       "https://www.gsmarena.com/_gaga350q-5.php"
//     );
//     console.log("RES", re);
//   } catch (error: any) {
//     console.log("ERROR", error.message);
//   }
//   if (!isScrapping) {
//     res.json({ message: "No scraping job in progress." });
//     return;
//   }
//   shouldStopScraping = true;
//   res.json({ message: "Scraping job will be stopped soon." });
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
