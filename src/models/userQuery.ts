import mongoose, { Schema } from "mongoose";
import { ScoredProduct } from "../service/productRelevanceEngine/types";

export interface IConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface IUserQuery {
  query: string;
  products: ScoredProduct[];
  messages?: IConversationMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}

const ConversationMessageSchema = new Schema<IConversationMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserQuerySchema = new Schema<IUserQuery>(
  {
    query: { type: String, required: true },
    products: { type: Schema.Types.Mixed, required: true },
    messages: { type: [ConversationMessageSchema], default: [] },
  },
  { timestamps: true }
);

export const UserQueryModel = mongoose.model<IUserQuery>(
  "UserQuery",
  UserQuerySchema
);
