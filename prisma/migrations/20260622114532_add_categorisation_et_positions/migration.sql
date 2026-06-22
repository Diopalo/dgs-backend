/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `Site` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Positionnement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "position" INTEGER NOT NULL,
    "dateMesure" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keywordId" INTEGER NOT NULL,
    CONSTRAINT "Positionnement_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Keyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "motCle" TEXT NOT NULL,
    "urlCible" TEXT,
    "volumeRecherche" INTEGER,
    "categorie" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'MOYENNE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "siteId" INTEGER NOT NULL,
    CONSTRAINT "Keyword_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Keyword" ("createdAt", "id", "motCle", "siteId", "updatedAt", "urlCible", "volumeRecherche") SELECT "createdAt", "id", "motCle", "siteId", "updatedAt", "urlCible", "volumeRecherche" FROM "Keyword";
DROP TABLE "Keyword";
ALTER TABLE "new_Keyword" RENAME TO "Keyword";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Positionnement_keywordId_dateMesure_idx" ON "Positionnement"("keywordId", "dateMesure");

-- CreateIndex
CREATE UNIQUE INDEX "Site_url_key" ON "Site"("url");
