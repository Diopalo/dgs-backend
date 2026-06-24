'use strict';

require('./setup');
const request = require('supertest');
const app     = require('../../src/app');
const prisma  = require('../../src/configuration/prismaClient');
const { clearDb } = require('./helpers');

beforeEach(clearDb);

describe('POST /api/auth/inscription', () => {
  test('crée un utilisateur avec les données valides', async () => {
    const res = await request(app)
      .post('/api/auth/inscription')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'motdepasse123' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.email).toBe('alice@test.com');
    expect(res.body.data.password).toBeUndefined();
  });

  test('400 si email invalide', async () => {
    const res = await request(app)
      .post('/api/auth/inscription')
      .send({ name: 'Bob', email: 'pas-un-email', password: 'motdepasse123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toBeDefined();
  });

  test('400 si mot de passe trop court', async () => {
    const res = await request(app)
      .post('/api/auth/inscription')
      .send({ name: 'Bob', email: 'bob@test.com', password: 'court' });
    expect(res.status).toBe(400);
  });

  test('409 si email déjà utilisé', async () => {
    await request(app).post('/api/auth/inscription').send({ name: 'Alice', email: 'dup@test.com', password: 'motdepasse123' });
    const res = await request(app).post('/api/auth/inscription').send({ name: 'Alice2', email: 'dup@test.com', password: 'motdepasse123' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });
});

describe('POST /api/auth/connexion', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/inscription').send({ name: 'Alice', email: 'alice@test.com', password: 'motdepasse123' });
  });

  test('retourne un JWT valide', async () => {
    const res = await request(app).post('/api/auth/connexion').send({ email: 'alice@test.com', password: 'motdepasse123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.utilisateur.email).toBe('alice@test.com');
  });

  test('401 si mot de passe incorrect', async () => {
    const res = await request(app).post('/api/auth/connexion').send({ email: 'alice@test.com', password: 'mauvais' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('401 si email inconnu', async () => {
    const res = await request(app).post('/api/auth/connexion').send({ email: 'inconnu@test.com', password: 'motdepasse123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/profil', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/auth/profil');
    expect(res.status).toBe(401);
  });

  test('retourne le profil avec un token valide', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 1, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get('/api/auth/profil').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
