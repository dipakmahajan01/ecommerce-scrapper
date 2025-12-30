import { SocModel, ISoc } from "../../models/soc";

export class SocDataSingleton {
  private static instance: SocDataSingleton;
  private socData: ISoc[] = [];
  private loaded: boolean = false;

  private constructor() {}

  public static getInstance(): SocDataSingleton {
    if (!SocDataSingleton.instance) {
      SocDataSingleton.instance = new SocDataSingleton();
    }
    return SocDataSingleton.instance;
  }

  public async fetchSocData(): Promise<ISoc[]> {
    if (this.loaded) return this.socData;
    try {
      const docs = await SocModel.find({}).lean();
      this.socData = docs as unknown as ISoc[];
      this.loaded = true;
      return this.socData;
    } catch (error) {
      console.error("Error fetching SoC data:", error);
      return [];
    }
  }

  public getSocDataCached(): ISoc[] {
    return this.socData;
  }
}

export default SocDataSingleton;
