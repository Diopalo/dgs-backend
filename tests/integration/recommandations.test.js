'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb, adminToken, redacteurToken } = require('./helpers');

beforeEach(clearDb);

async function setup() {
  const user   = await prisma.user.create({ data: { name: 'A', email: 'a@t.com', password: 'x', role: 'ADMIN' } });
  const projet = await prisma.projet.create({ data: { nom: 'P', userId: user.id } });
  const site   = await prisma.site.create({ data: { nom: 'S', url: 'https://reco-test.com', projetId: projet.id } });
  const reco   = await prisma.recommandation.create({
    data: { siteId: site.id, type: 'TECHNIQUE', priorite: 'HAUTE', message: 'Fix H1 tags.', statut: 'OUVERTE' },
  });
  return { site, reco };
}

describe('GET /api/sites/:siteId/recommandations', () => {
  test('retourne la liste paginée', async () => {
    const { site } = await setup();
    const res = await request(app).get(`/api/sites/${site.id}/recommandations`).set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toBeDefined();
  });

  test('filtre par statut', async () => {
    const { site } = await setup();
    const res = await request(app)
      .get(`/api/sites/${site.id}/recommandations?statut=RESOLUE`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('PATCH /api/sites/:siteId/recommandations/:id', () => {
  test('met à jour le statut', async () => {
    const { site, reco } = await setup();
    const res = await request(app)
      .patch(`/api/sites/${site.id}/recommandations/${reco.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ statut: 'EN_COURS' });
    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('EN_COURS');
  });

  test('400 si statut invalide', async () => {
    const { site, reco } = await setup();
    const res = await request(app)
      .patch(`/api/sites/${site.id}/recommandations/${reco.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ statut: 'INVALIDE' });
    expect(res.status).toBe(400);
  });

  test('403 si REDACTEUR', async () => {
    const { site, reco } = await setup();
    const res = await request(app)
      .patch(`/api/sites/${site.id}/recommandations/${reco.id}`)
      .set('Authorization', `Bearer ${redacteurToken()}`)
      .send({ statut: 'RESOLUE' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/sites/:siteId/recommandations/resume', () => {
  test('retourne le résumé agrégé', async () => {
    const { site } = await setup();
    const res = await request(app).get(`/api/sites/${site.id}/recommandations/resume`).set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.par_priorite.HAUTE).toBe(1);
    expect(res.body.data.par_statut.OUVERTE).toBe(1);
  });
});
