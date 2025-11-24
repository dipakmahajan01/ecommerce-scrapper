import { tryCatch, waitFor } from "../../lib";

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
  url: string;
};

type SearchResultItem = {
  document: NormalizedPhone;
  score: number;
  queryTerms: {
    tokens: string[];
    ngrams: string[];
    allTerms: string[];
  };
};

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const API_URL = "https://www.gsmarena.com/quicksearch-81627.jpg";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10 * 1000;

const MAKER_ID = 0;
const PHONE_ID = 1;
const PHONE_NAME = 2;
const SEARCH_STR = 3;
const OVERRIDE = 5;

async function fetchPhoneData(): Promise<{
  phoneList: PhoneList;
  brandList: BrandList;
}> {
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    const response = await tryCatch(fetch(API_URL).then((res) => res.json()));

    if (response.data) {
      const [brandList, phoneList] = response.data as ApiResponse;
      return { phoneList, brandList };
    }

    if (retryCount < MAX_RETRIES - 1) {
      await waitFor(RETRY_DELAY_MS);
    }

    retryCount++;
  }

  throw new Error("Failed to fetch phone data after retries");
}

function normalizePhone(
  tuple: PhoneTuple,
  makers: BrandList,
  baseUrl: string = "https://www.gsmarena.com/"
): NormalizedPhone {
  const maker = makers[tuple[MAKER_ID]] || "";
  const name = tuple[OVERRIDE]?.trim() || tuple[PHONE_NAME]?.trim() || "";
  const full = (maker + " " + name).trim().toLowerCase();

  const slug = (maker + " " + name).toLowerCase().replace(/\s+|-|\/|\./g, "_");

  const pathname = `${slug}-${tuple[PHONE_ID]}.php`;
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const url = new URL(pathname, base).toString();

  return {
    id: tuple[PHONE_ID],
    maker,
    name,
    full,
    searchString: tuple[SEARCH_STR]?.toLowerCase() || "",
    original: tuple,
    url,
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

  search(query: string, topK: number = 1): SearchResultItem[] {
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

class CacheManager {
  private static instance: CacheManager;
  private cache: CacheEntry<{
    index: BM25Index;
    phones: NormalizedPhone[];
    brandList: BrandList;
  }> | null = null;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > CACHE_TTL_MS;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  get(): {
    index: BM25Index;
    phones: NormalizedPhone[];
    brandList: BrandList;
  } | null {
    if (!this.cache) {
      return null;
    }

    if (this.isExpired(this.cache.timestamp)) {
      this.cache = null;
      return null;
    }

    return {
      index: this.cache.data.index,
      phones: this.deepClone(this.cache.data.phones),
      brandList: this.deepClone(this.cache.data.brandList),
    };
  }

  set(data: {
    index: BM25Index;
    phones: NormalizedPhone[];
    brandList: BrandList;
  }): void {
    this.cache = {
      data: {
        index: data.index,
        phones: this.deepClone(data.phones),
        brandList: this.deepClone(data.brandList),
      },
      timestamp: Date.now(),
    };
  }
}

function createIndex(
  phones: NormalizedPhone[],
  brandList: BrandList
): { index: BM25Index; phones: NormalizedPhone[]; brandList: BrandList } {
  const index = new BM25Index();
  index.index(phones);
  return { index, phones, brandList };
}

async function getIndex(): Promise<{
  index: BM25Index;
  phones: NormalizedPhone[];
  brandList: BrandList;
}> {
  const cacheManager = CacheManager.getInstance();
  const cached = cacheManager.get();

  if (cached) {
    return cached;
  }

  const { phoneList, brandList } = await fetchPhoneData();

  const phones = phoneList.map((phone: PhoneTuple) =>
    normalizePhone(phone, brandList)
  );

  const indexData = createIndex(phones, brandList);

  cacheManager.set(indexData);

  return indexData;
}

export async function searchPhone(
  query: string
): Promise<NormalizedPhone | null> {
  const { index } = await getIndex();

  const results = index.search(query, 1);

  if (!results || results.length === 0) {
    return null;
  }

  return results[0].document;
}
