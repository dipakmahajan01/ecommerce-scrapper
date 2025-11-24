import mongoose, { Schema } from 'mongoose';

export interface ISoc {
  title?: string | null;
  description?: string | null;
  reviewScores?: Array<{ name: string; value: string }>;
  antutu?: { total?: string | null; breakdown?: Record<string, string> } | null;
  recentAntutu?: Array<{ date: string; score: string; user: string; phone: string }>;
  geekbench?: { breakdown?: Record<string, string> } | null;
  smartphones?: Array<{ name: string; url?: string | null; score?: string | null }>;
  sections?: Record<string, Record<string, string>> | null;
}

const SocSchema = new Schema<ISoc>({
  title: { type: String, index: true },
  description: String,
  reviewScores: [
    {
      name: String,
      value: String,
    },
  ],
  antutu: {
    total: String,
    breakdown: { type: Map, of: String },
  },
  recentAntutu: [
    {
      date: String,
      score: String,
      user: String,
      phone: String,
    },
  ],
  geekbench: {
    breakdown: { type: Map, of: String },
  },
  smartphones: [
    {
      name: String,
      url: String,
      score: String,
    },
  ],
  sections: { type: Schema.Types.Mixed },
}, { timestamps: true });

export const SocModel = mongoose.models.Soc || mongoose.model<ISoc>('Soc', SocSchema);

export async function saveSoc(parsed: ISoc) {
  if (!parsed || !parsed.title) {
    throw new Error('Parsed object must have a title to save');
  }

  // upsert by title
  const result = await SocModel.findOneAndUpdate(
    { title: parsed.title },
    { $set: parsed },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  return result;
}
