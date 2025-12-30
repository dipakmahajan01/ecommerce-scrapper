import mongoose, { Schema } from "mongoose";

const smartPrixSchema = new Schema<any>(
  {},
  { strict: false, timestamps: true }
);

export const smartPrixResponse = mongoose.model<any>(
  "smartPrixResponse",
  smartPrixSchema
);
