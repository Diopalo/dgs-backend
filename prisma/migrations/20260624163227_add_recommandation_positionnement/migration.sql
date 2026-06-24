-- CreateTable
CREATE TABLE "Positionnement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "position" INTEGER NOT NULL,
    "mesuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keywordId" INTEGER NOT NULL,
    CONSTRAINT "Positionnement_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommandation" (
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
    CONSTRAINT "Recommandation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Recommandation_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AuditResult" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recommandation_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Keyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "expression" TEXT NOT NULL,
    "categorie" TEXT,
    "volume_estime" INTEGER,
    "priorite" TEXT NOT NULL DEFAULT 'MOYENNE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "siteId" INTEGER NOT NULL,
    CONSTRAINT "Keyword_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Keyword" ("categorie", "createdAt", "expression", "id", "priorite", "siteId", "updatedAt", "volume_estime") SELECT "categorie", "createdAt", "expression", "id", "priorite", "siteId", "updatedAt", "volume_estime" FROM "Keyword";
DROP TABLE "Keyword";
ALTER TABLE "new_Keyword" RENAME TO "Keyword";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
