'use strict';

const prisma  = require('../configuration/prismaClient');
const logger  = require('../utils/logger');
const { purgeOldData } = require('../jobs/purgeCron');
const config  = require('../config');
const fs      = require('fs');
const path    = require('path');

// GET /health
const healthCheck = async (req, res) => {
  let dbStatus = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  const body = {
    status:          dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp:       new Date().toISOString(),
    version:         '1.0.0',
    uptime_seconds:  Math.floor(process.uptime()),
    services: {
      database: dbStatus,
      crawler:  'ok',
    },
  };

  res.status(dbStatus === 'ok' ? 200 : 503).json(body);
};

// GET /api/admin/stats
const getStats = async (req, res, next) => {
  try {
    const [
      total_sites,
      total_audits,
      total_keywords,
      total_positions,
      total_recommandations,
      audits_en_cours,
    ] = await Promise.all([
      prisma.site.count(),
      prisma.auditResult.count(),
      prisma.keyword.count(),
      prisma.positionnement.count(),
      prisma.recommandation.count(),
      prisma.auditResult.count({ where: { statut: 'en_cours' } }),
    ]);

    // Taille DB SQLite
    let db_size_mb = null;
    try {
      const dbPath = config.db.url.replace('file:', '').replace('file://', '');
      const absPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
      const stat = fs.statSync(absPath);
      db_size_mb = Math.round((stat.size / 1024 / 1024) * 100) / 100;
    } catch { /* DB file inaccessible */ }

    res.json({
      status: 'success',
      data: {
        total_sites,
        total_audits,
        total_keywords,
        total_positions,
        total_recommandations,
        audits_en_cours,
        db_size_mb,
      },
    });
  } catch (err) { next(err); }
};

// POST /api/admin/purge
const triggerPurge = async (req, res, next) => {
  try {
    const result = await purgeOldData();
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

module.exports = { healthCheck, getStats, triggerPurge };
