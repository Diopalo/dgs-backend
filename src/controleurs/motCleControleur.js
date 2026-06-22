'use strict';

const prisma = require('../configuration/prismaClient');

const VALID_PRIORITIES = ['HAUTE', 'MOYENNE', 'BASSE'];
const PRIORITY_ORDER   = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };

// Tri en mémoire : HAUTE > MOYENNE > BASSE, puis volume_estime desc
function sortKeywords(keywords) {
  return keywords.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priorite] - PRIORITY_ORDER[b.priorite];
    if (p !== 0) return p;
    return (b.volume_estime ?? 0) - (a.volume_estime ?? 0);
  });
}

// Vérifie que le site existe ET que l'user non-ADMIN est bien le propriétaire du projet
async function resolveSiteWithOwnership(siteId, user) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { projet: true },
  });
  if (!site) return { error: 404, message: 'Site introuvable.' };
  if (user.role !== 'ADMIN' && site.projet.userId !== user.id) {
    return { error: 403, message: 'Accès refusé : ce site ne vous appartient pas.' };
  }
  return { site };
}

// GET /api/sites/:siteId/mots-cles
const listMotsCles = async (req, res) => {
  try {
    const siteId = Number(req.params.siteId);
    if (isNaN(siteId)) return res.status(400).json({ success: false, message: 'ID site invalide.' });

    const siteExists = await prisma.site.findUnique({ where: { id: siteId } });
    if (!siteExists) return res.status(404).json({ success: false, message: 'Site introuvable.' });

    const where = { siteId };
    const { priorite, categorie, search } = req.query;

    if (priorite) {
      if (!VALID_PRIORITIES.includes(priorite))
        return res.status(400).json({ success: false, message: `priorite doit être parmi : ${VALID_PRIORITIES.join(', ')}.` });
      where.priorite = priorite;
    }
    if (categorie) where.categorie = categorie;
    if (search)    where.expression = { contains: String(search) };

    const keywords = await prisma.keyword.findMany({ where });
    sortKeywords(keywords);

    return res.status(200).json({ success: true, total: keywords.length, data: keywords });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// POST /api/sites/:siteId/mots-cles
const createMotCle = async (req, res) => {
  try {
    const siteId = Number(req.params.siteId);
    if (isNaN(siteId)) return res.status(400).json({ success: false, message: 'ID site invalide.' });

    const check = await resolveSiteWithOwnership(siteId, req.user);
    if (check.error) return res.status(check.error).json({ success: false, message: check.message });

    const { expression, categorie, volume_estime, priorite = 'MOYENNE' } = req.body;

    if (!expression || typeof expression !== 'string')
      return res.status(400).json({ success: false, message: 'expression est obligatoire.' });

    const expr = expression.trim();
    if (expr.length < 2 || expr.length > 100)
      return res.status(400).json({ success: false, message: 'expression doit faire entre 2 et 100 caractères.' });

    if (!VALID_PRIORITIES.includes(priorite))
      return res.status(400).json({ success: false, message: `priorite doit être parmi : ${VALID_PRIORITIES.join(', ')}.` });

    if (volume_estime != null) {
      if (!Number.isInteger(volume_estime) || volume_estime < 0)
        return res.status(400).json({ success: false, message: 'volume_estime doit être un entier positif.' });
    }

    const keyword = await prisma.keyword.create({
      data: {
        expression:    expr,
        categorie:     categorie   ?? null,
        volume_estime: volume_estime ?? null,
        priorite,
        siteId,
      },
    });

    return res.status(201).json({ success: true, data: keyword });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PUT /api/sites/:siteId/mots-cles/:id
const updateMotCle = async (req, res) => {
  try {
    const siteId = Number(req.params.siteId);
    const id     = Number(req.params.id);
    if (isNaN(siteId) || isNaN(id))
      return res.status(400).json({ success: false, message: 'ID invalide.' });

    const keyword = await prisma.keyword.findUnique({ where: { id } });
    if (!keyword)               return res.status(404).json({ success: false, message: 'Mot-clé introuvable.' });
    if (keyword.siteId !== siteId) return res.status(404).json({ success: false, message: 'Mot-clé introuvable sur ce site.' });

    const { expression, categorie, volume_estime, priorite } = req.body;
    const data = {};

    if (expression !== undefined) {
      const expr = String(expression).trim();
      if (expr.length < 2 || expr.length > 100)
        return res.status(400).json({ success: false, message: 'expression doit faire entre 2 et 100 caractères.' });
      data.expression = expr;
    }
    if (categorie !== undefined) data.categorie = categorie;
    if (volume_estime !== undefined) {
      if (volume_estime !== null && (!Number.isInteger(volume_estime) || volume_estime < 0))
        return res.status(400).json({ success: false, message: 'volume_estime doit être un entier positif.' });
      data.volume_estime = volume_estime;
    }
    if (priorite !== undefined) {
      if (!VALID_PRIORITIES.includes(priorite))
        return res.status(400).json({ success: false, message: `priorite doit être parmi : ${VALID_PRIORITIES.join(', ')}.` });
      data.priorite = priorite;
    }

    const updated = await prisma.keyword.update({ where: { id }, data });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// DELETE /api/sites/:siteId/mots-cles/:id
const deleteMotCle = async (req, res) => {
  try {
    const siteId = Number(req.params.siteId);
    const id     = Number(req.params.id);
    if (isNaN(siteId) || isNaN(id))
      return res.status(400).json({ success: false, message: 'ID invalide.' });

    const keyword = await prisma.keyword.findUnique({ where: { id } });
    if (!keyword)               return res.status(404).json({ success: false, message: 'Mot-clé introuvable.' });
    if (keyword.siteId !== siteId) return res.status(404).json({ success: false, message: 'Mot-clé introuvable sur ce site.' });

    await prisma.keyword.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Mot-clé supprimé.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/sites/:siteId/mots-cles/stats
const statsMotsCles = async (req, res) => {
  try {
    const siteId = Number(req.params.siteId);
    if (isNaN(siteId)) return res.status(400).json({ success: false, message: 'ID site invalide.' });

    const siteExists = await prisma.site.findUnique({ where: { id: siteId } });
    if (!siteExists) return res.status(404).json({ success: false, message: 'Site introuvable.' });

    const [byPriority, byCategory, aggregate] = await Promise.all([
      prisma.keyword.groupBy({
        by:    ['priorite'],
        where: { siteId },
        _count: { id: true },
      }),
      prisma.keyword.groupBy({
        by:    ['categorie'],
        where: { siteId },
        _count: { id: true },
      }),
      prisma.keyword.aggregate({
        where: { siteId },
        _sum:  { volume_estime: true },
        _count: { id: true },
      }),
    ]);

    const par_priorite = { HAUTE: 0, MOYENNE: 0, BASSE: 0 };
    byPriority.forEach(r => { par_priorite[r.priorite] = r._count.id; });

    const par_categorie = {};
    byCategory.forEach(r => {
      if (r.categorie !== null) par_categorie[r.categorie] = r._count.id;
    });

    return res.status(200).json({
      success: true,
      data: {
        total:               aggregate._count.id,
        par_priorite,
        par_categorie,
        volume_total_estime: aggregate._sum.volume_estime ?? 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

module.exports = { listMotsCles, createMotCle, updateMotCle, deleteMotCle, statsMotsCles };
