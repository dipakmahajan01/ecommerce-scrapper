import app from "./index";
import databaseConnection from "./config/db";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  try {
    // await databaseConnection();
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on port ${process.env.PORT || 8000}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
