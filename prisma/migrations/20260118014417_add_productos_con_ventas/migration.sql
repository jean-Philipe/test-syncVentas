-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sync_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "mes_target" INTEGER NOT NULL,
    "ano_target" INTEGER NOT NULL,
    "documentos" INTEGER NOT NULL DEFAULT 0,
    "productos" INTEGER NOT NULL DEFAULT 0,
    "productos_con_ventas" INTEGER NOT NULL DEFAULT 0,
    "mensaje" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_sync_logs" ("ano_target", "created_at", "documentos", "id", "mensaje", "mes_target", "productos", "tipo") SELECT "ano_target", "created_at", "documentos", "id", "mensaje", "mes_target", "productos", "tipo" FROM "sync_logs";
DROP TABLE "sync_logs";
ALTER TABLE "new_sync_logs" RENAME TO "sync_logs";
CREATE INDEX "sync_logs_tipo_idx" ON "sync_logs"("tipo");
CREATE INDEX "sync_logs_created_at_idx" ON "sync_logs"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
