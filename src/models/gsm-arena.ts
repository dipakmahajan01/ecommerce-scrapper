import mongoose, { Schema } from "mongoose";

export interface IGsmArena extends Record<string, any> {}

const GsmArenaSchema = new Schema<IGsmArena>(
  {},
  { strict: false, timestamps: true }
);

export const GsmArenaModel = mongoose.model<IGsmArena>(
  "GsmArena",
  GsmArenaSchema
);
