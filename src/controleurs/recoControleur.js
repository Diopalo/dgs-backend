'use strict';

const prisma  = require('../configuration/prismaClient');
const { generateRecommandations } = require('../services/recoService');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { parsePaginationParams, buildPaginationMeta, applyPagination, buildNextCursor } = require('../utils/pagination');

const VALID_TYPES   = ['TECHNIQUE', 'CONTENU', 'MOTS_CLES'];
const VALID_STATUTS = ['OUVERTE', 'EN_COURS', 'RESOLUE'];
const VALID_PRIO    = ['HAUTE', 'MOYENNE', 'BASSE'];
const PRIORITE_RANK = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };

function sortRecos(recos) {
  return recos.sort((a, b) => {
    const p = PRIORITE_RANK[a.priorite] - PRIORITE_RANK[b.priorite];
    if (p !== 0) return p;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

// GET /api/sites/:siteId/recommandations
const listRecommandations = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const where = { siteId };
    const { type, statut, priorite } = req.query;
    if (type) {
      if (!VALID_TYPES.includes(type)) return next(new ValidationError(`type doit être parmi : ${VALID_TYPES.join(', ')}.`, [], 'INVALID_TYPE'));
      where.type = type;
    }
    if (statut) {
      if (!VALID_STATUTS.includes(statut)) return next(new ValidationError(`statut doit être parmi : ${VALID_STATUTS.join(', ')}.`, [], 'INVALID_STATUT'));
      where.statut = statut;
    }
    if (priorite) {
      if (!VALID_PRIO.includes(priorite)) return next(new ValidationError(`priorite doit être parmi : ${VALID_PRIO.join(', ')}.`, [], 'INVALID_PRIORITE'));
      where.priorite = priorite;
    }

    const params = parsePaginationParams(req.query);
    const pq     = applyPagination(params);

    const [total, recos] = await Promise.all([
      prisma.recommandation.count({ where }),
      prisma.recommandation.findMany({ where, orderBy: { createdAt: 'desc' }, ...pq }),
    ]);

    sortRecos(recos);
    const meta = buildPaginationMeta(total, params);
    meta.nextCursor = buildNextCursor(recos);

    res.json({ status: 'success', data: recos, pagination: meta });
  } catch (err) { next(err); }
};

// PATCH /api/sites/:siteId/recommandations/:id
const updateStatutRecommandation = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const id     = Number(req.params.id);
    const { statut } = req.body;

    const reco = await prisma.recommandation.findUnique({ where: { id } });
    if (!reco || reco.siteId !== siteId)
      return next(new NotFoundError('Recommandation introuvable sur ce site.', 'RECO_NOT_FOUND'));

    const updated = await prisma.recommandation.update({ where: { id }, data: { statut } });
    res.json({ status: 'success', data: updated });
  } catch (err) { next(err); }
};

// POST /api/sites/:siteId/recommandations/generer
const genererRecommandations = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const result = await generateRecommandations(siteId);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

// GET /api/sites/:siteId/recommandations/resume
const resumeRecommandations = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const [byType, byPriorite, byStatut, total] = await Promise.all([
      prisma.recommandation.groupBy({ by: ['type'],     where: { siteId }, _count: { id: true } }),
      prisma.recommandation.groupBy({ by: ['priorite'], where: { siteId }, _count: { id: true } }),
      prisma.recommandation.groupBy({ by: ['statut'],   where: { siteId }, _count: { id: true } }),
      prisma.recommandation.count({ where: { siteId } }),
    ]);

    const par_type     = { TECHNIQUE: 0, CONTENU: 0, MOTS_CLES: 0 };
    const par_priorite = { HAUTE: 0, MOYENNE: 0, BASSE: 0 };
    const par_statut   = { OUVERTE: 0, EN_COURS: 0, RESOLUE: 0 };

    byType.forEach(r     => { par_type[r.type]         = r._count.id; });
    byPriorite.forEach(r => { par_priorite[r.priorite] = r._count.id; });
    byStatut.forEach(r   => { par_statut[r.statut]     = r._count.id; });

    res.json({ status: 'success', data: { total, par_type, par_priorite, par_statut } });
  } catch (err) { next(err); }
};

module.exports = { listRecommandations, updateStatutRecommandation, genererRecommandations, resumeRecommandations };
