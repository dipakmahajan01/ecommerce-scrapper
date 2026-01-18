import * as cheerio from "cheerio";
import { smartPrixResponse } from "../models/smartprix";

const color = {
  info: (...args: any[]) => console.log(`\x1b[36m[INFO]\x1b[0m`, ...args),
  warn: (...args: any[]) => console.log(`\x1b[33m[WARN]\x1b[0m`, ...args),
  error: (...args: any[]) => console.log(`\x1b[31m[ERROR]\x1b[0m`, ...args),
  success: (...args: any[]) => console.log(`\x1b[32m[SUCCESS]\x1b[0m`, ...args),
};

/**
 * Extracts product images from HTML using the selector .has-specs-img > .sm-swiper img.sm-img
 * Filters out images where:
 * - alt tag contains "Specs" (case-insensitive)
 * - URL doesn't start with "https"
 * 
 * @param html - HTML content to parse
 * @returns Array of image URLs
 */
function extractProductImages(html: string): string[] {
  const $ = cheerio.load(html);
  const images: string[] = [];

  $(".has-specs-img > .sm-swiper img.sm-img").each((_, element) => {
    const $img = $(element);
    const src = $img.attr("src") || $img.attr("data-src") || "";
    const alt = ($img.attr("alt") || "").toLowerCase();

    // Skip if alt contains "Specs"
    if (alt.includes("specs")) {
      return;
    }

    // Skip if URL doesn't start with "https"
    if (!src.startsWith("https")) {
      return;
    }

    images.push(src);
  });

  return images;
}

/**
 * Extracts and saves product images for all Smartprix records that have HTML
 * Processes documents in batches using a cursor
 * Stores extracted images in the 'images' field at root level
 */
export async function extractAndSaveSmartprixImages(): Promise<number> {
  const cursor = smartPrixResponse
    .find({
      "parseHtmlSpec.meta.lifecycle": { $in: ["unknown", "considerable"] },
      link: { $exists: true },
    })
    .cursor();

  let counter = 0;
  let processed = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      processed++;
      color.info(
        `Processing doc: _id=${doc._id.toString()} model=${
          doc.title || "?"
        } link=${doc.link || "?"} [${processed}]`
      );

      const html = doc.html;
      if (!html || typeof html !== "string") {
        color.warn(
          `Doc ID ${doc._id}: Missing or invalid HTML, cannot extract images.`
        );
        await smartPrixResponse.updateOne(
          { _id: doc._id },
          {
            $set: { images: [] },
          }
        );
        continue;
      }

      // Extract images and replace w420-h420 with w1200-h1200 in URLs
      let images = extractProductImages(html);
      images = images.map((url) =>
        typeof url === "string"
          ? url.replace(/w420-h420/g, "w1200-h1200")
          : url
      );

      console.log(images);
      await smartPrixResponse.updateOne(
        { _id: doc._id },
        {
          $set: { images },
        }
      );

      color.success(
        `Doc ID ${doc._id}: Extracted ${images.length} images.`
      );
      counter++;
    } catch (err: any) {
      color.error(
        `Image extraction error for doc id ${doc._id}: ${err?.message || err}`
      );
      await smartPrixResponse.updateOne(
        { _id: doc._id },
        {
          $set: { images: [], imageExtractionError: err?.message || String(err) },
        }
      );
    }
  }

  color.success(`Image extraction complete. Processed ${counter} documents.`);
  return counter;
}
