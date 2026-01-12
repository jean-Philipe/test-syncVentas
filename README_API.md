# API de Órdenes de Compra - AXAM

Backend completo con Prisma para gestionar ventas históricas, ventas actuales, stock y pedidos de productos.

## 🚀 Configuración Inicial

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Copia `env.example` a `.env` y configura:
```bash
cp env.example .env
```

Asegúrate de que `DATABASE_URL` apunte a tu base de datos:
```
DATABASE_URL="file:./data/ventas.db"
```

### 3. Generar cliente de Prisma
```bash
npm run prisma:generate
```

### 4. Crear base de datos y tablas
Si es la primera vez, aplica las migraciones:
```bash
npx prisma migrate dev
```

### 5. Migrar datos existentes (si tienes datos en la BD antigua)
```bash
npm run migrar:prisma
```

Este script migrará los datos de `ventas_mensuales` a `ventas_historicas` y `ventas_actuales` según corresponda.

## 📡 Iniciar el Servidor

```bash
npm run server
# o
npm run dev
```

El servidor se iniciará en `http://localhost:3000` (o el puerto configurado en `PORT`).

## 🖥️ Frontend Web

El proyecto incluye un frontend web básico estilo Excel para gestionar y visualizar los datos.

### Acceder al Frontend

Una vez iniciado el servidor, abre tu navegador en:
```
http://localhost:3000
```

### Funcionalidades del Frontend

- **Visualización estilo Excel**: Tabla con todos los productos y sus datos
- **Filtros**:
  - **Marca**: Filtrar productos por prefijo del SKU (ej: "KC" para Kimberly Clark)
  - **Meses**: Seleccionar cantidad de meses históricos a consultar (3, 6 o 12 meses)
- **Búsqueda**: Buscar productos por SKU o descripción
- **Edición de Pedidos**: Hacer clic en la celda "Pedido Actual" para editar directamente
- **Cálculo Automático**: La columna "Compra Sugerida" se calcula automáticamente como `Promedio Venta - Stock Actual`
  - Valores negativos (en rojo) indican que hay exceso de stock y no se debe comprar más
  - Valores positivos indican la cantidad sugerida a comprar

### Columnas de la Tabla

1. **SKU**: Código del producto
2. **Descripción**: Nombre del producto
3. **Stock Actual**: Stock actual del producto (resaltado en amarillo)
4. **Promedio Venta**: Promedio de ventas mensuales según el período seleccionado
5. **Compra Sugerida**: Calculado como `Promedio Venta - Stock Actual` (puede ser negativo)
6. **Pedido Actual**: Cantidad de pedido para el mes actual (editable, resaltado en amarillo)
7. **Venta Actual**: Ventas del mes actual
8. **Promedio Monto**: Promedio de monto neto mensual

### Editar Pedidos

1. Haz clic en la celda "Pedido Actual" del producto que deseas editar
2. Ingresa la cantidad deseada
3. Presiona Enter o haz clic fuera de la celda para guardar
4. El pedido se guarda automáticamente en la base de datos

## 📚 Endpoints de la API

### Productos

#### GET `/api/productos/ventas-historicas`
Obtener ventas históricas con filtros.

**Query Parameters:**
- `meses` (opcional, default: 12): Cantidad de meses hacia atrás a consultar (1-12)
- `marca` (opcional): Prefijo del SKU para filtrar por marca (ej: "KC" para Kimberly Clark)

**Ejemplo:**
```bash
GET /api/productos/ventas-historicas?meses=3&marca=KC
```

**Respuesta:**
```json
{
  "mesesConsultados": 3,
  "marca": "KC",
  "totalProductos": 150,
  "productos": [
    {
      "producto": {
        "id": 1,
        "sku": "KC43106U",
        "descripcion": "Paños Wypall X-80 Plus Verde"
      },
      "ventasPorMes": [
        {
          "ano": 2025,
          "mes": 10,
          "cantidadVendida": 50,
          "montoNeto": 125000
        }
      ],
      "promedioVenta": 45.67,
      "promedioMonto": 114175.00,
      "totalMeses": 3
    }
  ]
}
```

#### GET `/api/productos/ventas-actuales`
Obtener stock y ventas actuales del mes de cada producto.

**Query Parameters:**
- `marca` (opcional): Prefijo del SKU para filtrar por marca

**Ejemplo:**
```bash
GET /api/productos/ventas-actuales?marca=KC
```

**Respuesta:**
```json
{
  "marca": "KC",
  "totalProductos": 150,
  "productos": [
    {
      "producto": {
        "id": 1,
        "sku": "KC43106U",
        "descripcion": "Paños Wypall X-80 Plus Verde"
      },
      "cantidadVendida": 15,
      "stockActual": 8,
      "montoNeto": 37500
    }
  ]
}
```

#### GET `/api/productos/completo`
Obtener información completa: histórico + actual + pedidos.

**Query Parameters:**
- `meses` (opcional, default: 12): Cantidad de meses hacia atrás
- `marca` (opcional): Prefijo del SKU

**Ejemplo:**
```bash
GET /api/productos/completo?meses=6&marca=KC
```

**Respuesta:**
```json
{
  "mesesConsultados": 6,
  "marca": "KC",
  "mesActual": { "ano": 2026, "mes": 1 },
  "totalProductos": 150,
  "productos": [
    {
      "producto": {
        "id": 1,
        "sku": "KC43106U",
        "descripcion": "Paños Wypall X-80 Plus Verde"
      },
      "ventasHistoricas": [...],
      "ventaActual": {
        "cantidadVendida": 15,
        "stockActual": 8,
        "montoNeto": 37500
      },
      "promedioVenta": 45.67,
      "promedioMonto": 114175.00,
      "pedidos": [...],
      "pedidoActual": 40
    }
  ]
}
```

### Pedidos

#### GET `/api/pedidos`
Listar pedidos con filtros opcionales.

**Query Parameters:**
- `productoId` (opcional): ID del producto
- `ano` (opcional): Año del pedido
- `mes` (opcional): Mes del pedido (1-12)
- `marca` (opcional): Prefijo del SKU

#### GET `/api/pedidos/:productoId`
Obtener todos los pedidos de un producto específico.

#### PUT `/api/pedidos/:productoId`
Crear o actualizar pedido para un producto en un mes específico.

**Body:**
```json
{
  "ano": 2026,
  "mes": 1,
  "cantidad": 40
}
```

#### PUT `/api/pedidos/:productoId/actual`
Crear o actualizar pedido para el mes actual.

**Body:**
```json
{
  "cantidad": 40
}
```

#### DELETE `/api/pedidos/:productoId/:ano/:mes`
Eliminar un pedido específico.

### Rotación de Datos

#### POST `/api/rotacion/ejecutar`
Ejecutar rotación manual de datos (mover mes actual a histórico y limpiar datos > 12 meses).

#### GET `/api/rotacion/verificar`
Verificar si es necesario rotar datos (si cambió el mes).

## 🔄 Rotación Automática de Datos

El sistema maneja automáticamente la rotación de datos:

1. **Al iniciar el servidor**: Verifica si cambió el mes y ejecuta rotación automática si es necesario.
2. **Rotación**: Mueve las ventas del mes actual a `ventas_historicas` y resetea las ventas actuales (mantiene el stock).
3. **Limpieza**: Elimina datos históricos mayores a 12 meses.

### Ejecutar rotación manualmente

```bash
curl -X POST http://localhost:3000/api/rotacion/ejecutar
```

## 📊 Estructura de la Base de Datos

### Tablas

- **productos**: Información de productos (SKU, descripción)
- **ventas_historicas**: Ventas históricas por mes (últimos 12 meses)
- **ventas_actuales**: Ventas y stock del mes actual
- **pedidos**: Pedidos planificados por producto y mes

### Índices Optimizados

Todas las consultas están optimizadas con índices:
- Índices en `producto_id`, `ano`, `mes` para consultas rápidas
- Índices compuestos para filtros combinados
- Índice único en SKU para búsquedas rápidas por marca

## 🛠️ Scripts Disponibles

```bash
# Generar cliente de Prisma
npm run prisma:generate

# Crear migraciones
npm run prisma:migrate

# Abrir Prisma Studio (interfaz visual de BD)
npm run prisma:studio

# Migrar datos existentes a Prisma
npm run migrar:prisma

# Iniciar servidor
npm run server
```

## 📝 Notas Importantes

1. **Stock Actual**: El campo `stockActual` en `ventas_actuales` debe actualizarse desde tu sistema de inventario. Puedes crear un script o endpoint adicional para sincronizar este dato.

2. **Compra Sugerida**: Se calcula en el frontend como `promedioVenta - stockActual`. El backend solo proporciona los datos necesarios.

3. **Filtro por Marca**: El filtro `marca` busca productos cuyo SKU comienza con el prefijo especificado (ej: "KC" encuentra "KC43106U", "KC46470", etc.).

4. **Rendimiento**: Las consultas están optimizadas con índices y agregaciones eficientes. Para grandes volúmenes de datos, considera:
   - Paginación en los endpoints
   - Caché de consultas frecuentes
   - Optimización adicional según tus necesidades específicas

## 🔍 Ejemplos de Uso

### Consultar ventas de últimos 3 meses de productos KC
```bash
curl "http://localhost:3000/api/productos/ventas-historicas?meses=3&marca=KC"
```

### Obtener información completa para análisis
```bash
curl "http://localhost:3000/api/productos/completo?meses=6&marca=KC"
```

### Actualizar pedido del mes actual
```bash
curl -X PUT "http://localhost:3000/api/pedidos/1/actual" \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 50}'
```

## 🐛 Troubleshooting

### Error: "Prisma Client not generated"
```bash
npm run prisma:generate
```

### Error: "Database not found"
Asegúrate de que `DATABASE_URL` en `.env` apunte a la ruta correcta y que el archivo exista.

### Error: "Migration not applied"
```bash
npx prisma migrate dev
```
