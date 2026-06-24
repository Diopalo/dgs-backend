-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Positionnement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "position" INTEGER,
    "url_trouvee" TEXT,
    "mesuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keywordId" INTEGER NOT NULL,
    CONSTRAINT "Positionnement_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Positionnement" ("id", "keywordId", "mesuredAt", "position") SELECT "id", "keywordId", "mesuredAt", "position" FROM "Positionnement";
DROP TABLE "Positionnement";
ALTER TABLE "new_Positionnement" RENAME TO "Positionnement";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
