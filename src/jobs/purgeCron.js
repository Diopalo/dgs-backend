'use strict';

const cron   = require('node-cron');
const prisma = require('../configuration/prismaClient');
const logger = require('../utils/logger');

const RETENTION_DAYS = 90;

async function purgeOldData() {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - RETENTION_DAYS);

  logger.info(`[PURGE] Démarrage — suppression des données antérieures au ${dateLimit.toISOString()}`);

  try {
    const [auditsDel, positionsDel] = await Promise.all([
      prisma.auditResult.deleteMany({ where: { crawledAt: { lt: dateLimit } } }),
      prisma.positionnement.deleteMany({ where: { mesuredAt: { lt: dateLimit } } }),
    ]);

    const result = {
      audits_deleted:    auditsDel.count,
      positions_deleted: positionsDel.count,
    };

    logger.info(`[PURGE] Terminé — ${result.audits_deleted} audit(s) supprimé(s), ${result.positions_deleted} position(s) supprimée(s)`);
    return result;
  } catch (err) {
    logger.error(`[PURGE] Erreur : ${err.message}`, { stack: err.stack });
    throw err;
  }
}

function startPurgeCron() {
  cron.schedule('0 2 * * *', async () => {
    await purgeOldData().catch(err =>
      logger.error('[PURGE] Erreur cron non capturée', { message: err.message })
    );
  }, { timezone: 'UTC' });

  logger.info('[PURGE] Tâche planifiée — exécution chaque jour à 02:00 UTC');
}

module.exports = { purgeOldData, startPurgeCron };
