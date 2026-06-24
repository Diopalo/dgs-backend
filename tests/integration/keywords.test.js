'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb, adminToken, analysteToken, redacteurToken } = require('./helpers');

beforeEach(clearDb);

async function makeSite() {
  const user   = await prisma.user.create({ data: { name: 'Admin', email: 'a@t.com', password: 'x', role: 'ADMIN' } });
  const projet = await prisma.projet.create({ data: { nom: 'P', userId: user.id } });
  const site   = await prisma.site.create({ data: { nom: 'Site', url: 'https://kw-test.com', projetId: projet.id } });
  return { user, projet, site };
}

describe('POST /api/sites/:siteId/mots-cles', () => {
  test('crée un mot-clé valide', async () => {
    const { site } = await makeSite();
    const res = await request(app)
      .post(`/api/sites/${site.id}/mots-cles`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ expression: 'agence seo dakar', priorite: 'HAUTE', volume_estime: 500 });
    expect(res.status).toBe(201);
    expect(res.body.data.expression).toBe('agence seo dakar');
    expect(res.body.data.priorite).toBe('HAUTE');
  });

  test('400 si expression trop courte', async () => {
    const { site } = await makeSite();
    const res = await request(app)
      .post(`/api/sites/${site.id}/mots-cles`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ expression: 'a' });
    expect(res.status).toBe(400);
  });

  test('400 si priorite invalide', async () => {
    const { site } = await makeSite();
    const res = await request(app)
      .post(`/api/sites/${site.id}/mots-cles`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ expression: 'seo senegal', priorite: 'INCONNUE' });
    expect(res.status).toBe(400);
  });

  test('403 si REDACTEUR', async () => {
    const { site } = await makeSite();
    const res = await request(app)
      .post(`/api/sites/${site.id}/mots-cles`)
      .set('Authorization', `Bearer ${redacteurToken()}`)
      .send({ expression: 'seo dakar' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/sites/:siteId/mots-cles', () => {
  test('retourne la liste paginée', async () => {
    const { site } = await makeSite();
    await prisma.keyword.create({ data: { expression: 'seo', siteId: site.id } });
    const res = await request(app)
      .get(`/api/sites/${site.id}/mots-cles`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('PUT /api/sites/:siteId/mots-cles/:id', () => {
  test('met à jour un mot-clé', async () => {
    const { site } = await makeSite();
    const kw = await prisma.keyword.create({ data: { expression: 'avant', siteId: site.id } });
    const res = await request(app)
      .put(`/api/sites/${site.id}/mots-cles/${kw.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ expression: 'après', priorite: 'HAUTE' });
    expect(res.status).toBe(200);
    expect(res.body.data.expression).toBe('après');
  });
});

describe('GET /api/sites/:siteId/mots-cles/stats', () => {
  test('retourne les statistiques', async () => {
    const { site } = await makeSite();
    await prisma.keyword.createMany({
      data: [
        { expression: 'a', priorite: 'HAUTE', siteId: site.id },
        { expression: 'b', priorite: 'MOYENNE', siteId: site.id },
        { expression: 'c', priorite: 'HAUTE', siteId: site.id },
      ],
    });
    const res = await request(app)
      .get(`/api/sites/${site.id}/mots-cles/stats`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.par_priorite.HAUTE).toBe(2);
    expect(res.body.data.par_priorite.MOYENNE).toBe(1);
  });
});
