"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductList = void 0;
const scrapper_1 = __importDefault(require("../service/scrapper"));
const getProductList = async (req, res) => {
    try {
        const { search } = req.query;
        const url = `https://www.flipkart.com/search?q=${encodeURIComponent(search)} `;
        const data = await scrapper_1.default.run([url]);
        return res.status(200).json({ data });
    }
    catch (err) {
        console.log('Error in getProductList:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getProductList = getProductList;
