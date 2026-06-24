'use strict';

const config = require('./src/config');
const logger = require('./src/utils/logger');
const app    = require('./src/app');
const { startPurgeCron } = require('./src/jobs/purgeCron');

const server = app.listen(config.port, () => {
  logger.info(`Serveur démarré sur http://localhost:${config.port}`, {
    env:  config.env,
    port: config.port,
  });
  startPurgeCron();
});

// Arrêt gracieux
const shutdown = async (signal) => {
  logger.info(`Signal ${signal} reçu — arrêt gracieux…`);
  server.close(async () => {
    const prisma = require('./src/configuration/prismaClient');
    await prisma.$disconnect();
    logger.info('Serveur arrêté.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
