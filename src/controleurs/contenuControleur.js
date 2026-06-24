'use strict';

const prisma = require('../configuration/prismaClient');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');
const { parsePaginationParams, buildPaginationMeta, applyPagination, buildNextCursor } = require('../utils/pagination');

// Transitions de statut autorisées
const TRANSITIONS = {
  IDEE:      ['REDACTION'],
  REDACTION: ['PUBLIE', 'IDEE'],
  PUBLIE:    ['REDACTION'],
};

async function siteExists(siteId) {
  return prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
}

// GET /api/sites/:siteId/contenus
const listContenus = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    if (!await siteExists(siteId)) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const params = parsePaginationParams(req.query);
    const paginationQuery = applyPagination(params);

    const [total, items] = await Promise.all([
      prisma.contenuEditorial.count({ where: { siteId } }),
      prisma.contenuEditorial.findMany({
        where:   { siteId },
        orderBy: { createdAt: 'desc' },
        ...paginationQuery,
      }),
    ]);

    const meta = buildPaginationMeta(total, params);
    meta.nextCursor = buildNextCursor(items);

    res.json({ status: 'success', data: items, pagination: meta });
  } catch (err) { next(err); }
};

// POST /api/sites/:siteId/contenus
const createContenu = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    if (!await siteExists(siteId)) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const { titre, statut, date_publication, recommandationId, assigneA, notes } = req.body;

    const item = await prisma.contenuEditorial.create({
      data: {
        siteId,
        titre,
        statut:           statut || 'IDEE',
        date_publication: date_publication ? new Date(date_publication) : null,
        recommandationId: recommandationId ?? null,
        assigneA:         assigneA ?? null,
        notes:            notes ?? null,
      },
    });

    res.status(201).json({ status: 'success', data: item });
  } catch (err) { next(err); }
};

// PATCH /api/sites/:siteId/contenus/:id
const updateContenu = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const id     = Number(req.params.id);

    const existing = await prisma.contenuEditorial.findUnique({ where: { id } });
    if (!existing || existing.siteId !== siteId)
      return next(new NotFoundError('Contenu introuvable sur ce site.', 'CONTENU_NOT_FOUND'));

    const { statut, ...rest } = req.body;

    // Valider la transition de statut
    if (statut && statut !== existing.statut) {
      const allowed = TRANSITIONS[existing.statut] || [];
      if (!allowed.includes(statut)) {
        return next(new ValidationError(
          `Transition de statut interdite : ${existing.statut} → ${statut}.`,
          [{ field: 'statut', message: `Transitions autorisées depuis ${existing.statut} : ${allowed.join(', ') || 'aucune'}.` }],
          'INVALID_STATUS_TRANSITION'
        ));
      }
    }

    const data = { ...rest };
    if (statut) data.statut = statut;
    if (rest.date_publication !== undefined) {
      data.date_publication = rest.date_publication ? new Date(rest.date_publication) : null;
    }

    const updated = await prisma.contenuEditorial.update({ where: { id }, data });
    res.json({ status: 'success', data: updated });
  } catch (err) { next(err); }
};

// DELETE /api/sites/:siteId/contenus/:id
const deleteContenu = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    const id     = Number(req.params.id);

    const existing = await prisma.contenuEditorial.findUnique({ where: { id } });
    if (!existing || existing.siteId !== siteId)
      return next(new NotFoundError('Contenu introuvable sur ce site.', 'CONTENU_NOT_FOUND'));

    if (existing.statut === 'PUBLIE') {
      return next(new ForbiddenError('Impossible de supprimer un contenu publié.', 'CANNOT_DELETE_PUBLISHED'));
    }

    await prisma.contenuEditorial.delete({ where: { id } });
    res.json({ status: 'success', message: 'Contenu supprimé.' });
  } catch (err) { next(err); }
};

// GET /api/sites/:siteId/contenus/calendrier
const getCalendrier = async (req, res, next) => {
  try {
    const siteId = Number(req.params.siteId);
    if (!await siteExists(siteId)) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const contenus = await prisma.contenuEditorial.findMany({
      where:   { siteId, date_publication: { not: null } },
      orderBy: { date_publication: 'asc' },
    });

    const grouped = {};
    for (const c of contenus) {
      const key = c.date_publication.toISOString().slice(0, 7); // "2026-06"
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    }

    res.json({ status: 'success', data: grouped });
  } catch (err) { next(err); }
};

module.exports = { listContenus, createContenu, updateContenu, deleteContenu, getCalendrier };
