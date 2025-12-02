import { JobManager, ScrapeResult } from "../../lib";
import { CheerioCrawler, Configuration } from "crawlee";

type Specs = { [section: string]: { [label: string]: string } };

interface SpecValue {
  section: string;
  key: string;
  label: string;
  values: string[];
}

function groupSpecs(specs: SpecValue[]) {
  const result: Specs = {};

  for (const item of specs) {
    const sectionKey = item.section.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const fieldKey = item.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    if (!result[sectionKey]) result[sectionKey] = {};

    // Join multiple values for same field
    result[sectionKey][fieldKey] = item.values.join(" | ");
  }

  return result;
}

export class SpecsCrawler {
  private crawler: CheerioCrawler;
  private jobManager: JobManager<Specs>;

  constructor(jobManager: JobManager<Specs> = new JobManager()) {
    this.jobManager = jobManager;

    this.crawler = new CheerioCrawler(
      {
        keepAlive: true,
        maxConcurrency: 5,
        maxRequestRetries: 2,
        maxRequestsPerMinute: 100,
        requestHandlerTimeoutSecs: 30,

        // Core parse logic:
        requestHandler: async ({ request, $, log }) => {
          const { jobId, originalUrl } = request.userData as {
            jobId: string;
            originalUrl: string;
          };
          try {
            const specs: SpecValue[] = [];

            $("#specs-list > table").each((_, table) => {
              const $table = $(table);
              const section = $table
                .find('th[scope="row"]')
                .first()
                .text()
                .trim();
              if (!section) return;

              let lastItem: SpecValue | null = null;

              $table.find("tr").each((_, row) => {
                const $row = $(row);
                const $ttl = $row.find(".ttl").first();
                const $nfo = $row.find(".nfo").first();

                if (!$nfo.length) return; // no value, skip

                const ttlText = $ttl.text().replace(/\s+/g, " ").trim();
                const dataSpec = $nfo.attr("data-spec")?.trim();

                // parse HTML inside .nfo and split by <hr>
                const rawHtml = $nfo.html() || "";
                const valuePieces = [
                  rawHtml
                    .split(/<hr[^>]*>/i)
                    .map((fragment) =>
                      $.load(fragment).root().text().replace(/\s+/g, " ").trim()
                    )
                    .filter(Boolean)
                    .join(", "),
                ];

                if (!valuePieces.length) return;

                // Decide key + label
                let key = dataSpec;
                let label = ttlText;

                // Continuation row (no ttl + no data-spec) → attach to previous item
                const isContinuation = !ttlText && !dataSpec;
                if (isContinuation && lastItem) {
                  lastItem.values.push(...valuePieces);
                  return;
                }

                // If no data-spec, generate stable-ish key
                if (!key) {
                  if (ttlText) {
                    key = ttlText
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "_")
                      .replace(/^_+|_+$/g, "");
                  } else if (lastItem) {
                    // Fallback: same key as previous if only label changed (rare case)
                    key = lastItem.key;
                  } else {
                    key = "unknown";
                  }
                }

                // If label empty but we have a key, use key as label fallback
                if (!label) label = key;

                const item: SpecValue = {
                  section,
                  key,
                  label,
                  values: valuePieces,
                };

                specs.push(item);
                lastItem = item;
              });
            });

            this.jobManager.completeJob(jobId, {
              url: originalUrl,
              data: groupSpecs(specs),
            });
          } catch (err) {
            this.jobManager.failJob(jobId, request.url, err);
          }
        },
        failedRequestHandler: async ({ request, error }) => {
          const { jobId, originalUrl } = request.userData as {
            jobId: string;
            originalUrl: string;
          };
          this.jobManager.failJob(jobId, originalUrl, error);
        },
      },
      new Configuration({ persistStorage: false })
    );

    (async () => {
      try {
        await this!.crawler.run();
      } catch (e) {
        console.error("Error while running spec scrapper", e);
      }
    })();
  }

  public async processURL(url: string): Promise<ScrapeResult<Specs>> {
    const jobId = crypto.randomUUID();
    const promise = this.jobManager.createJob(jobId, url);
    const r = await this.crawler.addRequests(
      [{ url, userData: { jobId, originalUrl: url } }],
      {
        batchSize: 5,
        waitBetweenBatchesMillis: 20_000,
      }
    );
    console.log(JSON.stringify(r, null, 2));
    return promise;
  }
}
