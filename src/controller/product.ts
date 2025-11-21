import { Request, Response } from "express";
import crawler from "../service/scrapper";




export const getProductList = async (req:Request, res:Response) => {
   try{
   const {search} = req.query;
   const url = `https://www.flipkart.com/search?q=${encodeURIComponent(search as string)} `
   const data = await crawler.run([url]);
   return res.status(200).json({data});
   }catch(err){
     console.log('Error in getProductList:', err);
     return res.status(500).json({ error: 'Internal Server Error' });
   }

}