-- CreateTable
CREATE TABLE "productos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ventas_historicas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producto_id" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "cantidad_vendida" REAL NOT NULL DEFAULT 0,
    "monto_neto" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ventas_historicas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ventas_actuales" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producto_id" INTEGER NOT NULL,
    "cantidad_vendida" REAL NOT NULL DEFAULT 0,
    "stock_actual" REAL NOT NULL DEFAULT 0,
    "monto_neto" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ventas_actuales_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producto_id" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pedidos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE INDEX "productos_sku_idx" ON "productos"("sku");

-- CreateIndex
CREATE INDEX "ventas_historicas_producto_id_idx" ON "ventas_historicas"("producto_id");

-- CreateIndex
CREATE INDEX "ventas_historicas_ano_mes_idx" ON "ventas_historicas"("ano", "mes");

-- CreateIndex
CREATE INDEX "ventas_historicas_producto_id_ano_mes_idx" ON "ventas_historicas"("producto_id", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_historicas_producto_id_ano_mes_key" ON "ventas_historicas"("producto_id", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_actuales_producto_id_key" ON "ventas_actuales"("producto_id");

-- CreateIndex
CREATE INDEX "ventas_actuales_producto_id_idx" ON "ventas_actuales"("producto_id");

-- CreateIndex
CREATE INDEX "pedidos_producto_id_idx" ON "pedidos"("producto_id");

-- CreateIndex
CREATE INDEX "pedidos_ano_mes_idx" ON "pedidos"("ano", "mes");

-- CreateIndex
CREATE INDEX "pedidos_producto_id_ano_mes_idx" ON "pedidos"("producto_id", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_producto_id_ano_mes_key" ON "pedidos"("producto_id", "ano", "mes");
