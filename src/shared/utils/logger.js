const winston = require('winston');
const { join } = require('path');

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, '../../logs');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'discord-bot' },
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({
            filename: join(logsDir, 'error.log'),
            level: 'error'
        }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({
            filename: join(logsDir, 'combined.log')
        }),
    ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = logger;