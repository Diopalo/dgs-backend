'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb, adminToken, redacteurToken } = require('./helpers');

beforeEach(clearDb);

async function createFixtures() {
  const user = await prisma.user.create({
    data: { name: 'Admin', email: 'admin@test.com', password: 'hashed', role: 'ADMIN' },
  });
  const projet = await prisma.projet.create({ data: { nom: 'Projet Test', userId: user.id } });
  return { user, projet };
}

describe('GET /api/sites', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/sites');
    expect(res.status).toBe(401);
  });

  test('retourne la liste paginée', async () => {
    const res = await request(app).get('/api/sites').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.pagination).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/sites', () => {
  test('403 si non ADMIN', async () => {
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${redacteurToken()}`)
      .send({ nom: 'Site', url: 'https://example.com', projetId: 1 });
    expect(res.status).toBe(403);
  });

  test('400 si URL invalide', async () => {
    const { projet } = await createFixtures();
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ nom: 'Site', url: 'pas-une-url', projetId: projet.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('crée un site avec données valides', async () => {
    const { projet } = await createFixtures();
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ nom: 'Mon site', url: 'https://monsite.com', projetId: projet.id });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe('https://monsite.com');
  });

  test('409 si URL déjà utilisée', async () => {
    const { projet } = await createFixtures();
    await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ nom: 'Site1', url: 'https://dup.com', projetId: projet.id });
    const res = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ nom: 'Site2', url: 'https://dup.com', projetId: projet.id });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/sites/:id', () => {
  test('404 si site inexistant', async () => {
    const res = await request(app).get('/api/sites/99999').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SITE_NOT_FOUND');
  });

  test('retourne le site avec ses relations', async () => {
    const { projet } = await createFixtures();
    const site = await prisma.site.create({ data: { nom: 'Test', url: 'https://detail.com', projetId: projet.id } });
    const res = await request(app).get(`/api/sites/${site.id}`).set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(site.id);
  });
});

describe('DELETE /api/sites/:id', () => {
  test('supprime un site (cascade)', async () => {
    const { projet } = await createFixtures();
    const site = await prisma.site.create({ data: { nom: 'Del', url: 'https://del.com', projetId: projet.id } });
    const res = await request(app).delete(`/api/sites/${site.id}`).set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    const check = await prisma.site.findUnique({ where: { id: site.id } });
    expect(check).toBeNull();
  });
});
