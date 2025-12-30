import mongoose from "mongoose";

const databaseConnection = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI environment variable is not set. " +
          "Please create a .env file with MONGODB_URI=your_mongodb_connection_string"
      );
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
    return mongoose.connection;
  } catch (error) {
    console.log("error connecting to MongoDB", error);
    throw error;
  }
};
export default databaseConnection;
