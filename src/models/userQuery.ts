import mongoose, { Schema } from "mongoose";
import { ScoredProduct } from "../service/productRelevanceEngine/types";

export type TextMessage = {
  type: "text";
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
};

export type ProductViewMessage = {
  type: "product-view";
  product: {
    images: string[];
    specs: Record<string, Record<string, string>>;
    title: string;
    price: number;
  };
  verdict: string;
  afLink: {
    amazon: string;
  };
  role: "assistant";
  timestamp: Date;
};

export type IConversationMessage = TextMessage | ProductViewMessage;

export interface IUserQuery {
  query: string;
  products: ScoredProduct[];
  messages?: IConversationMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}

const ConversationMessageSchema = new Schema<IConversationMessage>(
  {
    type: { type: String, enum: ["text", "product-view"], required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    timestamp: { type: Date, default: Date.now },
    content: { type: String, required: false },
    product: {
      type: {
        images: [String],
        specs: Schema.Types.Mixed,
        title: String,
        price: Number,
      },
      required: false,
    },
    verdict: { type: String, required: false },
    afLink: {
      type: {
        amazon: String,
      },
      required: false,
    },
  },
  { _id: false, discriminatorKey: "type" }
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
