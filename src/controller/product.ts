import { Request, Response } from "express";
import { parseUserQueryWithAI } from "../helpers/aiParser";
import { buildFlipkartSearchUrl } from "../helpers/flipkart";
import { scrapeFlipkartSearch } from "../service/scrapper";

export const getProductList = async (req: Request, res: Response) => {
  const userQuery = (req.query.query as string) || "";
  console.log("userQuery", userQuery);

  if (!userQuery) {
    return res.status(400).json({ error: "Missing 'query' parameter" });
  }

  try {
    const parsedResult = await parseUserQueryWithAI(userQuery);

    if (!parsedResult.success) {
      return res.status(400).json({
        error: "Query requires clarification",
        questions: parsedResult.questions,
      });
    }

    const parsed = parsedResult.parsed;
    const flipkartUrl = buildFlipkartSearchUrl(parsed);
    console.log("flipkartUrl----------------->", flipkartUrl);

    // 3) Scrape and return JSON (with automatic deduplication)
    console.log(`[product] Starting scrape for URL: ${flipkartUrl}`);
    const products = await scrapeFlipkartSearch({
      url: flipkartUrl,
    });
    console.log(
      `[product] Scraping completed. Found ${products.length} unique products`
    );

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
    console.log("err", err);
    return res.status(500).json({
      error: "Failed to parse query or scrape Flipkart",
      details: err.message,
    });
  }
};
