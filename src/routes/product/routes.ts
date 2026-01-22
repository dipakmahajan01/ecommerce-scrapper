import express from "express";
import { getProductList } from "../../controller/product";
import { getProductRecommendations } from "../../controller/productRecommendation";
import { getProductRecommendation } from "../../controller/getProductRecommendation";
import { handleConversation } from "../../controller/conversation";

const productRoutes = express.Router();

productRoutes.get("/search", getProductList);
productRoutes.post("/recommend", getProductRecommendations);
productRoutes.get("/recommend/:id", getProductRecommendation);
productRoutes.post("/conversation/:id", handleConversation);

export default productRoutes;
