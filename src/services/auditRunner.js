'use strict';

const { spawn } = require('child_process');
const path      = require('path');
const prisma    = require('../configuration/prismaClient');
const { generateRecommandations } = require('./recoService');
const config    = require('../config');
const logger    = require('../utils/logger');

const PYTHON_EXECUTABLE = config.crawler.python;
const SCRIPT_PATH       = path.join(__dirname, '..', 'crawler', 'audit.py');
const AUDIT_TIMEOUT_MS  = config.crawler.timeoutMs;
const AUDIT_MAX_PAGES   = config.crawler.maxPages;
const AUDIT_DELAY_MS    = config.crawler.delayMs;
const AUDIT_MAX_WORKERS = config.crawler.maxWorkers;

// ── Pondérations du score SEO (RG-02) ────────────────────────────────────────

const SEO_WEIGHTS = {
  // Pénalités balises (appliquées proportionnellement au ratio de pages affectées)
  PENALTY_TITLE_MISSING:      15,
  PENALTY_META_DESC_MISSING:  10,
  PENALTY_H1_ISSUE:           10,

  // Pénalités vitesse (seuils en ms, non cumulables)
  SPEED_SLOW_THRESHOLD_MS:      1_000,
  SPEED_VERY_SLOW_THRESHOLD_MS: 3_000,
  PENALTY_SPEED_SLOW:           10,
  PENALTY_SPEED_VERY_SLOW:      20,

  // Pénalités liens morts (par lien, avec plafond)
  PENALTY_DEAD_LINK:            5,
  PENALTY_DEAD_LINK_CAP:        30,

  // Pénalités taille du site (trop peu de pages indexées)
  SIZE_VERY_SMALL_THRESHOLD:    5,
  SIZE_SMALL_THRESHOLD:         10,
  PENALTY_SIZE_VERY_SMALL:      10,
  PENALTY_SIZE_SMALL:           5,

  // Bonus taille (site bien fourni en contenu)
  SIZE_LARGE_THRESHOLD:         50,
  SIZE_VERY_LARGE_THRESHOLD:    100,
  BONUS_SIZE_LARGE:             2,
  BONUS_SIZE_VERY_LARGE:        3,

  // Bonus qualité (optionnels)
  BONUS_ALL_CANONICAL:          3,
  BONUS_NO_NOINDEX:             2,
};

// ── Logger avec timestamp ─────────────────────────────────────────────────────

function log(auditId, message, data = {}) {
  logger.info(`[Audit #${auditId}] ${message}`, { auditId, ...data });
}

// ── Algorithme de score SEO — isolé et testable (RG-02) ──────────────────────

/**
 * calculateSeoScore
 * Calcule le score SEO sur 100 points à partir du résultat brut du crawler.
 *
 * @param {object} crawlResult - Sortie JSON d'audit.py
 * @returns {{ score: number, breakdown: object }}
 *   - score    : entier entre 0 et 100
 *   - breakdown: détail de chaque pénalité/bonus (pour affichage UI)
 */
function calculateSeoScore(crawlResult) {
  const { pages, dead_links } = crawlResult;
  const total = pages.length;

  if (total === 0) {
    return { score: 0, breakdown: { error: 'Aucune page analysée' } };
  }

  let score = 100;
  const breakdown = {};

  // ── Pénalités balises (proportionnelles) ─────────────────────────────────
  const withTitleIssue = pages.filter(p => p.issues?.title).length;
  const withMetaIssue  = pages.filter(p => p.issues?.meta_description).length;
  const withH1Issue    = pages.filter(p => p.issues?.h1).length;

  const penaltyTitle = SEO_WEIGHTS.PENALTY_TITLE_MISSING     * (withTitleIssue / total);
  const penaltyMeta  = SEO_WEIGHTS.PENALTY_META_DESC_MISSING * (withMetaIssue  / total);
  const penaltyH1    = SEO_WEIGHTS.PENALTY_H1_ISSUE          * (withH1Issue    / total);

  score -= penaltyTitle + penaltyMeta + penaltyH1;

  breakdown.title = {
    pages_affected: withTitleIssue,
    ratio:          `${withTitleIssue}/${total}`,
    penalty:        -Math.round(penaltyTitle),
  };
  breakdown.meta_description = {
    pages_affected: withMetaIssue,
    ratio:          `${withMetaIssue}/${total}`,
    penalty:        -Math.round(penaltyMeta),
  };
  breakdown.h1 = {
    pages_affected: withH1Issue,
    ratio:          `${withH1Issue}/${total}`,
    penalty:        -Math.round(penaltyH1),
  };

  // ── Pénalité vitesse (sur la moyenne, seuils non cumulables) ─────────────
  const validPages = pages.filter(p => p.elapsed_ms != null && !p.error);
  const avgSpeedMs = validPages.length > 0
    ? validPages.reduce((sum, p) => sum + p.elapsed_ms, 0) / validPages.length
    : 0;

  let penaltySpeed = 0;
  if (avgSpeedMs > SEO_WEIGHTS.SPEED_VERY_SLOW_THRESHOLD_MS) {
    penaltySpeed = SEO_WEIGHTS.PENALTY_SPEED_VERY_SLOW;
  } else if (avgSpeedMs > SEO_WEIGHTS.SPEED_SLOW_THRESHOLD_MS) {
    penaltySpeed = SEO_WEIGHTS.PENALTY_SPEED_SLOW;
  }
  score -= penaltySpeed;
  breakdown.speed = {
    avg_ms:    Math.round(avgSpeedMs),
    threshold: avgSpeedMs > SEO_WEIGHTS.SPEED_VERY_SLOW_THRESHOLD_MS ? '>3000ms' :
               avgSpeedMs > SEO_WEIGHTS.SPEED_SLOW_THRESHOLD_MS      ? '>1000ms' : 'ok',
    penalty:   -penaltySpeed,
  };

  // ── Pénalité liens morts (avec plafond) ──────────────────────────────────
  const deadCount    = dead_links.length;
  const penaltyDead  = Math.min(
    deadCount * SEO_WEIGHTS.PENALTY_DEAD_LINK,
    SEO_WEIGHTS.PENALTY_DEAD_LINK_CAP
  );
  score -= penaltyDead;
  breakdown.dead_links = {
    count:   deadCount,
    capped:  deadCount * SEO_WEIGHTS.PENALTY_DEAD_LINK > SEO_WEIGHTS.PENALTY_DEAD_LINK_CAP,
    penalty: -penaltyDead,
  };

  // ── Pénalité / bonus taille du site ──────────────────────────────────────
  let sizePenalty = 0;
  let sizeBonus   = 0;

  if (total < SEO_WEIGHTS.SIZE_VERY_SMALL_THRESHOLD) {
    sizePenalty = SEO_WEIGHTS.PENALTY_SIZE_VERY_SMALL;
  } else if (total < SEO_WEIGHTS.SIZE_SMALL_THRESHOLD) {
    sizePenalty = SEO_WEIGHTS.PENALTY_SIZE_SMALL;
  }

  if (total >= SEO_WEIGHTS.SIZE_VERY_LARGE_THRESHOLD) {
    sizeBonus = SEO_WEIGHTS.BONUS_SIZE_VERY_LARGE;
  } else if (total >= SEO_WEIGHTS.SIZE_LARGE_THRESHOLD) {
    sizeBonus = SEO_WEIGHTS.BONUS_SIZE_LARGE;
  }

  score -= sizePenalty;
  score += sizeBonus;
  breakdown.site_size = {
    total_pages: total,
    penalty:     -sizePenalty,
    bonus:       sizeBonus,
  };

  // ── Bonus qualité ─────────────────────────────────────────────────────────
  const allHaveCanonical = pages.every(p => p.canonical);
  const noNoindex        = pages.every(p => !p.noindex);
  let bonus = 0;

  if (allHaveCanonical) {
    bonus += SEO_WEIGHTS.BONUS_ALL_CANONICAL;
    breakdown.bonus_canonical = +SEO_WEIGHTS.BONUS_ALL_CANONICAL;
  }
  if (noNoindex) {
    bonus += SEO_WEIGHTS.BONUS_NO_NOINDEX;
    breakdown.bonus_noindex = +SEO_WEIGHTS.BONUS_NO_NOINDEX;
  }
  score += bonus;

  // ── Plancher 0 / plafond 100 ─────────────────────────────────────────────
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    breakdown,
  };
}

// ── Score domaine (SSL, expiry, TTFB, HTTPS) ─────────────────────────────────

function calculateDomainScore(crawlResult) {
  let score = 100;
  const breakdown = {};

  // SSL
  if (!crawlResult.ssl?.valid) {
    score -= 30;
    breakdown.ssl = { penalty: -30, reason: 'SSL invalide ou absent' };
  } else if (crawlResult.ssl?.expires_in_days < 30) {
    score -= 15;
    breakdown.ssl = { penalty: -15, reason: 'SSL expire bientôt' };
  } else {
    breakdown.ssl = { penalty: 0, reason: 'SSL valide' };
  }

  // Expiration du domaine
  if (crawlResult.domain?.expires_in_days != null && crawlResult.domain.expires_in_days < 30) {
    score -= 20;
    breakdown.domain_expiry = { penalty: -20, reason: 'Domaine expire dans moins de 30 jours' };
  } else {
    breakdown.domain_expiry = { penalty: 0 };
  }

  // TTFB
  const ttfb = crawlResult.server?.ttfb_ms;
  if (ttfb > 600) {
    score -= 20;
    breakdown.ttfb = { penalty: -20, reason: `TTFB ${ttfb}ms > 600ms` };
  } else if (ttfb > 300) {
    score -= 10;
    breakdown.ttfb = { penalty: -10, reason: `TTFB ${ttfb}ms > 300ms` };
  } else {
    breakdown.ttfb = { penalty: 0, reason: `TTFB ${ttfb}ms optimal` };
  }

  // HTTPS
  if (!crawlResult.server?.https) {
    score -= 30;
    breakdown.https = { penalty: -30, reason: 'Site non sécurisé (HTTP)' };
  } else {
    breakdown.https = { penalty: 0, reason: 'HTTPS actif' };
  }

  return { score: Math.max(0, score), breakdown };
}

// ── Appel au crawler Python ───────────────────────────────────────────────────

/**
 * runPythonAudit
 * Lance audit.py en sous-processus et parse sa sortie JSON.
 * Un timeout global (AUDIT_TIMEOUT_MS) tue le processus si dépassé.
 */
function runPythonAudit(siteUrl) {
  return new Promise((resolve, reject) => {
    const args = [
      SCRIPT_PATH,
      siteUrl,
      '--max-pages',   String(AUDIT_MAX_PAGES),
      '--delay-ms',    String(AUDIT_DELAY_MS),
      '--max-workers', String(AUDIT_MAX_WORKERS),
    ];

    const proc   = spawn(PYTHON_EXECUTABLE, args);
    let stdout   = '';
    let stderr   = '';

    // Timeout global : tue le processus si le crawl prend trop longtemps
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(
        `Timeout dépassé (${AUDIT_TIMEOUT_MS / 60_000} min) — processus tué.`
      ));
    }, AUDIT_TIMEOUT_MS);

    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

    proc.on('close', () => {
      clearTimeout(timer);
      if (!stdout.trim()) {
        return reject(new Error(
          stderr.trim() || 'Aucune sortie reçue du crawler Python.'
        ));
      }
      try {
        const parsed = JSON.parse(stdout);
        // audit.py expose { error } en cas d'exception interne
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch {
        reject(new Error(`JSON invalide reçu du crawler : ${stdout.slice(0, 300)}`));
      }
    });

    proc.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// ── Logique principale (RG-05 : retry automatique une fois) ──────────────────

/**
 * runAudit
 * Orchestre le crawl, le calcul du score et la mise à jour en base.
 * Doit être appelé SANS await (fire-and-forget) depuis le contrôleur.
 *
 * Cycle de vie de l'AuditResult :
 *   en_cours → termine  (succès)
 *   en_cours → echec    (2 tentatives épuisées)
 */
async function runAudit(auditId, siteUrl) {
  log(auditId, `Démarrage du crawl → ${siteUrl}`);
  log(auditId, `Config : max_pages=${AUDIT_MAX_PAGES}, delay=${AUDIT_DELAY_MS}ms, workers=${AUDIT_MAX_WORKERS}`);

  // ── Tentative 1 + relance automatique (RG-05) ────────────────────────────
  let crawlResult = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      log(auditId, `Tentative ${attempt}/2 — crawl en cours…`);
      crawlResult = await runPythonAudit(siteUrl);
      const { total_pages, pages_with_errors } = crawlResult.crawl_stats;
      log(auditId, `Crawl OK (tentative ${attempt}) : ${total_pages} pages, ${pages_with_errors} erreur(s), ${crawlResult.crawl_stats.crawl_duration_ms} ms`);

      // Erreurs de CONNEXION uniquement (status null = timeout/DNS) — les HTTP 4xx sont valides
      const connectionErrors = crawlResult.pages.filter(p => p.status_code === null || p.status_code === undefined).length;
      if (total_pages === 0 || connectionErrors === total_pages) {
        throw new Error(`Crawl infructueux : ${connectionErrors}/${total_pages} page(s) inaccessible(s) (erreur réseau).`);
      }
      break; // succès → on sort de la boucle
    } catch (err) {
      log(auditId, `Tentative ${attempt}/2 échouée : ${err.message}`);
      if (attempt === 2) {
        // Échec définitif après 2 tentatives
        log(auditId, 'Audit marqué en échec définitif.');
        await prisma.auditResult.update({
          where: { id: auditId },
          data: {
            statut:    'echec',
            details:   JSON.stringify({ erreur: err.message }),
            crawledAt: new Date(),
          },
        }).catch(dbErr => log(auditId, `Erreur DB (echec) : ${dbErr.message}`));
        return;
      }
    }
  }

  // ── Calcul des scores ─────────────────────────────────────────────────────
  const { score: scoreTechnique, breakdown }         = calculateSeoScore(crawlResult);
  const { score: scoreDomaine,   breakdown: domainBreakdown } = calculateDomainScore(crawlResult);
  const scoreGlobal = Math.round(scoreTechnique * 0.6 + scoreDomaine * 0.4);

  log(auditId, `Scores — global: ${scoreGlobal}, technique: ${scoreTechnique}, domaine: ${scoreDomaine}`);

  // Vitesse moyenne (pages sans erreur de fetch uniquement)
  const validPages = crawlResult.pages.filter(p => p.elapsed_ms != null && !p.error);
  const vitesseMoy = validPages.length > 0
    ? Math.round(validPages.reduce((s, p) => s + p.elapsed_ms, 0) / validPages.length)
    : 0;

  const balisesManquantes = {
    title:            crawlResult.pages.filter(p => p.issues?.title).length,
    meta_description: crawlResult.pages.filter(p => p.issues?.meta_description).length,
    h1:               crawlResult.pages.filter(p => p.issues?.h1).length,
  };

  // ── Mise à jour en base ───────────────────────────────────────────────────
  await prisma.auditResult.update({
    where: { id: auditId },
    data: {
      score:              scoreGlobal,
      statut:             'termine',
      vitesse_ms:         vitesseMoy,
      balises_manquantes: JSON.stringify(balisesManquantes),
      liens_morts:        JSON.stringify(crawlResult.dead_links),
      details: JSON.stringify({
        scores: {
          global:    scoreGlobal,
          technique: scoreTechnique,
          domaine:   scoreDomaine,
        },
        breakdown,
        domain_breakdown: domainBreakdown,
        domain:      crawlResult.domain,
        ssl:         crawlResult.ssl,
        dns:         crawlResult.dns,
        server:      crawlResult.server,
        crawl_stats: crawlResult.crawl_stats,
        pages:       crawlResult.pages,
      }),
      crawledAt: new Date(),
    },
  }).catch(dbErr => log(auditId, `Erreur DB (termine) : ${dbErr.message}`));

  log(auditId, 'Audit terminé avec succès.');

  // Génération automatique des recommandations (RG-04)
  try {
    const { siteId } = await prisma.auditResult.findUnique({
      where:  { id: auditId },
      select: { siteId: true },
    });
    const result = await generateRecommandations(siteId);
    log(auditId, `Recommandations : ${result.created} créée(s), ${result.skipped} dédupliquée(s).`);
  } catch (recoErr) {
    log(auditId, `Erreur génération recos : ${recoErr.message}`);
  }
}

module.exports = { runAudit, calculateSeoScore, calculateDomainScore };
