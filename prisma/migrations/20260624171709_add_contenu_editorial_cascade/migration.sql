-- CreateTable
CREATE TABLE "ContenuEditorial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titre" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'IDEE',
    "date_publication" DATETIME,
    "assigneA" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "siteId" INTEGER NOT NULL,
    "recommandationId" INTEGER,
    CONSTRAINT "ContenuEditorial_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContenuEditorial_recommandationId_fkey" FOREIGN KEY ("recommandationId") REFERENCES "Recommandation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "score" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "vitesse_ms" INTEGER,
    "balises_manquantes" TEXT,
    "liens_morts" TEXT,
    "details" TEXT,
    "crawledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId" INTEGER NOT NULL,
    CONSTRAINT "AuditResult_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AuditResult" ("balises_manquantes", "crawledAt", "details", "id", "liens_morts", "score", "siteId", "statut", "vitesse_ms") SELECT "balises_manquantes", "crawledAt", "details", "id", "liens_morts", "score", "siteId", "statut", "vitesse_ms" FROM "AuditResult";
DROP TABLE "AuditResult";
ALTER TABLE "new_AuditResult" RENAME TO "AuditResult";
CREATE TABLE "new_Keyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "expression" TEXT NOT NULL,
    "categorie" TEXT,
    "volume_estime" INTEGER,
    "priorite" TEXT NOT NULL DEFAULT 'MOYENNE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "siteId" INTEGER NOT NULL,
    CONSTRAINT "Keyword_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Keyword" ("categorie", "createdAt", "expression", "id", "priorite", "siteId", "updatedAt", "volume_estime") SELECT "categorie", "createdAt", "expression", "id", "priorite", "siteId", "updatedAt", "volume_estime" FROM "Keyword";
DROP TABLE "Keyword";
ALTER TABLE "new_Keyword" RENAME TO "Keyword";
CREATE TABLE "new_Positionnement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "position" INTEGER,
    "url_trouvee" TEXT,
    "mesuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keywordId" INTEGER NOT NULL,
    CONSTRAINT "Positionnement_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Positionnement" ("id", "keywordId", "mesuredAt", "position", "url_trouvee") SELECT "id", "keywordId", "mesuredAt", "position", "url_trouvee" FROM "Positionnement";
DROP TABLE "Positionnement";
ALTER TABLE "new_Positionnement" RENAME TO "Positionnement";
CREATE TABLE "new_Recommandation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "auditId" INTEGER,
    "keywordId" INTEGER,
    "type" TEXT NOT NULL,
    "priorite" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recommandation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recommandation_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AuditResult" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recommandation_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Recommandation" ("auditId", "createdAt", "id", "keywordId", "message", "priorite", "siteId", "statut", "type", "updatedAt") SELECT "auditId", "createdAt", "id", "keywordId", "message", "priorite", "siteId", "statut", "type", "updatedAt" FROM "Recommandation";
DROP TABLE "Recommandation";
ALTER TABLE "new_Recommandation" RENAME TO "Recommandation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
