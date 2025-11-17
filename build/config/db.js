"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const databaseConnection = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable is not set. ' +
                'Please create a .env file with MONGODB_URI=your_mongodb_connection_string');
        }
        await mongoose_1.default.connect(mongoUri);
        console.log("Connected to MongoDB");
        return mongoose_1.default.connection;
    }
    catch (error) {
        console.log("error connecting to MongoDB", error);
        throw error;
    }
};
exports.default = databaseConnection;
