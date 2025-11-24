// src/scraper.ts
import { CheerioCrawler, Dataset } from "crawlee";

export interface Product {
  title: string | null;
  price: string | null;
  description: string | null;
  link: string | null;
  image: string | null;
  rating: string | null;
}

export async function scrapeFlipkartSearch(url: string): Promise<Product[]> {
  const results: Product[] = [];

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: 1,
    requestHandler: async ({ $ }) => {
      const productCards = $("div[data-id]");
      productCards.each((_, el) => {
        const card = $(el);

        const title = card.find("div.KzDlHZ").first().text().trim() || null;
        const linkElem = card.find("a.CGtC98").first();
        const relativeHref = linkElem.attr("href");
        const link = relativeHref
          ? "https://www.flipkart.com" + relativeHref
          : null;
        const image =
          card.find("img.DByuf4").attr("src") ||
          card.find("img.DByuf4").attr("data-src") ||
          null;
        const price = card.find("div.Nx9bqj").first().text().trim() || null;
        const rating =
          card.find("div.XQDdHH").first().text().trim() ||
          card.find("span.Y1HWO0").first().text().trim() ||
          null;
        const details:any = [];
        card.find("ul.G4BRas li.Jigdf").each((_, li) => {
          details.push($(li).text().trim());
        });
        const description = details.join(" | ") || null;

        results.push({
          title,
          price,
          description,
          link,
          image,
          rating,
        });
      });
    },
  });

  await crawler.run([url]);
  return results;
}

