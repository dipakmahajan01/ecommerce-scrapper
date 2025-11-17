"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const bodyParser = __importStar(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express")); // NextFunction,
const http_1 = __importDefault(require("http"));
// import helmet from 'helmet';
const cors_1 = __importDefault(require("cors"));
const http_status_codes_1 = require("http-status-codes");
// import { Server } from 'socket.io';
const logger_1 = __importDefault(require("./lib/logger"));
const lib_1 = require("./lib");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = new http_1.default.Server(app);
app.use((0, cors_1.default)());
// const io = new Server(server,{cors: {origin: "*"}});
// app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '1tb' }));
app.use((req, res, next) => {
    try {
        // set header for swagger.
        res.setHeader('Content-Security-Policy', "default-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; frame-src 'self';");
        // end
        const xForwardedFor = (req.headers['x-forwarded-for'] || '').replace(/:\d+$/, '');
        const ip = xForwardedFor || req.connection.remoteAddress?.split(':').pop();
        logger_1.default.info(`------------ API Info ------------
      IMP - API called path: ${req.path},
      method: ${req.method},
      query: ${JSON.stringify(req.query)}, 
      remote address (main/proxy ip):${ip},
      reference: ${req.headers.referer} , 
      user-agent: ${req.headers['user-agent']}
      ------------ End ------------  `);
    }
    catch (error) {
        logger_1.default.error(`error while printing caller info path: ${req.path}`);
    }
    next();
});
const health = (req, res) => {
    res.json({
        message: 'ecomsoft is working properly please check your api',
        env: process.env.NODE_ENV,
        headers: req.headers,
    });
};
app.get('/', health);
app.use((req, res) => {
    return res
        .status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR)
        .send((0, lib_1.responseValidation)(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'No route found'));
});
app.use((error, req, res) => {
    // , next: NextFunction
    (0, lib_1.logInfo)('app error----------------->', error.message);
    return res.status(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR).send((0, lib_1.responseValidation)(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 
    /* If the environment is development, then return the error message, otherwise return an empty
      object. */
    process.env.NODE_ENV === 'development' ? error.message : {}));
});
process.on('unhandledRejection', function (reason, promise) {
    const errorMessage = reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
            ? reason
            : JSON.stringify(reason, Object.getOwnPropertyNames(reason));
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger_1.default.error('Unhandled rejection', {
        error: errorMessage,
        stack,
        promise: promise?.toString?.() || 'Promise object'
    });
});
exports.default = app;
