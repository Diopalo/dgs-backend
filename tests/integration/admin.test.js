'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb, adminToken, redacteurToken } = require('./helpers');

beforeEach(clearDb);

describe('GET /health', () => {
  test('retourne 200 avec services OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.database).toBe('ok');
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(res.body.version).toBe('1.0.0');
  });

  test('accessible sans token', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/stats', () => {
  test('403 si non-ADMIN', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${redacteurToken()}`);
    expect(res.status).toBe(403);
  });

  test('retourne les statistiques système', async () => {
    const user = await prisma.user.create({ data: { name: 'A', email: 'a@t.com', password: 'x', role: 'ADMIN' } });
    const projet = await prisma.projet.create({ data: { nom: 'P', userId: user.id } });
    const site   = await prisma.site.create({ data: { nom: 'S', url: 'https://s.com', projetId: projet.id } });
    await prisma.keyword.create({ data: { expression: 'seo', siteId: site.id } });

    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total_sites).toBe(1);
    expect(res.body.data.total_keywords).toBe(1);
    expect(typeof res.body.data.audits_en_cours).toBe('number');
  });
});

describe('POST /api/admin/purge', () => {
  test('403 si non-ADMIN', async () => {
    const res = await request(app).post('/api/admin/purge').set('Authorization', `Bearer ${redacteurToken()}`);
    expect(res.status).toBe(403);
  });

  test('purge les données anciennes', async () => {
    const user   = await prisma.user.create({ data: { name: 'A', email: 'a@t.com', password: 'x', role: 'ADMIN' } });
    const projet = await prisma.projet.create({ data: { nom: 'P', userId: user.id } });
    const site   = await prisma.site.create({ data: { nom: 'S', url: 'https://purge.com', projetId: projet.id } });

    const ancienneDate = new Date('2025-01-01');
    await prisma.auditResult.create({ data: { score: 50, statut: 'termine', siteId: site.id, crawledAt: ancienneDate } });
    const kw = await prisma.keyword.create({ data: { expression: 'old', siteId: site.id } });
    await prisma.positionnement.create({ data: { keywordId: kw.id, mesuredAt: ancienneDate } });

    const res = await request(app).post('/api/admin/purge').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.audits_deleted).toBe(1);
    expect(res.body.data.positions_deleted).toBe(1);
  });
});

describe('Erreurs 404 et format RFC 7807', () => {
  test('route inexistante → 404 avec format standard', async () => {
    const res = await request(app).get('/api/cette-route-nexiste-pas').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.code).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.path).toBeDefined();
  });
});
