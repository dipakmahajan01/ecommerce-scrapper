export class LocalState {
  private state: Map<string, unknown>;

  constructor() {
    this.state = new Map<string, unknown>();
  }

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  has(key: string): boolean {
    return this.state.has(key);
  }

  clear(): void {
    this.state.clear();
  }
}
