'use strict';

const prisma = require('../configuration/prismaClient');

// ── Règles AUDIT (type TECHNIQUE) ────────────────────────────────────────────

function reglesAudit(audit) {
  const recos = [];
  if (!audit?.details) return recos;

  let breakdown;
  try {
    ({ breakdown } = JSON.parse(audit.details));
  } catch {
    return recos;
  }

  // R01 — Balises title manquantes
  if (breakdown.title?.pages_affected > 0) {
    const [affected] = breakdown.title.ratio.split('/').map(Number);
    recos.push({
      auditId: audit.id,
      type: 'TECHNIQUE',
      priorite: 'HAUTE',
      message: `${affected} page(s) sans balise <title> détectée(s). Ajouter un title unique et descriptif sur chaque page (50-60 caractères recommandés).`,
    });
  }

  // R02 — Meta descriptions manquantes
  if (breakdown.meta_description?.pages_affected > 0) {
    const affected = breakdown.meta_description.pages_affected;
    const [withIssue, total] = breakdown.meta_description.ratio.split('/').map(Number);
    const ratio = total > 0 ? withIssue / total : 0;
    recos.push({
      auditId: audit.id,
      type: 'TECHNIQUE',
      priorite: ratio > 0.5 ? 'HAUTE' : 'MOYENNE',
      message: `${affected} page(s) sans meta description. Rédiger une meta description entre 120 et 160 caractères pour chaque page concernée.`,
    });
  }

  // R03 — H1 absent ou dupliqué
  if (breakdown.h1?.pages_affected > 0) {
    recos.push({
      auditId: audit.id,
      type: 'TECHNIQUE',
      priorite: 'MOYENNE',
      message: `${breakdown.h1.pages_affected} page(s) avec un problème de balise H1 (absente ou dupliquée). Chaque page doit avoir exactement un H1 contenant le mot-clé principal.`,
    });
  }

  // R04 — Vitesse dégradée
  if (breakdown.speed) {
    const { avg_ms, penalty } = breakdown.speed;
    if (penalty < 0 && avg_ms > 3000) {
      recos.push({
        auditId: audit.id,
        type: 'TECHNIQUE',
        priorite: 'HAUTE',
        message: `Temps de chargement moyen critique : ${avg_ms}ms (seuil : 3000ms). Optimiser les images, activer le cache navigateur et utiliser un CDN.`,
      });
    } else if (avg_ms >= 1000 && avg_ms <= 3000) {
      recos.push({
        auditId: audit.id,
        type: 'TECHNIQUE',
        priorite: 'MOYENNE',
        message: `Temps de chargement moyen élevé : ${avg_ms}ms. Compresser les ressources CSS/JS et optimiser les images (WebP, lazy loading).`,
      });
    }
  }

  // R05 — Liens morts
  if (breakdown.dead_links?.count > 0) {
    const count = breakdown.dead_links.count;
    recos.push({
      auditId: audit.id,
      type: 'TECHNIQUE',
      priorite: count >= 5 ? 'HAUTE' : 'MOYENNE',
      message: `${count} lien(s) mort(s) détecté(s) (HTTP 4xx/5xx). Corriger ou supprimer ces liens pour éviter une pénalité de crawl Google.`,
    });
  }

  return recos;
}

// ── Règles POSITIONNEMENT (type CONTENU / MOTS_CLES) ─────────────────────────

function reglesMots(keywords) {
  const recos = [];

  for (const kw of keywords) {
    const latestPos = kw.positionnements[0] ?? null;
    const position  = latestPos?.position ?? null;

    // R06 — Fort volume sans position mesurée
    if ((kw.volume_estime ?? 0) >= 500 && position === null) {
      recos.push({
        keywordId: kw.id,
        type: 'CONTENU',
        priorite: 'HAUTE',
        message: `Le mot-clé '${kw.expression}' (volume estimé ${kw.volume_estime}/mois) n'a pas encore de position mesurée. Créer une page dédiée ciblant ce terme.`,
      });
    }

    // R07 désactivée — nécessite une position réelle (aucune API configurée)

    // R08 — Mot-clé HAUTE priorité sans position mesurée
    if (kw.priorite === 'HAUTE' && position === null) {
      recos.push({
        keywordId: kw.id,
        type: 'MOTS_CLES',
        priorite: 'HAUTE',
        message: `Le mot-clé haute priorité '${kw.expression}' n'est pas encore positionné. Lancer une stratégie de contenu ciblée.`,
      });
    }
  }

  return recos;
}

// ── Moteur principal ──────────────────────────────────────────────────────────

async function generateRecommandations(siteId) {
  // 1. Dernier audit terminé
  const audit = await prisma.auditResult.findFirst({
    where:   { siteId, statut: 'termine' },
    orderBy: { crawledAt: 'desc' },
  });

  // 2-3. Règles audit (R01-R05)
  const recosBrutes = reglesAudit(audit).map(r => ({ siteId, ...r }));

  // 4. Keywords avec dernière position
  const keywords = await prisma.keyword.findMany({
    where:   { siteId },
    include: {
      positionnements: {
        orderBy: { mesuredAt: 'desc' },
        take: 1,
      },
    },
  });

  // 5. Règles positionnement (R06-R08)
  reglesMots(keywords).forEach(r => recosBrutes.push({ siteId, ...r }));

  // 6. Déduplication : exclure les messages déjà OUVERTS ou EN_COURS
  const existantes = await prisma.recommandation.findMany({
    where:  { siteId, statut: { in: ['OUVERTE', 'EN_COURS'] } },
    select: { message: true },
  });
  const messagesExistants = new Set(existantes.map(r => r.message));

  const aCreer  = recosBrutes.filter(r => !messagesExistants.has(r.message));
  const skipped = recosBrutes.length - aCreer.length;

  // 7. Insertion en base
  if (aCreer.length > 0) {
    await prisma.recommandation.createMany({ data: aCreer });
  }

  // 8. Retourner les nouvelles recos
  const recommandations = aCreer.length > 0
    ? await prisma.recommandation.findMany({
        where:   { siteId },
        orderBy: { createdAt: 'desc' },
        take:    aCreer.length,
      })
    : [];

  return { created: aCreer.length, skipped, recommandations };
}

module.exports = { generateRecommandations };
