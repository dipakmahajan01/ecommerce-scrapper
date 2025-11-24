import fs from "fs";
import path from "path";

type PhoneTuple = [
  number,
  number,
  string,
  string | null,
  string | null,
  string | null
];

type BrandList = string[];

type PhoneList = PhoneTuple[];

type ApiResponse = [BrandList, PhoneList];

type NormalizedPhone = {
  id: number;
  maker: string;
  name: string;
  full: string;
  searchString: string;
  original: PhoneTuple;
};

type SearchResult = {
  rank: number;
  score: number;
  queryTerms: {
    tokens: string[];
    ngrams: string[];
    allTerms: string[];
  };
  phone: {
    id: number;
    maker: string;
    name: string;
  };
  url: string;
};

type TestResult = {
  query: string;
  originalQuery: string;
  top5Results: SearchResult[];
};

let cached: ApiResponse | null = null;
let cachedIndex: BM25Index | null = null;
let cachedPhones: NormalizedPhone[] | null = null;
let cachedBrandList: BrandList | null = null;

async function tryCatch<T>(
  promise: Promise<T>
): Promise<{ data?: T; error?: Error }> {
  try {
    const data = await promise;
    return { data };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGsmArenaPhoneList(): Promise<{
  phoneList: PhoneList;
  brandList: BrandList;
}> {
  if (cached) {
    const [brandList, phoneList] = cached;
    return {
      brandList,
      phoneList,
    };
  }

  const URL = "https://www.gsmarena.com/quicksearch-81627.jpg";
  let response = await tryCatch(fetch(URL).then((res) => res.json()));

  let RETRY_COUNT = 0;
  const MAX_RETRY_COUNT = 3;
  const RETRY_DELAY = 10 * 1000;

  while (response.error && RETRY_COUNT < MAX_RETRY_COUNT) {
    await waitFor(RETRY_DELAY);
    response = await tryCatch(fetch(URL).then((res) => res.json()));
    RETRY_COUNT += 1;
  }

  if (RETRY_COUNT >= MAX_RETRY_COUNT && response.error) {
    throw new Error("Failed to fetch the data");
  }

  cached = response.data as ApiResponse;
  const [brandList, phoneList] = response.data as ApiResponse;

  return { phoneList, brandList };
}

function normalizePhone(tuple: PhoneTuple, makers: BrandList): NormalizedPhone {
  const MAKER_ID = 0;
  const PHONE_ID = 1;
  const PHONE_NAME = 2;
  const SEARCH_STR = 3;
  const OVERRIDE = 5;

  const maker = makers[tuple[MAKER_ID]] || "";
  const name = tuple[OVERRIDE] || tuple[PHONE_NAME] || "";
  const full = (maker + " " + name).trim().toLowerCase();

  return {
    id: tuple[PHONE_ID],
    maker,
    name,
    full,
    searchString: tuple[SEARCH_STR]?.toLowerCase() || "",
    original: tuple,
  };
}

async function initializeIndex(): Promise<{
  index: BM25Index;
  phones: NormalizedPhone[];
  brandList: BrandList;
}> {
  if (cachedIndex && cachedPhones && cachedBrandList) {
    return {
      index: cachedIndex,
      phones: cachedPhones,
      brandList: cachedBrandList,
    };
  }

  const { data, error } = await tryCatch(getGsmArenaPhoneList());
  if (error) {
    throw new Error("Failed to fetch phone data");
  }

  const phones = data!.phoneList.map((phone: PhoneTuple) =>
    normalizePhone(phone, data!.brandList)
  );

  const index = new BM25Index();
  index.index(phones);

  writeDataToFile("index-documents.json", phones);

  cachedIndex = index;
  cachedPhones = phones;
  cachedBrandList = data!.brandList;

  return {
    index,
    phones,
    brandList: data!.brandList,
  };
}

class BM25Index {
  private documents: NormalizedPhone[] = [];
  private termFreq: Map<string, Map<number, number>> = new Map();
  private docFreq: Map<string, number> = new Map();
  private docLengths: number[] = [];
  private avgDocLength: number = 0;
  private readonly k1: number = 1.5;
  private readonly b: number = 0.75;
  private readonly nGramSize: number = 2;

  private generateNGrams(text: string, n: number = this.nGramSize): string[] {
    const normalized = text.toLowerCase();
    const nGrams: string[] = [];
    for (let i = 0; i <= normalized.length - n; i++) {
      nGrams.push(normalized.substring(i, i + n));
    }
    return nGrams;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  index(documents: NormalizedPhone[]): void {
    this.documents = documents;
    this.termFreq.clear();
    this.docFreq.clear();
    this.docLengths = [];

    documents.forEach((doc, docIndex) => {
      const searchableText = doc.full.toLowerCase();
      const tokens = this.tokenize(searchableText);
      const nGrams = this.generateNGrams(searchableText, this.nGramSize);
      const allTerms = [...tokens, ...nGrams];

      this.docLengths[docIndex] = allTerms.length;

      const termCounts = new Map<string, number>();
      allTerms.forEach((term) => {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      });

      termCounts.forEach((count, term) => {
        if (!this.termFreq.has(term)) {
          this.termFreq.set(term, new Map());
        }
        this.termFreq.get(term)!.set(docIndex, count);
        this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
      });
    });

    this.avgDocLength =
      this.docLengths.reduce((sum, len) => sum + len, 0) /
        this.docLengths.length || 1;
  }

  search(
    query: string,
    topK: number = 1
  ): Array<{
    document: NormalizedPhone;
    score: number;
    queryTerms: { tokens: string[]; ngrams: string[]; allTerms: string[] };
  }> {
    const queryTokens = this.tokenize(query);
    const queryNGrams = this.generateNGrams(query, this.nGramSize);
    const queryTerms = [...queryTokens, ...queryNGrams];

    const scores = new Map<number, number>();

    queryTerms.forEach((term) => {
      const df = this.docFreq.get(term) || 0;
      if (df === 0) return;

      const idf = Math.log((this.documents.length - df + 0.5) / (df + 0.5) + 1);

      const termDocs = this.termFreq.get(term);
      if (!termDocs) return;

      termDocs.forEach((freq, docIndex) => {
        const docLength = this.docLengths[docIndex];
        const score =
          (idf * freq * (this.k1 + 1)) /
          (freq +
            this.k1 * (1 - this.b + (this.b * docLength) / this.avgDocLength));

        scores.set(docIndex, (scores.get(docIndex) || 0) + score);
      });
    });

    const queryTermsData = {
      tokens: queryTokens,
      ngrams: queryNGrams,
      allTerms: queryTerms,
    };

    const sortedDocs = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([docIndex, score]) => ({
        document: this.documents[docIndex],
        score: score,
        queryTerms: queryTermsData,
      }));

    return sortedDocs;
  }
}

export async function searchPhones({
  query,
  topK = 2,
}: {
  query: string;
  topK?: number;
}): Promise<SearchResult[]> {
  const { index, phones, brandList } = await initializeIndex();

  const results = index.search(query, topK);

  return results.map((result, index) => {
    const phone = result.document;
    const makerId = phone.original[0];
    const maker = brandList[makerId] || "unknown";
    const finalName =
      phone.original[5]?.trim() || phone.original[2]?.trim() || "";

    const slug = (maker + " " + finalName)
      .toLowerCase()
      .replace(/\s+|-|\/|\./g, "_");

    return {
      rank: index + 1,
      score: result.score,
      queryTerms: result.queryTerms,
      phone: {
        id: phone.id,
        maker: phone.maker,
        name: phone.name,
      },
      url: `https://www.gsmarena.com/${slug}-${phone.id}.php`,
    };
  });
}

const DATA_DIR = path.resolve(process.cwd(), "data");

function writeDataToFile(filename: string, data: unknown): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readDataFromFile(filename: string): unknown {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

export function viewResults(filename: string = "search-results.json"): unknown {
  return readDataFromFile(filename);
}

export async function testFindPhoneURL(): Promise<TestResult[]> {
  const tests = [
    "realme 11x 5G (Purple Dawn, 128 GB)",
    "realme 11x 5G (Purple Dawn, 128 GB)",
    "realme 11x 5G (Midnight Black, 128 GB)",
    "realme 11x 5G (Midnight Black, 128 GB)",
    "realme 11 Pro+ 5G (Sunrise Beige, 256 GB)",
    "realme 11 Pro+ 5G (Astral Black, 256 GB)",
    "realme C53 (Champion Black, 64 GB)",
    "realme 11 Pro 5G (Astral Black, 256 GB)",
    "realme 11 Pro+ 5G (Oasis Green, 256 GB)",
    "realme 11 Pro 5G (Sunrise Beige, 256 GB)",
    "realme 11 5G (Glory Gold, 128 GB)",
    "realme 11 Pro+ 5G (Sunrise Beige, 256 GB)",
    "realme C55 (Sunshower, 128 GB)",
    "realme C55 (Rainy Night, 64 GB)",
    "realme C55 (Sunshower, 64 GB)",
    "realme GT 5G (Dashing Silver, 128 GB)",
    "realme 9i 5G (Metallica Gold, 64 GB)",
    "realme 9i 5G (Rocking Black, 64 GB)",
    "realme GT 5G (Dashing Blue, 128 GB)",
    "realme Narzo 50 (Speed Black, 128 GB)",
    "realme Narzo 50 (Speed Black, 64 GB)",
    "realme Narzo 50i (Carbon Black, 32 GB)",
    "realme C30 (Denim Black, 32 GB)",
    "realme Narzo 50i (Mint Green, 32 GB)",
    "MOTOROLA G96 5G",
    "Infinix Note 50s 5G+",
    "Tecno Pova 7 5G",
    "REDMI 15 5G",
    "MOTOROLA G86 Power 5G",
    "REDMI Note 14 5G ",
    "realme 15x 5G",
    "vivo T4R 5G",
    "CMF by Nothing Phone 2 Pro",
    "POCO X7 5G",
    "Motorola G85 5G ",
    "vivo T4x 5G ",
  ];

  function preprocessName(text: string) {
    return text.replace(/\([^)]*\)/g, "").trim(); // Remove () bracket and it's content
  }

  const res: TestResult[] = [];
  for (const query of tests) {
    const cleaned = preprocessName(query);
    console.log(`Query: "${cleaned}" is starting`);

    const { data, error } = await tryCatch(
      searchPhones({ query: cleaned, topK: 2 })
    );

    if (error) {
      console.error("ERRor", error);
      return res;
    }

    console.log(`Query: "${cleaned}" → Top 5 Results:`, data);
    res.push({
      query: cleaned,
      originalQuery: query,
      top5Results: data || [],
    });
  }

  writeDataToFile("search-results.json", res);
  console.log(`Results saved to ${path.join(DATA_DIR, "search-results.json")}`);

  return res;
}
