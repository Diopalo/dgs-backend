'use strict';

const prisma   = require('../configuration/prismaClient');
const logger   = require('../utils/logger');
const { runAudit } = require('../services/auditRunner');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { parsePaginationParams, buildPaginationMeta, applyPagination, buildNextCursor } = require('../utils/pagination');

// GET /api/sites
const getSites = async (req, res, next) => {
  try {
    const params = parsePaginationParams(req.query);
    const pq     = applyPagination(params);

    const [total, sites] = await Promise.all([
      prisma.site.count(),
      prisma.site.findMany({
        include: { projet: { select: { id: true, nom: true } } },
        orderBy: { createdAt: 'desc' },
        ...pq,
      }),
    ]);

    const meta = buildPaginationMeta(total, params);
    meta.nextCursor = buildNextCursor(sites);

    res.json({ status: 'success', data: sites, pagination: meta });
  } catch (err) { next(err); }
};

// GET /api/sites/:id
const getSiteById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const site = await prisma.site.findUnique({
      where:   { id },
      include: { projet: true, keywords: true, auditResults: { orderBy: { crawledAt: 'desc' }, take: 5 } },
    });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));
    res.json({ status: 'success', data: site });
  } catch (err) { next(err); }
};

// POST /api/sites
const createSite = async (req, res, next) => {
  try {
    const { nom, url, projetId } = req.body;

    const projet = await prisma.projet.findUnique({ where: { id: projetId } });
    if (!projet) return next(new NotFoundError('Projet introuvable.', 'PROJET_NOT_FOUND'));

    const existing = await prisma.site.findUnique({ where: { url } });
    if (existing) return next(new ConflictError('Ce site existe déjà.', 'SITE_ALREADY_EXISTS'));

    const site = await prisma.site.create({ data: { nom, url, projetId } });
    logger.info('Site créé', { siteId: site.id, url });
    res.status(201).json({ status: 'success', data: site });
  } catch (err) { next(err); }
};

// PUT /api/sites/:id
const updateSite = async (req, res, next) => {
  try {
    const id   = Number(req.params.id);
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const { nom, url } = req.body;
    const updated = await prisma.site.update({
      where: { id },
      data:  { nom: nom ?? site.nom, url: url ?? site.url },
    });
    res.json({ status: 'success', data: updated });
  } catch (err) { next(err); }
};

// DELETE /api/sites/:id
const deleteSite = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    await prisma.site.delete({ where: { id } });
    logger.info('Site supprimé', { siteId: id });
    res.json({ status: 'success', message: 'Site supprimé.' });
  } catch (err) { next(err); }
};

// POST /api/sites/:id/audits
const launchAudit = async (req, res, next) => {
  try {
    const id   = Number(req.params.id);
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const audit = await prisma.auditResult.create({
      data: { score: 0, statut: 'en_cours', siteId: id },
    });

    runAudit(audit.id, site.url);
    logger.info('Audit lancé', { auditId: audit.id, siteId: id, url: site.url });

    res.status(202).json({ status: 'success', message: 'Audit lancé.', data: { auditId: audit.id } });
  } catch (err) { next(err); }
};

// GET /api/sites/:id/audits/:auditId
const getAuditById = async (req, res, next) => {
  try {
    const siteId  = Number(req.params.id);
    const auditId = Number(req.params.auditId);

    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const audit = await prisma.auditResult.findFirst({ where: { id: auditId, siteId } });
    if (!audit) return next(new NotFoundError('Audit introuvable.', 'AUDIT_NOT_FOUND'));

    const details   = audit.details     ? JSON.parse(audit.details)     : null;
    const deadLinks = audit.liens_morts ? JSON.parse(audit.liens_morts) : [];
    if (details) details.dead_links = deadLinks;

    res.json({ status: 'success', data: { ...audit, details } });
  } catch (err) { next(err); }
};

// GET /api/sites/:id/audits
const listAudits = async (req, res, next) => {
  try {
    const id     = Number(req.params.id);
    const site   = await prisma.site.findUnique({ where: { id }, select: { id: true } });
    if (!site) return next(new NotFoundError('Site introuvable.', 'SITE_NOT_FOUND'));

    const params = parsePaginationParams(req.query);
    const pq     = applyPagination(params);

    const [total, audits] = await Promise.all([
      prisma.auditResult.count({ where: { siteId: id } }),
      prisma.auditResult.findMany({ where: { siteId: id }, orderBy: { crawledAt: 'desc' }, ...pq }),
    ]);

    const meta = buildPaginationMeta(total, params);
    meta.nextCursor = buildNextCursor(audits);

    res.json({ status: 'success', data: audits, pagination: meta });
  } catch (err) { next(err); }
};

module.exports = { getSites, getSiteById, createSite, updateSite, deleteSite, launchAudit, listAudits, getAuditById };
