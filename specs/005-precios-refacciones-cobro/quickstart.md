# Quickstart — Validación del Sprint 5

**Fecha**: 2026-11-03 | **Rama**: `005-precios-refacciones-cobro`

Guía de puesta en marcha y validación de extremo a extremo del precio guardado
en las líneas de refacción: catálogo con tope → uso en orden con instantánea →
total → corrección administrativa → pago (con cancelación del pendiente
desfasado) → ticket estable. Los contratos viven en [contracts/](contracts/) y
las tablas en [data-model.md](data-model.md); este archivo no duplica ese
detalle.

## Requisitos previos

- Windows con PowerShell (los scripts del entorno son `.ps1`).
- MySQL 8 o superior instalado de forma **local** (nativo, no Docker).
- Node.js LTS.
- Flutter 3.47 con soporte de escritorio.
- Entorno de los Sprints 1–4 ya creado (usuario dedicado `motorix_app`, `.env`
  completo, esquema 001–013 aplicado, seeds del Sprint 4).

## Puesta en marcha

```powershell
# 1. Esquema del Sprint 5: migración nueva 014 (aditiva, idempotente, registro en schema_migrations)
database/scripts/aplicar-migraciones.ps1

# 2. Backend
cd server
npm install
npm.cmd start                 # debe escuchar el puerto definido en .env

# 3. Seeds del sprint (idempotentes: correrlos 2 veces no duplica nada)
npm.cmd run seed

# 4. Frontend (escritorio Windows)
cd ../client
flutter pub get
flutter run -d windows
```

**Resultado esperado**: `schema_migrations` registra `014_order_parts_price`;
las líneas de refacción existentes quedan con `unit_price` igual al precio
vigente de su refacción (D-01/D-03); al iniciar sesión como `mecanico`, el
detalle de su orden muestra el selector de refacciones **con opciones y sin
ningún precio** (H-10); como `admin`, el catálogo muestra los dos precios con el
tope aplicado.

## Comandos de prueba

```powershell
cd server
npm.cmd test                  # Jest: unit + integración + contrato (contra motorix_test)

cd ../client
flutter analyze lib           # sin problemas
flutter test                  # formulario, detalle de orden, lookup y proveedores
```

> Las pruebas de integración NUNCA corren contra la base principal; solo contra
> `motorix_test` (Principio VII). La prueba de concurrencia usa `Promise.all`
> sobre la API real en local (H-09). Nombres y mensajes de aserción en español.

## Escenarios de validación

### V1. Migración 014 y backfill (CA-3, D-01/D-03, FR-003)

1. Ejecutar `aplicar-migraciones.ps1` → `schema_migrations` registra
   `014_order_parts_price`.
2. Consultar `order_parts` → toda fila previa tiene `unit_price` = `sale_price`
   de su refacción al momento de migrar; `price_correction_*` en NULL.
3. Volver a ejecutar el script → 0 aplicadas, sin errores (scripts inmutables).
4. **Resultado**: ninguna línea existente queda en 0.00 ni con precio ajeno.

### V2. Seeds idempotentes con orden cobrable (CA-12, FR-012, SC-007)

1. Correr `npm.cmd run seed` dos veces → la segunda **no crea registros**.
2. Verificar: una orden terminada **cobrable** con refacciones (precio
   guardado), una orden **abierta** con línea de refacción y un pago `PENDING`
   de Mercado Pago con importe distinto al total (para V8).
3. **Resultado**: la interfaz muestra el sprint completo con datos de ejemplo;
   0 duplicados.

### V3. Instantánea al agregar la refacción (CA-3, US1/US2, SC-001)

1. Como `admin`, crear una refacción con precio de venta `100.00`.
2. Como `mecanico`, en su orden: agregar 2 unidades con el selector (usa
   `GET /api/parts/lookup`).
3. Como `admin`, `GET /api/service-orders/{id}/parts` → la línea tiene
   `unitPrice: "100.00"`.
4. Cambiar el precio en el catálogo a `150.00` → **ni la línea ni el total
   cambian** (el total sigue con `200.00` de refacciones).
5. **Resultado**: 0 líneas alteradas por el cambio de catálogo (SC-001).

### V4. Total con precios guardados (CA-4, FR-004, D-02, SC-005)

1. `GET /api/service-orders/{id}/total` → `servicesSubtotal`,
   `laborSubtotal`, `partsSubtotal` (`Σ cantidad × unit_price`) y `total`, todos
   con 2 decimales exactos.
2. Orden sin trabajo registrado → total `"0.00"` y el cobro se rechaza con
   mensaje en español (`VALIDATION_ERROR`: «El total de la orden es 0.00…»).
3. Orden terminada **solo con refacciones** y total > 0 → sí es cobrable
   (default de D-02, P-10).
4. **Resultado**: la suma de subtotales cuadra con el total (diferencia 0.00).

### V5. Tope y validación de precios (CA-2, FR-002, D-07/D-08)

1. `POST /api/parts` con `salePrice: "100000.00"` → 400 `VALIDATION_ERROR`
   «…no puede superar los 99,999.99.»; lo mismo desde el formulario (mensaje en
   español, sin trazas).
2. `salePrice: "85.999"` (3 decimales) o negativo → 400 (regla ya existente).
3. Guardar `salePrice` menor que `purchasePrice` → **se guarda** y el formulario
   muestra una advertencia ámbar no bloqueante (D-07).
4. **Resultado**: ningún precio fuera de límite entra al sistema (capa zod) y la
   migración 014 lo refuerza con CHECK (datos).

### V6. Permisos y proyección por rol (CA-10, FR-010, D-10, SC-003)

1. Token `mecanico`: `GET /api/parts` → 403 `FORBIDDEN`; `GET /api/parts/lookup`
   → 200 **sin** `purchasePrice` ni `salePrice` en ningún elemento.
2. Token `mecanico`: `GET /api/service-orders/{id}/parts` → los elementos **sin**
   `unitPrice`.
3. Token `recepcion`: `GET /api/parts` → 403; en la orden sí recibe `unitPrice`
   (precio de venta) pero nunca `purchasePrice`.
4. Token `admin`: `GET /api/parts` → 200 con los dos precios; `POST/PATCH` con
   token de mecánico o recepción → 403.
5. **Resultado**: 0 precios de compra en respuestas de roles distintos de
   administrador, verificado en el backend (SC-003).

### V7. Corrección administrativa de la línea (CA-3, US4 esc. 4, D-05)

1. Como `admin`: `PATCH /api/service-orders/{id}/parts/{partRowId}/price` con
   `unitPrice` y `reason` (≥ 10 caracteres) → 200; la línea y el total cambian
   en la siguiente consulta; la fila conserva motivo, autor y fecha.
2. Sin `reason` o con motivo corto → 400 `VALIDATION_ERROR`.
3. Con token de recepción o mecánico → 403; fila inexistente o de otra orden →
   404 `ORDER_ITEM_NOT_FOUND`; orden `DELIVERED` → 400 `ORDER_DELIVERED`; orden
   con pago `PAID` → 400 `ORDER_ALREADY_PAID`.
4. **Resultado**: solo el administrador corrige, siempre con motivo registrado;
   el dinero cobrado y el historial entregado no se tocan.

### V8. Pago pendiente desfasado (CA-9, US3 esc. 3, D-04, FR-009)

1. Con el pago `PENDING` de ejemplo del seed (importe ≠ total), `recepcion`
   consulta `GET .../total` o `GET .../payments` → el pago aparece
   **`CANCELLED`** (efecto silencioso e idempotente: repetir la consulta no
   cambia nada).
2. Registrar el cobro nuevo → 201 con el importe **correcto** (el desfasado ya
   no bloquea: `PENDING_PAYMENT_EXISTS` solo aplica a pendientes que coinciden).
3. Si existe un pendiente **que coincide** con el total → 409
   `PENDING_PAYMENT_EXISTS` (comportamiento heredado intacto).
4. Pagos `PAID` previos → sin cambios (SC-002).
5. **Resultado**: el ciclo «desfase → cancelación → cobro nuevo» funciona de
   extremo a extremo.

### V9. Cobros simultáneos (CA-8, SC-004, H-09, FR-013)

1. `npm.cmd test` (backend) → la suite `payment-concurrency.test.js` lanza N
   `POST .../payments` en paralelo con `Promise.all` sobre la misma orden.
2. **Resultado**: en 100 % de los intentos queda **exactamente 1** pago `PAID`
   (y 1 `PENDING` en el caso Mercado Pago simulado); cero errores 500.

### V10. Compatibilidad y regresión (CA-6/CA-11, SC-002, SC-006, SC-008)

1. Generar un ticket, congelar su JSON, cambiar **todos** los precios del
   catálogo → el ticket y los pagos se reconsultan idénticos (0 diferencias).
2. Panel de control y listados de órdenes/pagos con el total nuevo → sin
   cambios (CA-11).
3. `npm.cmd test` completo → todas las suites de la línea base en verde;
   `flutter analyze lib` sin problemas; `flutter test` verde.
4. **Resultado**: ninguna prueba que estaba en verde en la línea base pasa de
   verde a rojo (SC-006).

## Recorrido manual de la interfaz (con capturas en `docs/evidencias/sprint-5/`)

1. `admin` → Refacciones: crear con los dos precios y tope; ver la advertencia
   ámbar de venta menor que compra.
2. `mecanico` → su orden: selector de refacciones con opciones, agregar 2 y
   ver la lista **sin precios**; al detalle, el admin ve precio por línea y el
   botón «Corregir precio» con motivo obligatorio.
3. `recepcion` → orden terminada: total con refacciones, cobro y ticket con
   cantidad, precio unitario e importe por refacción; cambiar un precio en el
   catálogo y volver al ticket → idéntico.
