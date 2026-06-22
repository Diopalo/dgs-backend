# DGS SEO Platform — Rapport technique de la branche `pom`

> Auteur : Papa Ousmane Mane  
> Date : 22 juin 2026  
> Branche : `pom` (correctifs + J5 mots-clés)

---

## 1. Bugs corrigés

### Bug 1 — Escalade de privilèges via le champ `role` à l'inscription
**Fichier :** `src/controleurs/authControleur.js`  
**Problème :** Le champ `role` était lu depuis `req.body` et enregistré directement en base, permettant à n'importe qui de s'inscrire en tant qu'ADMIN.  
**Correction :** Suppression de `role` du destructuring et du `prisma.user.create`. Le rôle par défaut (`REDACTEUR`) défini dans le schéma Prisma s'applique automatiquement.

```js
// Avant (faille)
const { name, email, password, role } = req.body;
data: { name, email, password: hash, role }

// Après (corrigé)
const { name, email, password } = req.body;
data: { name, email, password: hash }
```

---

### Bug 2 — Historique des audits trié sur le mauvais champ
**Fichier :** `src/controleurs/siteControleur.js` — fonction `listAudits`  
**Problème :** `orderBy: { createdAt: "desc" }` — le modèle `AuditResult` n'a pas de champ `createdAt`, il a `crawledAt`. Prisma levait une erreur silencieuse.  
**Correction :** `orderBy: { crawledAt: "desc" }`

---

### Bug 3 — Audit bloquant (réponse HTTP jamais envoyée)
**Fichier :** `src/controleurs/siteControleur.js` — fonction `launchAudit`  
**Problème :** `await runAudit(...)` bloquait la requête pendant toute la durée du crawl (plusieurs minutes). Le client recevait un timeout.  
**Correction :** Pattern fire-and-forget — `runAudit(audit.id, site.url)` sans `await`. Le serveur répond immédiatement `202 Accepted` avec l'`auditId`, et le crawl tourne en arrière-plan.

```js
// Avant (bloquant)
await runAudit(audit.id, site.url);
return res.status(200).json({ ... });

// Après (fire-and-forget)
runAudit(audit.id, site.url);   // pas d'await
return res.status(202).json({ success: true, auditId: audit.id });
```

---

### Bug 4 — Deux bases SQLite différentes (CLI vs runtime Node)
**Fichier :** `.env`  
**Problème :** `DATABASE_URL="file:./dev.db"` → chemin relatif. Le CLI Prisma (`npx prisma migrate`) résolvait vers `prisma/dev.db`, tandis que Node.js résolvait vers `./dev.db` (racine). Résultat : deux fichiers SQLite distincts, les migrations ne s'appliquaient pas sur la base utilisée au runtime.  
**Correction :** Chemin absolu dans `.env` :  
```
DATABASE_URL="file:/home/ousmane/www/dgs-backend/prisma/dev.db"
```

---

### Bug 5 — Resolver DNS async d'aiohttp cassé
**Fichier :** `src/crawler/audit.py`  
**Problème :** Le resolver DNS asynchrone natif d'aiohttp (`asyncio.shield(resolved_host_task)`) était annulé dans certains environnements, provoquant des erreurs de connexion sur tous les sites.  
**Correction :** Utilisation de `aiohttp.ThreadedResolver()` qui délègue la résolution DNS à `socket.getaddrinfo` via un thread pool (résolution synchrone du système, sans les bugs du resolver async).

```python
resolver  = aiohttp.ThreadedResolver()
connector = aiohttp.TCPConnector(limit=max_workers, ssl=False, resolver=resolver)
```

---

### Bug 6 — Encodage Brotli non supporté
**Fichier :** `src/crawler/audit.py`  
**Problème :** Certains sites (ex: example.com) renvoyaient `Content-Encoding: br` (Brotli). La version système d'aiohttp ne décode pas Brotli → exception à la lecture du body.  
**Correction :** Header `Accept-Encoding: gzip, deflate` pour exclure Brotli des encodages acceptés.

```python
headers = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}
```

---

### Bug 7 — robots.txt 404 bloquait l'intégralité du crawl
**Fichier :** `src/crawler/audit.py`  
**Problème :** `urllib.robotparser.RobotFileParser.can_fetch()` retourne `False` si `read()` n'a jamais été appelé. Or, on utilisait `parse()` manuellement sur le contenu 200, mais en cas de 404 on n'appelait rien → toutes les URLs étaient rejetées.  
**Correction :** Définir `rp.allow_all = True` explicitement quand le status n'est pas 200 ou en cas d'exception.

```python
if resp.status == 200:
    rp.parse(text.splitlines())
else:
    rp.allow_all = True  # 404/5xx → pas de restriction (standard RFC)
```

---

## 2. Ce qui fonctionne

### Authentification & Contrôle d'accès (J2)
- Inscription (`POST /api/auth/inscription`) — hash bcrypt, rôle par défaut REDACTEUR
- Connexion (`POST /api/auth/connexion`) — JWT signé, valide 24h
- Middleware `authentification` — vérifie le JWT sur toutes les routes protégées
- Middleware `autorisationRole(...)` — bloque l'accès si le rôle ne correspond pas
- 3 rôles : `ADMIN`, `ANALYSTE`, `REDACTEUR`

### CRUD Projets (J3)
- `GET /api/projets` — liste les projets de l'utilisateur connecté
- `POST /api/projets` — crée un projet (tous rôles)
- `PUT /api/projets/:id`, `DELETE /api/projets/:id` — modification/suppression (propriétaire ou ADMIN)

### CRUD Sites (J3)
- `GET /api/sites`, `GET /api/sites/:id`
- `POST /api/sites` — ADMIN uniquement
- `PUT /api/sites/:id`, `DELETE /api/sites/:id` — ADMIN uniquement

### Audit SEO asynchrone (J4)
- `POST /api/sites/:id/audits` — lance un audit en arrière-plan, répond `202` immédiatement
- `GET /api/sites/:id/audits` — historique des audits triés par `crawledAt desc`
- Cycle de vie en base : `en_cours` → `termine` / `echec`
- Retry automatique (RG-05) : 2 tentatives en cas d'erreur réseau pure
- Timeout configurable via `.env` (`AUDIT_TIMEOUT_MS`, défaut 10 min)

### Crawler BFS Python (J4)
- Crawl en largeur (BFS) avec `deque`
- Respect de `robots.txt` avant chaque requête (RG-01)
- Délai de politesse configurable (`AUDIT_DELAY_MS`)
- Extraction SEO par page : `<title>`, `<meta description>`, `<h1>`, canonical, noindex, nofollow
- Collecte des liens internes + externes
- Vérification des liens morts en parallèle (HEAD → GET fallback, Semaphore)
- Paramètres CLI : `--max-pages`, `--delay-ms`, `--max-workers`

### Score SEO (RG-02)
Calcul sur 100 points dans `src/services/auditRunner.js` :

| Critère | Pénalité |
|---|---|
| Titre manquant | -15 × ratio pages affectées |
| Meta description manquante | -10 × ratio |
| H1 absent ou multiple | -10 × ratio |
| Vitesse moy. > 3000 ms | -20 |
| Vitesse moy. > 1000 ms | -10 |
| Lien mort | -5 par lien (cap -30) |
| Toutes pages ont canonical | +3 |
| Aucun noindex | +2 |

### Module Mots-clés (J5)
- `GET /api/sites/:siteId/mots-cles` — liste avec filtres (`?priorite`, `?categorie`, `?search`) et tri HAUTE > MOYENNE > BASSE
- `POST /api/sites/:siteId/mots-cles` — ADMIN + ANALYSTE, validation complète + vérification ownership
- `PUT /api/sites/:siteId/mots-cles/:id` — mise à jour partielle, vérification cross-site
- `DELETE /api/sites/:siteId/mots-cles/:id` — ADMIN uniquement
- `GET /api/sites/:siteId/mots-cles/stats` — agrégats (total, par priorité, par catégorie, volume total)

---

## 3. Comment ça doit fonctionner

### Architecture générale

```
Client HTTP
    │
    ▼
Express (serveur.js, port 3000)
    │
    ├── /api/auth      → authRoutes     → authControleur
    ├── /api/projets   → projetRoutes   → projetControleur
    ├── /api/sites     → siteRoutes     → siteControleur
    │                  → motCleRoutes   → motCleControleur
    │
    └── siteControleur.launchAudit()
            │  fire-and-forget (pas d'await)
            ▼
        auditRunner.runAudit(auditId, siteUrl)
            │
            ├── spawn python3 src/crawler/audit.py <url> --max-pages N ...
            │       │
            │       └── BFS crawler → JSON stdout
            │
            ├── calculateSeoScore(crawlResult) → score/100
            └── prisma.auditResult.update(...)  → statut: "termine"
```

### Flux d'un audit complet

1. `POST /api/sites/:id/audits` (ADMIN ou ANALYSTE)
2. Serveur crée un `AuditResult` en base avec `statut: "en_cours"`, `score: 0`
3. Serveur répond `202 { auditId: N }` immédiatement
4. En arrière-plan : `audit.py` crawle le site en BFS
   - Charge `robots.txt`, respecte les règles
   - Visite chaque page (délai de politesse entre requêtes)
   - Extrait les métriques SEO
   - Vérifie les liens morts en parallèle
   - Imprime le JSON résultat sur stdout
5. `auditRunner.js` parse le JSON, calcule le score
6. Met à jour `AuditResult` : `statut: "termine"`, `score`, `vitesse_ms`, `balises_manquantes`, `liens_morts`, `details`
7. Le client poll `GET /api/sites/:id/audits` pour voir quand `statut !== "en_cours"`

### Limite connue : sites SPA (React / Vue / Angular)

Le crawler HTTP lit le HTML **brut** renvoyé par le serveur. Les sites qui utilisent un framework JavaScript côté client (ex: femmesluxe.com) renvoient un HTML minimal :
```html
<body><div id="root"></div></body>
```
Le contenu réel est généré par JavaScript dans le navigateur — invisible au crawler HTTP. Ces sites seront analysés comme "1 page, 0 lien". Pour les supporter correctement, il faudrait intégrer Playwright ou Puppeteer (prévu dans un jalon ultérieur).

### Variables d'environnement (.env)

```env
DATABASE_URL="file:/chemin/absolu/vers/prisma/dev.db"  # ABSOLU obligatoire
JWT_SECRET="votre-secret-fort"
PORT=3000

# Crawler (optionnel)
AUDIT_MAX_PAGES=500       # pages max par crawl
AUDIT_DELAY_MS=500        # délai entre requêtes (ms)
AUDIT_MAX_WORKERS=5       # workers parallèles (liens morts)
AUDIT_TIMEOUT_MS=600000   # timeout global par audit (10 min)
```

### Schéma de base de données

```
User ──< Projet ──< Site ──< AuditResult
                        └──< Keyword
```

- `User` : authentification, rôle ADMIN/ANALYSTE/REDACTEUR
- `Projet` : groupe de sites, appartient à un User
- `Site` : URL unique, appartient à un Projet
- `AuditResult` : résultat d'un crawl SEO, appartient à un Site
- `Keyword` : mot-clé suivi, priorité HAUTE/MOYENNE/BASSE, appartient à un Site

---

## 4. Tests de validation exécutés

| Test | Statut |
|---|---|
| Inscription sans champ `role` dans le body | PASS |
| Connexion et récupération du JWT | PASS |
| Refus de rôle non autorisé (403) | PASS |
| CRUD sites + projets | PASS |
| Audit `quotes.toscrape.com` — 20 pages crawlées, score 92/100 | PASS |
| Audit site inexistant — 2 tentatives, statut `echec` | PASS |
| Audit `femmesluxe.com` — 1 page (SPA, comportement attendu) | PASS |
| Création 4 mots-clés avec priorités différentes | PASS |
| Tri HAUTE > MOYENNE > BASSE | PASS |
| Filtre `?priorite=HAUTE` → 2 résultats | PASS |
| Stats : `total=4`, `volume_total_estime=4900` | PASS |
| DELETE par ANALYSTE → 403 | PASS |
| POST par ANALYSTE sur site d'autrui → 403 ownership | PASS |
| Protection cross-site (mot-clé d'un autre site) → 404 | PASS |
