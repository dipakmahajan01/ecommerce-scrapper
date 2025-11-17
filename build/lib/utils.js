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
exports.logInfo = exports.logsError = exports.logsErrorAndUrl = exports.otpAge = exports.generateOTP = exports.DateFormat = exports.logDateFormat = void 0;
exports.responseGenerators = responseGenerators;
exports.weekNumberFormat = weekNumberFormat;
exports.yearlyFormat = yearlyFormat;
exports.dateFormat = dateFormat;
exports.timeFormat = timeFormat;
exports.dayFormat = dayFormat;
exports.DDMMYYYYFormat = DDMMYYYYFormat;
exports.responseValidation = responseValidation;
exports.extractJwtToken = extractJwtToken;
exports.jsonCleaner = jsonCleaner;
const dotenv = __importStar(require("dotenv"));
const logger_1 = __importDefault(require("./logger"));
dotenv.config();
function responseGenerators(responseData, responseStatusCode, responseStatusMsg, responseErrors, token, refreshToken) {
    const responseJson = {};
    responseJson.data = responseData;
    responseJson.status_code = responseStatusCode;
    responseJson.status_message = responseStatusMsg;
    // errors
    if (responseErrors === undefined) {
        responseJson.response_error = [];
    }
    else {
        responseJson.response_error = responseErrors;
    }
    // token
    if (token !== undefined && refreshToken !== undefined) {
        responseJson.token = token;
        responseJson.refreshToken = refreshToken;
    }
    return responseJson;
}
const logDateFormat = () => {
    return 'DD-MM-YYYY';
};
exports.logDateFormat = logDateFormat;
const DateFormat = () => {
    // return only date ex:2021-11-25 00:00:00
    return 'YYYY-MM-DD 00:00:00';
};
exports.DateFormat = DateFormat;
function weekNumberFormat() {
    // return only digit ex:0-6 sunday as 0
    return 'd';
}
function yearlyFormat() {
    // return only DD-MM
    return 'DD-MM';
}
function dateFormat() {
    return 'YYYY-MM-DD HH:mm:ss';
}
function timeFormat() {
    return 'HH:mm:00';
}
function dayFormat() {
    return 'dddd';
}
function DDMMYYYYFormat() {
    return 'DD-MM-YYYY';
}
function responseValidation(responseStatusCode, responseStatusMsg, responseErrors) {
    const responseValidationJson = {};
    responseValidationJson.status_code = responseStatusCode;
    responseValidationJson.status_message = responseStatusMsg;
    // errors
    if (responseErrors === undefined) {
        responseValidationJson.response_error = [];
    }
    else {
        responseValidationJson.response_error = responseErrors;
    }
    return responseValidationJson;
}
const generateOTP = function (otpLength = 6) {
    const baseNumber = 10 ** (otpLength - 1);
    let number = Math.floor(Math.random() * baseNumber);
    if (number < baseNumber) {
        number += baseNumber;
    }
    return number;
};
exports.generateOTP = generateOTP;
exports.otpAge = parseInt(process.env.OTP_AGE, 10) || 3;
const logsErrorAndUrl = (req, error) => {
    const errorMessage = typeof error === 'object' ? error.message : error;
    const errorStack = typeof error === 'object' ? error.stack : null;
    logger_1.default.error(`${errorMessage}, time: ${new Date().toISOString()}, path: ${req.url}`, errorStack);
};
exports.logsErrorAndUrl = logsErrorAndUrl;
const logsError = (error, data) => {
    const errorMessage = typeof error === 'object' ? error.message : error;
    const errorStack = typeof error === 'object' ? error.stack : null;
    logger_1.default.error(`${errorMessage}, time: ${new Date().toISOString()}`, [errorStack, data]);
};
exports.logsError = logsError;
const logInfo = (msg, ...meta) => {
    logger_1.default.info(msg, { meta });
};
exports.logInfo = logInfo;
function extractJwtToken(authorizationHeader) {
    const match = authorizationHeader?.match(/^Bearer (.+)$/i);
    return match ? match[1] : null;
}
function jsonCleaner(jsonArray) {
    const jsonString = JSON.stringify(jsonArray);
    const cleanedString = jsonString.replace(/\\n/g, '').replace(/\s+/g, ' ').trim();
    const trimmedString = cleanedString.replace(/"\s+|\s+"/g, '"');
    return JSON.parse(trimmedString);
}
