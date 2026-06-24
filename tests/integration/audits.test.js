'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb, adminToken, analysteToken, redacteurToken } = require('./helpers');

beforeEach(clearDb);

async function setup() {
  const user   = await prisma.user.create({ data: { name: 'A', email: 'a@t.com', password: 'x', role: 'ADMIN' } });
  const projet = await prisma.projet.create({ data: { nom: 'P', userId: user.id } });
  const site   = await prisma.site.create({ data: { nom: 'S', url: 'https://audit-test.com', projetId: projet.id } });
  return { user, projet, site };
}

describe('POST /api/sites/:id/audits', () => {
  test('403 si REDACTEUR', async () => {
    const { site } = await setup();
    const res = await request(app)
      .post(`/api/sites/${site.id}/audits`)
      .set('Authorization', `Bearer ${redacteurToken()}`);
    expect(res.status).toBe(403);
  });

  test('404 si site inexistant', async () => {
    const res = await request(app)
      .post('/api/sites/99999/audits')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(404);
  });

  test('202 et retourne auditId (ANALYSTE)', async () => {
    const { site } = await setup();
    const res = await request(app)
      .post(`/api/sites/${site.id}/audits`)
      .set('Authorization', `Bearer ${analysteToken()}`);
    expect(res.status).toBe(202);
    expect(res.body.data.auditId).toBeDefined();
    // Vérifier que l'audit est bien en base
    const audit = await prisma.auditResult.findUnique({ where: { id: res.body.data.auditId } });
    expect(audit).not.toBeNull();
    expect(audit.statut).toBe('en_cours');
  });
});

describe('GET /api/sites/:id/audits', () => {
  test('retourne la liste paginée des audits', async () => {
    const { site } = await setup();
    await prisma.auditResult.createMany({
      data: [
        { score: 80, statut: 'termine', siteId: site.id },
        { score: 65, statut: 'termine', siteId: site.id },
      ],
    });
    const res = await request(app)
      .get(`/api/sites/${site.id}/audits`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  test('401 sans token', async () => {
    const res = await request(app).get('/api/sites/1/audits');
    expect(res.status).toBe(401);
  });
});
