import { Request, Response } from "express";
import { parseUserQueryWithAI } from "../helpers/aiParser";
import { parseUserQuery as parseUserQueryFallback } from "../helpers/nlp";
import { buildFlipkartSearchUrl } from "../helpers/flipkart";
import { scrapeFlipkartSearch } from "../service/scrapper";





export const getProductList = async (req:Request, res:Response) => {
  const userQuery = (req.query.query as string) || "";
  console.log("userQuery", userQuery);

  if (!userQuery) {
    return res.status(400).json({ error: "Missing 'query' parameter" });
  }

  try {
    // 1) Use AI model to extract structure. If AI fails (model not available), fall back to local NLP.
    let parsed;
    try {
      parsed = await parseUserQueryWithAI(userQuery);
    } catch (aiErr: any) {
      console.error('[product] AI parse failed, falling back to local NLP parser:', aiErr?.message || aiErr);
      parsed = parseUserQueryFallback(userQuery);
    }

    // 2) Use productKeywords to build Flipkart URL
    const flipkartUrl = buildFlipkartSearchUrl({
      raw: userQuery,
      productKeywords: parsed.productKeywords,
      maxPrice: parsed.maxPrice ?? undefined,
      minPrice: parsed.minPrice ?? undefined,
    });
    console.log("flipkartUrl----------------->", flipkartUrl);

    // 3) Scrape and return JSON (with automatic deduplication)
    console.log(`[product] Starting scrape for URL: ${flipkartUrl}`);
    const products = await scrapeFlipkartSearch(flipkartUrl);
    console.log(`[product] Scraping completed. Found ${products.length} unique products`);

    return res.json({
      query: {
        raw: userQuery,
        ...parsed,
      },
      flipkartUrl,
      count: products.length,
      products,
    });
  } catch (err: any) {
    console.log("err",err);
    return res.status(500).json({ error: "Failed to parse query or scrape Flipkart", details: err.message });
  }
};