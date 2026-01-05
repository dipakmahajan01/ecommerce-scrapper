import express from "express";
import { getProductList } from "../../controller/product";
import { getProductRecommendations } from "../../controller/productRecommendation";

const productRoutes = express.Router();

productRoutes.get("/search", getProductList);
productRoutes.post("/recommend", getProductRecommendations);

export default productRoutes;
