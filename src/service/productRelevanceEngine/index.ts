import { getDeviceList } from "../getDeviceData";
import { tokenSimilarity } from "./utils";

export const getProductsDetials = async (productList: { name: string }[]) => {
  const docs = getDeviceList();
  const dbProducts = Array.isArray(docs) ? docs : [];

  const enrichedList = productList.map((product) => {
    let bestMatch: any = null;
    let bestScore = 0.0;
    for (const dbProd of dbProducts) {
      if (typeof dbProd.title !== "string") continue;
      const score = tokenSimilarity(dbProd.title, product.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          title: dbProd.title,
          link: dbProd.link,
          realTitle: product.name,
          parseSpecs: dbProd.parseHtmlSpec,
        };
      }
    }
    return bestScore > 0.4
      ? {
          ...bestMatch,
          realTitle: product.name,
        }
      : {
          realTitle: product.name,
        };
  });

  return enrichedList;
};
