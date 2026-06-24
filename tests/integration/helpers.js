'use strict';

const jwt    = require('jsonwebtoken');
const prisma = require('../../src/configuration/prismaClient');

async function clearDb() {
  // Ordre important à cause des FK
  await prisma.contenuEditorial.deleteMany();
  await prisma.recommandation.deleteMany();
  await prisma.positionnement.deleteMany();
  await prisma.auditResult.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.site.deleteMany();
  await prisma.projet.deleteMany();
  await prisma.user.deleteMany();
}

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function adminToken() {
  return makeToken({ id: 9999, role: 'ADMIN' });
}

function analysteToken(id = 9998) {
  return makeToken({ id, role: 'ANALYSTE' });
}

function redacteurToken(id = 9997) {
  return makeToken({ id, role: 'REDACTEUR' });
}

module.exports = { clearDb, makeToken, adminToken, analysteToken, redacteurToken };
