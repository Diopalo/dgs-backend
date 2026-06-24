'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const config = require('../config');

const { combine, timestamp, json, colorize, printf, errors } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, service, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${service || 'dgs-seo-api'}] ${message}${extra}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logTransports = [
  new transports.File({
    filename:  path.join(config.logs.dir, 'error.log'),
    level:     'error',
    maxsize:   10 * 1024 * 1024,
    maxFiles:  7,
    tailable:  true,
  }),
  new transports.File({
    filename:  path.join(config.logs.dir, 'combined.log'),
    maxsize:   10 * 1024 * 1024,
    maxFiles:  7,
    tailable:  true,
  }),
];

if (!config.isProd) {
  logTransports.push(new transports.Console({ format: devFormat }));
}

const logger = createLogger({
  level:            config.logs.level,
  defaultMeta:      { service: 'dgs-seo-api' },
  format:           config.isProd ? prodFormat : devFormat,
  transports:       logTransports,
  exceptionHandlers: [
    new transports.File({ filename: path.join(config.logs.dir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(config.logs.dir, 'rejections.log') }),
  ],
});

module.exports = logger;
