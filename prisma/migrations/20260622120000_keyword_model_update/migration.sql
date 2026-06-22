-- Reconstruction de la table Keyword avec les nouveaux champs métier
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

DROP TABLE "Keyword";

CREATE TABLE "Keyword" (
    "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "expression"    TEXT     NOT NULL,
    "categorie"     TEXT,
    "volume_estime" INTEGER,
    "priorite"      TEXT     NOT NULL DEFAULT 'MOYENNE',
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId"        INTEGER  NOT NULL,
    CONSTRAINT "Keyword_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

PRAGMA defer_foreign_keys=OFF;
PRAGMA foreign_keys=ON;

-- Index unique sur Site.url (manquant de la migration initiale)
CREATE UNIQUE INDEX IF NOT EXISTS "Site_url_key" ON "Site"("url");
