'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb, adminToken } = require('./helpers');

beforeEach(clearDb);

async function setup() {
  const user   = await prisma.user.create({ data: { name: 'A', email: 'a@t.com', password: 'x', role: 'ADMIN' } });
  const projet = await prisma.projet.create({ data: { nom: 'P', userId: user.id } });
  const site   = await prisma.site.create({ data: { nom: 'S', url: 'https://cont-test.com', projetId: projet.id } });
  return { site };
}

describe('POST /api/sites/:siteId/contenus', () => {
  test('crée un contenu IDEE', async () => {
    const { site } = await setup();
    const res = await request(app)
      .post(`/api/sites/${site.id}/contenus`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ titre: 'Guide SEO Sénégal', statut: 'IDEE' });
    expect(res.status).toBe(201);
    expect(res.body.data.statut).toBe('IDEE');
  });

  test('400 si titre trop court', async () => {
    const { site } = await setup();
    const res = await request(app)
      .post(`/api/sites/${site.id}/contenus`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ titre: 'AB' });
    expect(res.status).toBe(400);
  });
});

describe('Transitions de statut ContenuEditorial', () => {
  test('IDEE → REDACTION ✅', async () => {
    const { site } = await setup();
    const c = await prisma.contenuEditorial.create({ data: { titre: 'Article', siteId: site.id, statut: 'IDEE' } });
    const res = await request(app)
      .patch(`/api/sites/${site.id}/contenus/${c.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ statut: 'REDACTION' });
    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('REDACTION');
  });

  test('PUBLIE → IDEE ❌ (400)', async () => {
    const { site } = await setup();
    const c = await prisma.contenuEditorial.create({ data: { titre: 'Article', siteId: site.id, statut: 'PUBLIE' } });
    const res = await request(app)
      .patch(`/api/sites/${site.id}/contenus/${c.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ statut: 'IDEE' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('REDACTION → PUBLIE ✅', async () => {
    const { site } = await setup();
    const c = await prisma.contenuEditorial.create({ data: { titre: 'Article', siteId: site.id, statut: 'REDACTION' } });
    const res = await request(app)
      .patch(`/api/sites/${site.id}/contenus/${c.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ statut: 'PUBLIE' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/sites/:siteId/contenus/:id', () => {
  test('supprime un contenu non publié', async () => {
    const { site } = await setup();
    const c = await prisma.contenuEditorial.create({ data: { titre: 'Draft', siteId: site.id, statut: 'IDEE' } });
    const res = await request(app)
      .delete(`/api/sites/${site.id}/contenus/${c.id}`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
  });

  test('403 si contenu PUBLIE', async () => {
    const { site } = await setup();
    const c = await prisma.contenuEditorial.create({ data: { titre: 'Publié', siteId: site.id, statut: 'PUBLIE' } });
    const res = await request(app)
      .delete(`/api/sites/${site.id}/contenus/${c.id}`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/sites/:siteId/contenus/calendrier', () => {
  test('regroupe par mois', async () => {
    const { site } = await setup();
    await prisma.contenuEditorial.createMany({
      data: [
        { titre: 'Juin 1', siteId: site.id, date_publication: new Date('2026-06-15') },
        { titre: 'Juin 2', siteId: site.id, date_publication: new Date('2026-06-20') },
        { titre: 'Juil',   siteId: site.id, date_publication: new Date('2026-07-01') },
      ],
    });
    const res = await request(app)
      .get(`/api/sites/${site.id}/contenus/calendrier`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data['2026-06']).toHaveLength(2);
    expect(res.body.data['2026-07']).toHaveLength(1);
  });
});
