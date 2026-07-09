'use strict';

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const swaggerJsdoc   = require('swagger-jsdoc');
const swaggerUi      = require('swagger-ui-express');

const config         = require('./config');
const { authLimiter, apiLimiter } = require('./middlewares/rateLimit');
const requestLogger  = require('./middlewares/requestLogger');
const errorHandler   = require('./middlewares/errorHandler');
const auth           = require('./middlewares/auth');
const roles          = require('./middlewares/roles');

const authRoutes      = require('./routes/authRoutes');
const siteRoutes      = require('./routes/siteRoutes');
const motCleRoutes    = require('./routes/motCleRoutes');
const recoRoutes      = require('./routes/recoRoutes');
const contenuRoutes   = require('./routes/contenuRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes     = require('./routes/adminRoutes');
const projetRoutes    = require('./routes/projetRoutes');
const { healthCheck } = require('./controleurs/adminControleur');

const app = express();

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.set('trust proxy', 1);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging HTTP ──────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Healthcheck (sans auth) ───────────────────────────────────────────────────
app.get('/health', healthCheck);

// ── Swagger ───────────────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'DGS SEO Platform API',
      version:     '1.0.0',
      description: 'API de référencement digital pour DGS Africa',
      contact:     { name: 'Direction Technique DGS' },
    },
    servers: [{ url: `http://localhost:${config.port}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Inscription: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name:     { type: 'string', minLength: 2 },
            email:    { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        Connexion: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        CreateSite: {
          type: 'object',
          required: ['nom', 'url', 'projetId'],
          properties: {
            nom:      { type: 'string' },
            url:      { type: 'string', format: 'uri' },
            projetId: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status:    { type: 'string', example: 'error' },
            code:      { type: 'string', example: 'VALIDATION_ERROR' },
            message:   { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            path:      { type: 'string' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total:      { type: 'integer' },
            page:       { type: 'integer' },
            limit:      { type: 'integer' },
            totalPages: { type: 'integer' },
            hasNext:    { type: 'boolean' },
            hasPrev:    { type: 'boolean' },
            nextCursor: { type: 'string', nullable: true },
          },
        },
      },
      responses: {
        ValidationError: {
          description: 'Données invalides',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFoundError: {
          description: 'Ressource introuvable',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        UnauthorizedError: {
          description: 'Non authentifié',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ForbiddenError: {
          description: 'Accès refusé',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ConflictError: {
          description: 'Conflit',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js', './src/controleurs/*.js'],
});

// En production, Swagger protégé par auth ADMIN
if (config.isProd) {
  app.use('/api/docs', auth, roles('ADMIN'), swaggerUi.serve, swaggerUi.setup(swaggerSpec));
} else {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

// ── Routes API ────────────────────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/sites',  siteRoutes);
app.use('/api/sites',  motCleRoutes);
app.use('/api/sites',  recoRoutes);
app.use('/api/sites',  contenuRoutes);
app.use('/api',        dashboardRoutes);
app.use('/api/admin',  adminRoutes);
app.use('/api/projets', projetRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
const { NotFoundError } = require('./utils/errors');
app.use((req, res, next) => next(new NotFoundError(`Route introuvable : ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND')));

// ── Gestionnaire d'erreurs global ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
