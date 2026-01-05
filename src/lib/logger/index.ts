
import * as winston from 'winston';
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';

class TimestampFirst {
  enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  transform(obj: any) {
    if (this.enabled) {
      return { timestamp: obj.timestamp, ...obj };
    }
    return obj;
  }
}

const myFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  new TimestampFirst(true),
  winston.format.json()
);

const errorLogFilename = `./logs/error_${dayjs(new Date()).format('DD-MM-YYYY')}.log`;

const logger = winston.createLogger({
  level: 'info',
  format: myFormat,
  transports: [
    new winston.transports.File({
      filename: errorLogFilename,
      level: 'error',
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}

// Cleanup function to remove empty log files on startup
function cleanupEmptyLogFiles() {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      return;
    }

    const files = fs.readdirSync(logsDir);
    files.forEach((file) => {
      if (file.startsWith('error_') && file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        // Delete file if it's empty (0 bytes) or only contains whitespace
        if (stats.size === 0) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8').trim();
            if (content === '') {
              fs.unlinkSync(filePath);
              console.log(`[Logger] Cleaned up empty log file: ${file}`);
            }
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
      }
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Run cleanup on module load
cleanupEmptyLogFiles();

// Also cleanup empty log files periodically (every hour)
setInterval(() => {
  cleanupEmptyLogFiles();
}, 60 * 60 * 1000);

export default logger;
