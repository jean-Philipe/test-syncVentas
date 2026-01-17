-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_productos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "familia" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_productos" ("created_at", "descripcion", "id", "sku", "updated_at") SELECT "created_at", "descripcion", "id", "sku", "updated_at" FROM "productos";
DROP TABLE "productos";
ALTER TABLE "new_productos" RENAME TO "productos";
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");
CREATE INDEX "productos_sku_idx" ON "productos"("sku");
CREATE INDEX "productos_familia_idx" ON "productos"("familia");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
