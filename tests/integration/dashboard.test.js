'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb, adminToken, redacteurToken } = require('./helpers');

beforeEach(clearDb);

async function createSiteWithData() {
  const user   = await prisma.user.create({ data: { name: 'Admin', email: 'a@t.com', password: 'x', role: 'ADMIN' } });
  const projet = await prisma.projet.create({ data: { nom: 'P', userId: user.id } });
  const site   = await prisma.site.create({ data: { nom: 'Site', url: 'https://test.com', projetId: projet.id } });

  await prisma.auditResult.create({ data: { score: 75, statut: 'termine', siteId: site.id } });
  await prisma.keyword.create({ data: { expression: 'seo', priorite: 'HAUTE', siteId: site.id } });
  await prisma.recommandation.create({
    data: { siteId: site.id, type: 'TECHNIQUE', priorite: 'HAUTE', message: 'Fix title tags.', statut: 'OUVERTE' },
  });

  return { user, projet, site };
}

describe('GET /api/sites/:siteId/dashboard', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/sites/1/dashboard');
    expect(res.status).toBe(401);
  });

  test('404 si site inexistant', async () => {
    const res = await request(app).get('/api/sites/99999/dashboard').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(404);
  });

  test('retourne le dashboard complet avec sante_globale', async () => {
    const { site } = await createSiteWithData();
    const res = await request(app).get(`/api/sites/${site.id}/dashboard`).set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.site.id).toBe(site.id);
    expect(res.body.data.sante_globale).toBeDefined();
    expect(res.body.data.sante_globale.score).toBeGreaterThanOrEqual(0);
    expect(['bon', 'moyen', 'critique']).toContain(res.body.data.sante_globale.niveau);
    expect(res.body.data.audit.dernier_score).toBe(75);
    expect(res.body.data.mots_cles.total).toBe(1);
    expect(res.body.data.recommandations.total_ouvertes).toBe(1);
  });

  test('calcule la santé globale correctement', async () => {
    const { site } = await createSiteWithData();
    const res = await request(app).get(`/api/sites/${site.id}/dashboard`).set('Authorization', `Bearer ${adminToken()}`);
    const { detail } = res.body.data.sante_globale;
    expect(detail.score_audit).toBe(75);
    // score_recos = max(0, 100 - 1*10) = 90
    expect(detail.score_recos).toBe(90);
  });
});

describe('GET /api/dashboard/global', () => {
  test('403 pour non-ADMIN', async () => {
    const res = await request(app).get('/api/dashboard/global').set('Authorization', `Bearer ${redacteurToken()}`);
    expect(res.status).toBe(403);
  });

  test('retourne tous les sites triés par santé', async () => {
    await createSiteWithData();
    const res = await request(app).get('/api/dashboard/global').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('sante_globale');
  });
});
