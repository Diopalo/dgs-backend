# DGS SEO Platform — Rapport technique

**Auteur :** Papa Ousmane Mane  
**Branche :** `pom`  
**Date :** 24 juin 2026

---

## Ce qui a été corrigé

### Escalade de privilèges à l'inscription

Le champ `role` était lu directement depuis `req.body` et passé à Prisma. N'importe qui pouvait s'inscrire en tant qu'ADMIN en ajoutant `"role": "ADMIN"` dans le body. La correction est simple : ne jamais lire `role` depuis la requête. Le schéma Prisma attribue `REDACTEUR` par défaut, ce qui suffit.

```js
// avant
const { name, email, password, role } = req.body;
await prisma.user.create({ data: { name, email, password: hash, role } });

// après
const { name, email, password } = req.body;
await prisma.user.create({ data: { name, email, password: hash } });
```

---

### Audit bloquant — le client recevait un timeout

`launchAudit` faisait un `await runAudit(...)`, ce qui bloquait la connexion HTTP pendant toute la durée du crawl (parfois 10 minutes). Le client tombait en timeout avant de recevoir une réponse.

La solution est de lancer l'audit en fire-and-forget et de répondre immédiatement avec l'`auditId`. Le client peut ensuite poller `GET /api/sites/:id/audits/:auditId` pour suivre l'avancement.

```js
// avant
await runAudit(audit.id, site.url);
res.status(200).json({ ... });

// après
runAudit(audit.id, site.url);  // sans await
res.status(202).json({ auditId: audit.id });
```

---

### Deux bases SQLite en parallèle

Avec `DATABASE_URL="file:./dev.db"`, Prisma CLI et Node.js ne résolvaient pas le chemin au même endroit. Prisma migrate créait `prisma/dev.db`, le serveur ouvrait `./dev.db` à la racine. Les migrations ne s'appliquaient jamais sur la base réellement utilisée.

Correction : chemin absolu dans `.env`.

```
DATABASE_URL="file:/home/ousmane/www/dgs-backend/prisma/dev.db"
```

---

### Historique des audits trié sur un champ inexistant

`listAudits` faisait `orderBy: { createdAt: "desc" }` mais `AuditResult` n'a pas de champ `createdAt`, seulement `crawledAt`. Prisma levait une erreur silencieuse. Corrigé en `orderBy: { crawledAt: "desc" }`.

---

### Crawler Python — trois bugs d'environnement

**Resolver DNS.** Le resolver DNS asynchrone natif d'aiohttp se faisait annuler dans certains environnements, rendant tous les sites injoignables. Remplacé par `aiohttp.ThreadedResolver()` qui délègue à `socket.getaddrinfo` via un thread pool — plus lent mais fiable.

**Encodage Brotli.** Certains sites répondaient `Content-Encoding: br`. La version d'aiohttp installée ne supporte pas Brotli et levait une exception à la lecture du body. Ajout de `Accept-Encoding: gzip, deflate` dans les headers pour ne jamais négocier Brotli.

**robots.txt 404.** `RobotFileParser.can_fetch()` retourne `False` si `read()` n'a jamais été appelé. Quand robots.txt renvoyait 404, on ne faisait rien, et toutes les URLs se retrouvaient bloquées. La correction applique `rp.allow_all = True` dès que le statut n'est pas 200, ce qui correspond au comportement standard décrit dans la RFC.

---

### dead_links toujours vide dans la réponse API

Les liens morts sont persistés dans deux colonnes séparées : `liens_morts` (le tableau JSON brut) et `details` (le blob complet incluant uniquement le compteur dans `breakdown.dead_links.count`). Dans `getAuditById`, seul `details` était parsé et renvoyé — `liens_morts` n'était jamais injecté dedans. Le front recevait `details.dead_links = undefined` même quand 32 liens morts existaient en base.

```js
// avant
const details = audit.details ? JSON.parse(audit.details) : null;
res.json({ status: 'success', data: { ...audit, details } });

// après
const details   = audit.details     ? JSON.parse(audit.details)     : null;
const deadLinks = audit.liens_morts ? JSON.parse(audit.liens_morts) : [];
if (details) details.dead_links = deadLinks;
res.json({ status: 'success', data: { ...audit, details } });
```

---

### Positions Google — simulation supprimée

Sans clé SerpAPI, `measureKeyword` échouait, retournait `null`, mais créait quand même une entrée en base marquant la mesure comme effectuée. Résultat : le moteur de règles croyait avoir des données et générait des recommandations (R07 — page 2 Google) sur du vide.

La correction est de ne plus simuler. `measureKeyword` retourne maintenant `null` directement avec un log d'avertissement, sans toucher à la base. Les règles R06 et R08 ont été adaptées pour fonctionner honnêtement avec `position = null`. R07 (page 2) est désactivée — elle n'a de sens qu'avec une position réelle.

Quand DGS décidera de brancher une vraie API (DataForSEO, SerpAPI, Google Search Console), il n'y a qu'une seule fonction à modifier.

---

## Ce qui fonctionne

### Authentification et contrôle d'accès

L'inscription hache le mot de passe avec bcrypt (12 rounds) et attribue le rôle `REDACTEUR` par défaut. La connexion vérifie le hash et retourne un JWT signé. Toutes les routes protégées passent par le middleware `auth` qui vérifie la signature du token, puis `roles()` qui contrôle que le rôle de l'utilisateur est dans la liste autorisée.

Trois rôles : **ADMIN**, **ANALYSTE**, **REDACTEUR**. Un REDACTEUR ne peut pas créer de site. Un ANALYSTE ne peut pas supprimer un mot-clé. Seul un ADMIN peut purger les données.

---

### CRUD Projets et Sites

Un projet regroupe des sites et appartient à l'utilisateur qui l'a créé. La liste des projets est filtrée par `userId` — chaque utilisateur ne voit que les siens. Pour les sites, seul un ADMIN peut créer, modifier ou supprimer.

---

### Audit SEO

L'audit est le cœur du système. Quand on appelle `POST /api/sites/:id/audits`, le serveur crée immédiatement un `AuditResult` en base avec `statut: "en_cours"` et répond `202` avec l'`auditId`. En parallèle, `auditRunner.js` spawne le crawler Python.

Le crawler (`audit.py`) fait un BFS à partir de l'URL racine : il charge la page, extrait tous les liens internes, les met dans une deque, et visite chaque lien avec un délai de politesse entre les requêtes. Pour chaque page il collecte : `<title>`, `<meta description>`, `<h1>`, balise canonical, directive noindex, et tous les liens. Les liens morts sont vérifiés en parallèle avec un Semaphore pour ne pas surcharger le serveur cible. En dehors du contenu, le crawler mesure aussi le SSL (validité, date d'expiry), le TTFB, l'IP via DNS, et l'âge du domaine via WHOIS.

Tout ça arrive dans `auditRunner.js` sous forme de JSON sur stdout. `auditRunner` calcule deux scores séparés :

**Score technique** (sur 100) — basé sur le contenu des pages crawlées :

| Critère | Impact |
|---|---|
| Pages sans `<title>` | −15 × ratio pages affectées |
| Pages sans meta description | −10 × ratio |
| Pages avec H1 absent ou multiple | −10 × ratio |
| Vitesse moyenne > 3 000 ms | −20 |
| Vitesse moyenne > 1 000 ms | −10 |
| Liens morts | −5 par lien, plafonné à −30 |
| Site < 5 pages | −10 |
| Site < 10 pages | −5 |
| Site ≥ 50 pages | +2 |
| Site ≥ 100 pages | +3 |
| Toutes les pages ont un canonical | +3 |
| Aucune page en noindex | +2 |

Les pénalités de balises sont proportionnelles au ratio de pages affectées, pas binaires. Un site avec 1 titre manquant sur 500 pages perd moins qu'un site avec 100 titres manquants sur 200 pages.

**Score domaine** (sur 100) — basé sur les métriques serveur et DNS :

| Critère | Impact |
|---|---|
| SSL absent ou invalide | −30 |
| SSL expire dans moins de 30 jours | −15 |
| Domaine expire dans moins de 30 jours | −20 |
| TTFB > 600 ms | −20 |
| TTFB > 300 ms | −10 |
| Site non HTTPS | −30 |

Le **score global** combine les deux : `technique × 0.6 + domaine × 0.4`.

En cas d'erreur réseau pure (DNS, connexion refusée), le crawler est relancé une deuxième fois automatiquement avant de marquer l'audit en `echec`. Un timeout global de 10 minutes tue le processus s'il dépasse. À la fin d'un audit réussi, les recommandations sont générées automatiquement.

---

### Mots-clés

Chaque site peut avoir une liste de mots-clés à suivre, avec une priorité (HAUTE / MOYENNE / BASSE), une catégorie libre et un volume de recherche estimé. La liste est triée HAUTE > MOYENNE > BASSE par défaut. On peut filtrer par priorité, catégorie ou faire une recherche sur l'expression. L'endpoint `/stats` retourne le total, la répartition par priorité et catégorie, et le volume total estimé.

La création et la modification sont réservées aux ADMIN et ANALYSTE. Un ANALYSTE ne peut ajouter un mot-clé qu'à un site dont il est propriétaire du projet (contrôle cross-site).

---

### Recommandations

Le moteur de règles tourne dans `recoService.js` et produit des recommandations en deux passes : une sur les données du dernier audit, une sur les mots-clés.

**Règles audit :**
- R01 : pages sans `<title>` → TECHNIQUE, HAUTE
- R02 : pages sans meta description → TECHNIQUE, priorité calculée selon le ratio (HAUTE si plus de 50% des pages sont concernées)
- R03 : problème H1 → TECHNIQUE, MOYENNE
- R04 : vitesse dégradée → TECHNIQUE, HAUTE ou MOYENNE selon le seuil
- R05 : liens morts → TECHNIQUE, HAUTE si ≥ 5 liens morts

**Règles mots-clés :**
- R06 : volume ≥ 500 et position non mesurée → CONTENU, HAUTE ("Créer une page dédiée ciblant ce terme")
- R07 : position en page 2 (11–20) → désactivée, nécessite une API de positionnement réelle
- R08 : priorité HAUTE et position non mesurée → MOTS_CLES, HAUTE ("Lancer une stratégie de contenu ciblée")

Les recommandations sont dédupliquées par message : si une reco identique est déjà OUVERTE ou EN_COURS, elle n'est pas recréée. Le statut suit le cycle OUVERTE → EN_COURS → RESOLUE.

---

### Calendrier éditorial

Le module Contenus permet de planifier des articles liés aux recommandations SEO. Un contenu suit un pipeline en trois étapes : IDEE → REDACTION → PUBLIE. Les transitions sont validées côté serveur — impossible de passer d'IDEE directement à PUBLIE, et impossible de supprimer un contenu déjà publié. Un contenu peut référencer la recommandation à l'origine de sa création, ce qui permet de tracer l'action jusqu'à sa source.

L'endpoint calendrier regroupe les contenus par mois (`"2026-06"`, `"2026-07"`, etc.) en filtrant ceux qui ont une date de publication définie.

---

### Dashboard

Le dashboard site agrège en une seule réponse tout ce dont un analyste a besoin : dernier score d'audit avec l'évolution sur les 10 derniers audits, répartition des mots-clés, top 5 des positions avec tendance (hausse/baisse/stable), recommandations ouvertes, et prochains articles planifiés.

Il calcule aussi un **score de santé globale** :

```
santé = score_audit × 0.4 + score_positions × 0.3 + score_recos × 0.3

score_positions = max(0, 100 − (mots-clés hors top 10 / total) × 100)
score_recos     = max(0, 100 − nb_recommandations_HAUTE_ouvertes × 10)

bon ≥ 70  |  moyen 40–69  |  critique < 40
```

Le dashboard global (`/api/dashboard/global`, ADMIN uniquement) liste tous les sites triés par santé croissante — les plus dégradés apparaissent en premier.

---

### Administration et purge

`GET /health` retourne l'état de la base de données, l'uptime et la version. `GET /api/admin/stats` retourne les compteurs globaux (sites, audits, mots-clés, taille de la base). `POST /api/admin/purge` déclenche manuellement la suppression des données de plus de 90 jours (audits et positionnements). Cette purge tourne aussi automatiquement chaque nuit à 02:00 UTC via `node-cron`.

---

## Architecture

```
Client
  │
  ▼
Express — src/app.js (port 3000)
  │
  ├── /health                         healthCheck (admin)
  ├── /api/auth                       inscription, connexion
  ├── /api/projets                    CRUD projets
  ├── /api/sites                      CRUD sites
  │     ├── /:id/audits               lancement + historique + détail
  │     ├── /:id/mots-cles            CRUD + stats + mesure positions
  │     ├── /:id/recommandations      génération + liste + statut
  │     ├── /:id/contenus             CRUD + calendrier
  │     └── /:id/dashboard            dashboard site
  ├── /api/dashboard/global           vue globale (ADMIN)
  ├── /api/admin                      stats + purge (ADMIN)
  └── /api/docs                       Swagger UI

Middlewares (dans l'ordre) :
  requestLogger → rateLimit → auth → roles → validate → errorHandler

Services métier (pas d'accès HTTP direct) :
  auditRunner.js    orchestration crawl + calcul des scores
  recoService.js    moteur de règles R01–R08
  positionService.js  stub null en attente d'une API

Crawl (subprocess Python) :
  audit.py
  ├── BFS avec deque, respect robots.txt, délai configurable
  ├── Extraction SEO par page
  ├── Vérification des liens morts (HEAD → GET, Semaphore)
  └── SSL, DNS, WHOIS, TTFB → JSON stdout → auditRunner.js

Tâche planifiée :
  purgeCron.js — node-cron, 02:00 UTC, rétention 90 jours
```

---

## Modèle de données

```
User ──< Projet ──< Site ──< AuditResult
                        ├──< Keyword ──< Positionnement
                        ├──< Recommandation ──< ContenuEditorial
                        └──< ContenuEditorial
```

`AuditResult` stocke le score global, le statut (`en_cours` / `termine` / `echec`), la vitesse moyenne, les balises manquantes (JSON), les liens morts (JSON), et un blob `details` qui contient tout le reste (scores décomposés, breakdown, données SSL/DNS/WHOIS, liste des pages).

`Recommandation` peut être liée à un audit (R01–R05) ou à un mot-clé (R06–R08), ou aux deux. `ContenuEditorial` peut pointer vers la recommandation qui l'a motivé.

---

## Configuration

```env
DATABASE_URL="file:/chemin/absolu/vers/prisma/dev.db"   # absolu obligatoire
JWT_SECRET="..."

PORT=3000
JWT_EXPIRES_IN=7d

CRAWLER_MAX_PAGES=500        # pages max par crawl (défaut)
CRAWLER_DELAY_MS=500         # délai entre requêtes en ms
CRAWLER_MAX_WORKERS=5        # parallélisme pour les liens morts
CRAWLER_TIMEOUT_MS=600000    # 10 minutes avant kill du processus
```

---

## Tests

89 tests, 12 fichiers, tous passent.

| Fichier | Tests |
|---|---|
| `unit/pagination.test.js` | 13 |
| `unit/recoService.test.js` | 10 |
| `integration/auth.test.js` | 9 |
| `integration/sites.test.js` | 9 |
| `integration/contenus.test.js` | 8 |
| `integration/keywords.test.js` | 7 |
| `unit/scoring.test.js` | 7 |
| `unit/errors.test.js` | 7 |
| `integration/admin.test.js` | 7 |
| `integration/recommandations.test.js` | 6 |
| `integration/dashboard.test.js` | 6 |
| `integration/audits.test.js` | 5 |

Les tests d'intégration utilisent une base SQLite en mémoire isolée par suite. Les tests unitaires couvrent le moteur de scoring, le moteur de règles et les helpers de pagination sans dépendance à la base.

### Test E2E sur seneweb.com (24 juin 2026)

Audit complet sur un vrai site de presse sénégalais, 500 pages crawlées en ~9 minutes :

| | |
|---|---|
| Score global | 79/100 |
| Score technique | 65/100 |
| Score domaine | 100/100 |
| TTFB | 298 ms |
| SSL | valide, 69 jours restants |
| Âge du domaine | 26 ans |
| Liens morts | 32 (URLs en 404) |

Les 35 points perdus sur le score technique se décomposent : 32 liens morts (−30 pts, plafond atteint), H1 manquant sur 440/500 pages (−9 pts), meta description manquante sur 47/500 pages (−1 pt). Le domaine est en revanche irréprochable : SSL valide, HTTPS, TTFB sous 300 ms, aucune pénalité.

---

## Limite connue : sites SPA

Le crawler lit le HTML brut renvoyé par le serveur. Les sites React, Vue ou Angular renvoient un `<div id="root"></div>` vide — le contenu est rendu côté client par JavaScript, invisible pour un crawler HTTP classique. Ces sites sont analysés comme « 1 page, 0 lien ». Pour les prendre en charge correctement, il faudrait passer par un navigateur headless (Playwright ou Puppeteer).
