'use strict';

const prisma = require('../configuration/prismaClient');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');
const { parsePaginationParams, buildPaginationMeta, applyPagination, buildNextCursor } = require('../utils/pagination');

const VALID_PRIORITIES = ['HAUTE', 'MOYENNE', 'BASSE'];
const PRIORITY_ORDER   = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };

function sortKeywords(keywords) {
  return keywords.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priorite] - PRIORITY_ORDER[b.priorite];
    if (p !== 0) return p;
    return (b.volume_estime ?? 0) - (a.volume_estime ?? 0);
  });
}

async function resolveSiteWithOwnership(siteId, user) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { projet: true } });
  if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));
  if (user.role !== 'ADMIN' && site.projet.userId !== user.id) return { forbidden: true };
  return { site };
}

// GET /api/sites/:siteId/mots-cles
const listMotsCles = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const site   = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const where = { siteId };
    const { priorite, categorie, search } = req.query;

    if (priorite) {
      if (!VALID_PRIORITIES.includes(priorite))
        return next(new ValidationError(`priorite doit être parmi : ${VALID_PRIORITIES.join(', ')}.`, [], 'INVALID_PRIORITE'));
      where.priorite = priorite;
    }
    if (categorie) where.categorie = categorie;
    if (search)    where.expression = { contains: String(search) };

    const params = parsePaginationParams(req.query);
    const pq     = applyPagination(params);

    const [total, keywords] = await Promise.all([
      prisma.keyword.count({ where }),
      prisma.keyword.findMany({ where, ...pq }),
    ]);

    sortKeywords(keywords);
    const meta = buildPaginationMeta(total, params);
    meta.nextCursor = buildNextCursor(keywords);

    res.json({ status: 'success', data: keywords, pagination: meta });
  } catch (err) { next(err); }
};

// POST /api/sites/:siteId/mots-cles
const createMotCle = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const { expression, categorie, volume_estime, priorite = 'MOYENNE' } = req.body;

    const site = await prisma.site.findUnique({ where: { id: siteId }, include: { projet: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));
    if (req.user.role !== 'ADMIN' && site.projet.userId !== req.user.id)
      return next(new ForbiddenError('Accès refusé : ce site ne vous appartient pas.', 'FORBIDDEN'));

    const keyword = await prisma.keyword.create({
      data: { expression: expression.trim(), categorie: categorie ?? null, volume_estime: volume_estime ?? null, priorite, siteId },
    });

    res.status(201).json({ status: 'success', data: keyword });
  } catch (err) { next(err); }
};

// PUT /api/sites/:siteId/mots-cles/:id
const updateMotCle = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const id     = Number(req.params.id);

    const keyword = await prisma.keyword.findUnique({ where: { id } });
    if (!keyword || keyword.siteId !== siteId)
      return next(new NotFoundError('Mot-clé introuvable sur ce site.', 'KEYWORD_NOT_FOUND'));

    const { expression, categorie, volume_estime, priorite } = req.body;
    const data = {};
    if (expression !== undefined) data.expression = String(expression).trim();
    if (categorie  !== undefined) data.categorie   = categorie;
    if (volume_estime !== undefined) data.volume_estime = volume_estime;
    if (priorite   !== undefined) data.priorite    = priorite;

    const updated = await prisma.keyword.update({ where: { id }, data });
    res.json({ status: 'success', data: updated });
  } catch (err) { next(err); }
};

// DELETE /api/sites/:siteId/mots-cles/:id
const deleteMotCle = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const id     = Number(req.params.id);

    const keyword = await prisma.keyword.findUnique({ where: { id } });
    if (!keyword || keyword.siteId !== siteId)
      return next(new NotFoundError('Mot-clé introuvable sur ce site.', 'KEYWORD_NOT_FOUND'));

    await prisma.keyword.delete({ where: { id } });
    res.json({ status: 'success', message: 'Mot-clé supprimé.' });
  } catch (err) { next(err); }
};

// GET /api/sites/:siteId/mots-cles/stats
const statsMotsCles = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const [byPriority, byCategory, aggregate] = await Promise.all([
      prisma.keyword.groupBy({ by: ['priorite'], where: { siteId }, _count: { id: true } }),
      prisma.keyword.groupBy({ by: ['categorie'], where: { siteId }, _count: { id: true } }),
      prisma.keyword.aggregate({ where: { siteId }, _sum: { volume_estime: true }, _count: { id: true } }),
    ]);

    const par_priorite = { HAUTE: 0, MOYENNE: 0, BASSE: 0 };
    byPriority.forEach(r => { par_priorite[r.priorite] = r._count.id; });

    const par_categorie = {};
    byCategory.forEach(r => { if (r.categorie !== null) par_categorie[r.categorie] = r._count.id; });

    res.json({
      status: 'success',
      data: { total: aggregate._count.id, par_priorite, par_categorie, volume_total_estime: aggregate._sum.volume_estime ?? 0 },
    });
  } catch (err) { next(err); }
};

module.exports = { listMotsCles, createMotCle, updateMotCle, deleteMotCle, statsMotsCles };
