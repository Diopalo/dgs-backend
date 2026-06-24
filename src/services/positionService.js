'use strict';

const { URL } = require('url');
const prisma  = require('../configuration/prismaClient');
const logger  = require('../utils/logger');

// ── Utilitaire : extrait le domaine root (sans www, sans chemin) ──────────────

function extractDomain(siteUrl) {
  try {
    const { hostname } = new URL(siteUrl);
    return hostname.replace(/^www\./, '');
  } catch {
    return siteUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

// ── Mesure de position — désactivée (aucune API configurée) ──────────────────

async function measureKeyword(keyword, siteUrl) {
  logger.warn('Position Google non disponible', {
    keywordId:  keyword.id,
    expression: keyword.expression,
    reason:     'Aucune API de positionnement configurée',
  });
  return null;
}

// ── Résumé de tous les mots-clés d'un site (positions non disponibles) ───────

async function measureAllKeywords(siteId) {
  const site = await prisma.site.findUnique({
    where:  { id: siteId },
    select: { url: true, keywords: { select: { id: true, expression: true } } },
  });

  if (!site) throw new Error(`Site #${siteId} introuvable.`);

  const results = site.keywords.map(kw => ({
    keywordId:   kw.id,
    expression:  kw.expression,
    position:    null,
    url_trouvee: null,
  }));

  logger.warn('measureAllKeywords : aucune API configurée, positions non mesurées.', { siteId });

  return { measured: 0, skipped: results.length, quota_atteint: false, results };
}

module.exports = { measureKeyword, measureAllKeywords, extractDomain };
