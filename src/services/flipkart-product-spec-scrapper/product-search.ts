/* Copyright 2023 Vishal Das

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
*/

type SearchResultItem = {
  name: string;
  link: string;
  current_price: number | null;
  original_price: number | null;
  discounted: boolean;
  thumbnail: string | null;
  query_url: string;
};

type SearchResult = {
  total_result: number;
  query: string;
  fetch_from: string;
  result: SearchResultItem[];
};

/**
 * Robust product name cleaner:
 * - Remove HTML tags including <svg> blocks and their inner content.
 * - Remove whitespace and decode &#x27; but do not accept empty or nonsense names.
 */
function cleanProductName(raw: string | null | undefined): string {
  if (!raw) return "";
  // Remove all <svg ...>...</svg> blocks (greedy).
  let s = raw.replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  // Remove all HTML tags.
  s = s.replace(/<[^>]+>/g, " ");
  // Remove extra space.
  s = s.replace(/\s+/g, " ");
  // Unescape single quote.
  s = s.replace(/&#x27;/g, "'");
  // Remove leftovers like empty string or just dash (e.g. -)
  s = s.trim();
  // If name after SVG and tag cleanup is empty, return empty string
  return s;
}

const productSearch = async (
  q: string,
  host: string,
  page: number
): Promise<SearchResult> => {
  let pageNum = 1;
  if (typeof page === "number" && page > 1) {
    pageNum = page;
  }
  const urlObject = new URL("https://www.flipkart.com/search");
  urlObject.searchParams.set("marketplace", "FLIPKART");
  urlObject.searchParams.set("q", q);
  if (pageNum > 1) {
    urlObject.searchParams.set("page", pageNum.toString());
  }
  const searchURL: string = urlObject.toString();
  console.log("Search initiated : " + searchURL);
  let webPageContents: string = await (await fetch(searchURL)).text();
  // To rectify pages with exchange option
  webPageContents = webPageContents.replace(
    /style="color:#000000;font-size:14px;font-style:normal;font-weight:700">₹/g,
    ">Rs. "
  );
  webPageContents = webPageContents
    .replace(/&#x27;/g, `'`)
    .replace(/&#...;/g, "");
  let products: string[] = webPageContents.split(">₹");
  let result: SearchResultItem[] = [],
    method: string | null = null,
    reversion: boolean = false;

  for (let i = 1; i < products.length; i++) {
    try {
      let currentPrice: number | null = null,
        originalPrice: number | null = null,
        productLink: string | null = null,
        productName: string | null = null,
        isDiscounted: boolean = false,
        thumbnail: string | null = null;
      let linkDetails: string[] | null = null,
        lastLinkIndex: number | null = null,
        linkDetailsFinder: string[] | null = null;

      // product price
      let priceCheck: string = products[i]
        .split("</div>")[0]
        .replace(/,|<|>|-|!/g, "");
      currentPrice = parseInt(priceCheck);
      originalPrice = currentPrice;

      // product name and link

      if (priceCheck.split("</option>").length == 1) {
        //Method A - Compact screen with about mulltiple columns
        try {
          linkDetails = products[i - 1].split("</a>");
          try {
            let thumbnails_arr = products[i - 1].split('src="https');
            for (let i2 = 0; i2 < thumbnails_arr.length; i2++) {
              let possible_thumbnail = thumbnails_arr[i2].split('"')[0];
              if (
                possible_thumbnail.toLowerCase().includes("jpeg") ||
                possible_thumbnail.toLowerCase().includes("image") ||
                possible_thumbnail.toLowerCase().includes("jpg") ||
                possible_thumbnail.toLowerCase().includes("png")
              ) {
                thumbnail = "https" + possible_thumbnail;
                break;
              }
            }
          } catch (e) {}
          lastLinkIndex = linkDetails.length - 2;
          linkDetailsFinder =
            linkDetails[lastLinkIndex].split('target="_blank"');
          if (linkDetailsFinder.length > 1) {
            productLink =
              "https://www.flipkart.com" +
              linkDetailsFinder[1].split('href="')[1].split('"')[0];
            // Extract product name using RG5Slk or fallback
            let productNameMatch = linkDetailsFinder[1].match(
              /<div[^>]+class="[^"]*RG5Slk[^"]*"[^>]*>([\s\S]*?)<\/div>/
            );
            if (productNameMatch && productNameMatch[1]) {
              productName = cleanProductName(productNameMatch[1]);
            } else {
              // fallback: try to find the first class-like col col-7-12 (for big cards)
              let fallbackMatch = linkDetailsFinder[1].match(
                /<div[^>]+class="col col-7-12"[^>]*>([\s\S]*?<div[^>]+class="RG5Slk"[^>]*>([\s\S]*?)<\/div>)/
              );
              if (fallbackMatch && fallbackMatch[2]) {
                productName = cleanProductName(fallbackMatch[2]);
              } else {
                // fallback: look for first significant text after the link tag
                let altTextSearch =
                  linkDetailsFinder[1].split('href="')[1].split(">")[1] || "";
                productName = cleanProductName(altTextSearch);
              }
            }
            method = "A";
          }
        } catch (error) {
          console.log("Failed to obtain product name and link from Method A");
        }

        if (!productName) {
          // Method B - Full product description page (older listing)
          try {
            if (method == "C" || method == "D") {
              // This should revert method to B temporarily
              i++;
              reversion = true;
            }
            linkDetails = products[i - 2].split("<a");
            method = "B";
            if (linkDetails.length == 1) {
              // Method C
              linkDetails = products[i - 1].split("<a");
              method = "C";
            } else {
              console.log(
                "Failed to obtain product name and link from Method B"
              );
            }
            lastLinkIndex = linkDetails.length - 1;
            linkDetailsFinder =
              linkDetails[lastLinkIndex].split('target="_blank"');
            if (linkDetailsFinder.length > 1) {
              productLink =
                "https://www.flipkart.com" +
                linkDetailsFinder[1].split('href="')[1].split('"')[0];
              try {
                if (linkDetailsFinder[1].indexOf("Sponsored") === -1) {
                  // Try new RG5Slk or similar block
                  let rgMatch = linkDetailsFinder[1].match(
                    /<div[^>]+class="[^"]*RG5Slk[^"]*"[^>]*>([\s\S]*?)<\/div>/
                  );
                  if (rgMatch && rgMatch[1]) {
                    productName = cleanProductName(rgMatch[1]);
                  } else {
                    // fallback: try block col col-7-12
                    let alt2Match = linkDetailsFinder[1].match(
                      /<div[^>]+class="col col-7-12"[^>]*>([\s\S]*?)<\/div>/
                    );
                    if (alt2Match && alt2Match[1]) {
                      productName = cleanProductName(alt2Match[1]);
                    } else {
                      // fallback: extract text content from first div after href
                      let afterHref = linkDetailsFinder[1].split('href="')[1];
                      if (afterHref) {
                        // Try to find the next '>' after href and get inner text
                        const gtIndex = afterHref.indexOf(">");
                        if (gtIndex !== -1) {
                          let alt = afterHref.substring(gtIndex + 1);
                          productName = cleanProductName(alt);
                        }
                      }
                    }
                  }
                } else {
                  // For sponsored, fallback - try to extract text after col col-7-12 or just text after '>'
                  let matchSponsored = linkDetailsFinder[1].match(
                    /"col col-7-12"[^>]*>([\s\S]*?)<\/div>/
                  );
                  if (matchSponsored && matchSponsored[1]) {
                    productName = cleanProductName(matchSponsored[1]);
                  } else {
                    let afterSponsored =
                      linkDetailsFinder[1].split(">")[2] || "";
                    productName = cleanProductName(afterSponsored);
                  }
                }
              } catch (e) {
                console.log("Failed to obtain product name, keeping it null");
              }
            }
            if (reversion) {
              i--;
              reversion = false;
              method = "D";
              console.log(
                "Failed to obtain product name and link from Method C"
              );
            }
          } catch (e: any) {
            console.log(e.message);
          }
          if (!productName) {
            console.log(
              "Failed to obtain product name and link from known methods"
            );
          } else {
            console.log(
              "Sucessfully obtained product name and link from known methods"
            );

            // product thumbnail

            try {
              if (thumbnail == null) {
                // Try to find thumbnail by working off the alt now that SVG is removed
                let altfind = productName.split(" ")[0];
                let thumbnails = webPageContents.split(`alt="`);
                let found = false;
                for (let t = 1; t < thumbnails.length; t++) {
                  // Try to find a picture whose alt attribute's first word matches productName's first word
                  let altText = thumbnails[t].split('"')[0];
                  // simple fuzzy match, or could use productName substring (truncated due to ellipsis)
                  if (
                    altText
                      .toLowerCase()
                      .startsWith(altfind.toLowerCase().slice(0, 5)) ||
                    altText
                      .toLowerCase()
                      .indexOf(productName.toLowerCase().slice(0, 5)) !== -1
                  ) {
                    let q = thumbnails[t].split('src="');
                    if (q.length > 1) {
                      thumbnail = q[1].split('"')[0];
                      found = true;
                      break;
                    }
                  }
                }
                if (!found) thumbnail = null;
              }
            } catch (e) {
              thumbnail = null;
            }
            if (i + 1 != products.length) {
              let nextItem = products[i + 1]
                .split("</div>")[0]
                .replace(/,/g, "")
                .split("<!-- -->");
              isDiscounted = nextItem.length > 1;
              if (isDiscounted) {
                i++;
                originalPrice = parseInt(nextItem[1]);
              }
            }

            result.push({
              name: (productName || "").replace(/&#x27;/g, `'`).trim(),
              link: clean(productLink as string),
              current_price: currentPrice,
              original_price: originalPrice,
              discounted: isDiscounted,
              thumbnail,
              query_url: clean(productLink as string)
                .replace("www.flipkart.com", host + "/product")
                .replace("dl.flipkart.com", host + "/product"),
            });
          }
        } else {
          // product thumbnail

          try {
            if (thumbnail == null) {
              // Try with alt by truncation matching
              let thumbnails = webPageContents.split(`alt="`);
              let found = false;
              for (let ti = 1; ti < thumbnails.length; ti++) {
                let altText = thumbnails[ti].split('"')[0];
                if (
                  productName &&
                  (altText.toLowerCase() === productName.toLowerCase() ||
                    altText
                      .toLowerCase()
                      .startsWith(productName.toLowerCase().slice(0, 5)) ||
                    altText
                      .toLowerCase()
                      .indexOf(productName.toLowerCase().slice(0, 5)) !== -1)
                ) {
                  let q = thumbnails[ti].split('src="');
                  if (q.length > 1) {
                    thumbnail = q[1].split('"')[0];
                    found = true;
                    break;
                  }
                }
              }
              if (!found) thumbnail = null;
            }
          } catch (e) {
            thumbnail = null;
          }
          if (i + 1 != products.length) {
            let nextItem = products[i + 1]
              .split("</div>")[0]
              .replace(/,/g, "")
              .split("<!-- -->");
            isDiscounted = nextItem.length > 1;
            if (isDiscounted) {
              i++;
              originalPrice = parseInt(nextItem[1]);
            }
          }
          result.push({
            name: (productName || "").trim(),
            link: clean(productLink as string).replace("http://", "https://"),
            current_price: currentPrice,
            original_price: originalPrice,
            discounted: isDiscounted,
            thumbnail,
            query_url: clean(productLink as string)
              .replace("www.flipkart.com", host + "/product")
              .replace("dl.flipkart.com", host + "/product"),
          });
        }
      } else {
        webPageContents = webPageContents.replace("₹", "Rs.");
        console.log(
          "Ignoring amount " +
            currentPrice +
            " : Suspected to be dropdown menu item"
        );
      }
    } catch (e: any) {
      console.log(e.message);
    }
  }

  return {
    total_result: result.length,
    query: q,
    fetch_from: searchURL,
    result,
  };
};

const clean = (link: string): string => {
  // delete all useless parameters from product url
  let url = new URL(link.replace(/amp;/g, ""));
  url.searchParams.delete("_appId");
  url.searchParams.delete("_refId");
  url.searchParams.delete("cmpid");
  url.searchParams.delete("marketplace");
  url.searchParams.delete("ppt");
  url.searchParams.delete("lid");
  url.searchParams.delete("store");
  url.searchParams.delete("spotlightTagId");
  url.searchParams.delete("q");
  url.searchParams.delete("srno");
  url.searchParams.delete("otracker");
  url.searchParams.delete("fm");
  url.searchParams.delete("iid");
  url.searchParams.delete("ppn");
  url.searchParams.delete("ssid");
  url.searchParams.delete("qH");
  return url.toString();
};

export default productSearch;
