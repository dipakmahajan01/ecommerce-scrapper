// JobManager.ts
export interface ScrapeResult<T = any> {
  url: string;
  data?: T;
  error?: string;
}

interface Job<T> {
  resolve: (res: ScrapeResult<T>) => void;
  reject: (err: any) => void;
  timeoutId: NodeJS.Timeout;
}

export class JobManager<T = any> {
  private jobMap: Map<string, Job<T>> = new Map();
  private defaultTimeout: number;

  constructor(timeoutMs = 30_000) {
    this.defaultTimeout = timeoutMs;
  }

  public createJob(jobId: string, url: string): Promise<ScrapeResult<T>> {
    return new Promise<ScrapeResult<T>>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.jobMap.delete(jobId);
        resolve({ url, error: `Timeout after ${this.defaultTimeout} ms` });
      }, this.defaultTimeout);

      this.jobMap.set(jobId, { resolve, reject, timeoutId });
    });
  }

  public completeJob(jobId: string, result: ScrapeResult<T>): void {
    const job = this.jobMap.get(jobId);
    if (!job) return;
    clearTimeout(job.timeoutId);
    job.resolve(result);
    this.jobMap.delete(jobId);
  }

  public failJob(jobId: string, url: string, error: any): void {
    const job = this.jobMap.get(jobId);
    if (!job) return;
    clearTimeout(job.timeoutId);
    job.resolve({
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    this.jobMap.delete(jobId);
  }
}
