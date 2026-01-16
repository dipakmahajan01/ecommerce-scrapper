import mongoose, { Schema } from "mongoose";
import { ScoredProduct } from "../service/productRelevanceEngine/types";

export interface IUserQuery {
  query: string;
  products: ScoredProduct[];
  createdAt?: Date;
  updatedAt?: Date;
}

const UserQuerySchema = new Schema<IUserQuery>(
  {
    query: { type: String, required: true },
    products: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const UserQueryModel = mongoose.model<IUserQuery>(
  "UserQuery",
  UserQuerySchema
);
