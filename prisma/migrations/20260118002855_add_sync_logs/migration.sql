-- CreateTable
CREATE TABLE "sync_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "mes_target" INTEGER NOT NULL,
    "ano_target" INTEGER NOT NULL,
    "documentos" INTEGER NOT NULL DEFAULT 0,
    "productos" INTEGER NOT NULL DEFAULT 0,
    "mensaje" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "sync_logs_tipo_idx" ON "sync_logs"("tipo");

-- CreateIndex
CREATE INDEX "sync_logs_created_at_idx" ON "sync_logs"("created_at");
