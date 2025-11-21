import express from 'express';
import { getProductList } from '../../controller/product';

const productRoutes = express.Router();

productRoutes.get('/search',getProductList)

export default productRoutes;