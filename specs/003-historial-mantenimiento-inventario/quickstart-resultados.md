# Resultados del quickstart — Sprint 3

**Fecha**: 2026-10-14 · **Rama**: `003-historial-mantenimiento-inventario` · **Estado**: V1–V10 ejecutados

## Cómo se validó

- **V1 y V10.4**: comandos directos (migraciones y seeds contra la base principal
  `motorix` y contra la base desechable `motorix_test`, recreada vacía).
- **V2 a V9**: script de verificación contra la API real en
  `http://localhost:3000` con los usuarios `admin`, `recepcion` y `mecanico` y
  datos de prueba propios (sufijo único, kilometraje calculado desde el estado
  actual). **Resultado: 92 comprobaciones PASS, 0 FAIL.**
- **Interfaz**: los pasos de UI equivalentes están cubiertos por las 98 pruebas
  de widget (`vehicle_history_*`, `maintenance_*`, `parts_*`, `order_parts_test`),
  que consumen el mismo contrato que la API verificada.

> **Nota de V10.4**: el usuario dedicado `motorix_app` no tiene privilegio global
> `CREATE DATABASE`, así que la instalación desde cero se hizo sobre
> `motorix_test` (base desechable que las pruebas regeneran solas) en lugar de
> una base nueva `motorix_qs`. Se restauró el entorno corriendo las suites.

---

## V1. Esquema y seeds idempotentes (SC-009, CA-4, CA-8)

| Paso | Resultado |
|------|-----------|
| 1. `aplicar-migraciones.ps1` | PASS — `schema_migrations` registra `008_create_maintenance`, `009_create_parts`, `010_create_inventory_movements` y `011_create_order_parts` (11 en total) |
| 2. Segunda ejecución | PASS — 0 aplicadas, scripts inmutables sin cambios |
| 3. `npm run seed` ×2 | PASS — segunda corrida: 0 creados en las 8 secciones |
| 4. Estado de la base | PASS — 6 refacciones (AMO-003 bajo mínimo y FUS-004 agotado), 7 movimientos `IN` iniciales, 3 mantenimientos (1 Vencido, 1 Próximo, 1 Normal), 3 órdenes con 1 `FINISHED`, 1 uso de refacción; 0 duplicados |

## V2. Historial de un vehículo (CA-1, US1, US2, RN-10, SC-001)

| Paso | Resultado |
|------|-----------|
| 1–2. Historial como `mecanico` | PASS — la orden terminada aparece en `entries` con fecha, kilometraje, diagnóstico, servicios, mano de obra, **refacciones** (la fila de `order_parts` del seed), observaciones y recomendaciones; solo `FINISHED`/`DELIVERED` y en orden cronológico descendente |
| 3. Órdenes en curso y vacío | PASS — vehículo propio con una orden en curso creada para la prueba → `entries` vacío |
| 4. Permisos y 404 | PASS — `recepcion` → 403 `FORBIDDEN`; id inexistente → 404 `VEHICLE_NOT_FOUND` |
| 5. Sin tabla de historial | PASS — `information_schema` sin tablas `*history*`; los datos se calculan en consulta (RN-10) |

## V3. Registrar el próximo mantenimiento (CA-2, US3, RN-11, RN-12, SC-002)

| Paso | Resultado |
|------|-----------|
| 1–2. Alta como `mecanico` | PASS — 201 con `state` calculado por el backend (CA-2) sobre vehículo propio |
| 3. Sin fecha ni kilometraje | PASS — 400 `MAINTENANCE_TARGET_REQUIRED` |
| 4. Re-registrar para el mismo vehículo | PASS — 200 (reemplazo) y la lista sigue con 1 registro por vehículo, sin duplicados |

## V4. Mantenimientos próximos y vencidos (CA-3, US4, SC-003)

| Paso | Resultado |
|------|-----------|
| 1. Lista como `recepcion` | PASS — orden `OVERDUE → UPCOMING → NORMAL` con vehículo y cliente (CA-3) |
| 2. Los 3 estados en los datos de ejemplo | PASS — Vencido (ABC1234, 84,000 km objetivo vs 86,000 actuales), Próximo (DEF5678), Normal (GHI9012) |
| 3. Filtro por estado | PASS — `?state=OVERDUE` devuelve solo vencidos; `?state=XX` → 400 `VALIDATION_ERROR` |
| 4. `POST` como `recepcion` | PASS — 403 `FORBIDDEN` (solo consulta) |

## V5. Catálogo de refacciones y stock (CA-4, US5, US6, SC-004)

| Paso | Resultado |
|------|-----------|
| 1. Alta como `admin` | PASS — 201 y aparece en la lista |
| 2. Código repetido | PASS — 400 `PART_CODE_DUPLICATED` sin registro nuevo |
| 3. Contra MySQL local | PASS — el alta creó su movimiento `IN` inicial y el saldo de `GET /api/parts` coincide con la columna `stock_current` (CA-4) |
| 4. Edición | PASS — precios y stock mínimo → 200 y persisten al reconsultar |
| 5. `recepcion`/`mecanico` | PASS — 403 `FORBIDDEN` en `GET /api/parts` |

## V6. Refacciones en la orden con salida de inventario (CA-5, US7, RN-6, RN-7, SC-005)

| Paso | Resultado |
|------|-----------|
| 1. `mecanico` agrega una refacción | PASS — 201 con el `orderPart` registrado |
| 2. Stock y movimiento | PASS — el saldo bajó exactamente 1 unidad y `GET /api/parts/{id}/movements` muestra un `OUT` con el `orderId` de esa orden (CA-5, RN-7) |
| 3. `quantity` > stock | PASS — 400 `STOCK_INSUFFICIENT` y sin efecto: ni fila, ni movimiento, ni descuento (RN-8, CA-6) |
| 4. Orden ajena y entregada | PASS — orden de otro mecánico → 403 leer y escribir; orden `DELIVERED` → 400 `ORDER_DELIVERED` (RN-9) |
| 5. `recepcion`/`admin` | PASS — 403 en `POST .../parts` (solo el mecánico, Q5) |

## V7. Stock negativo rechazado y alertas de stock bajo (CA-6, CA-7, US8, RN-8, Q1, Q2, SC-006, SC-007)

| Paso | Resultado |
|------|-----------|
| 1. `ADJUSTMENT` negativo | PASS — 400 `STOCK_INSUFFICIENT` y el stock no cambió |
| 2. Ajuste válido | PASS — 201 (motivo ≥ 10) y el saldo cambió exactamente en la cantidad del ajuste; sin motivo → 400 `VALIDATION_ERROR` |
| 3. `OUT` manual | PASS — 400 `VALIDATION_ERROR` (salidas solo automáticas, Q2) |
| 4. Filtro «Stock bajo» | PASS — AMO-003 entra en `?low=true` (3 ≤ 4), un `IN` de 7 la saca de las alertas y un `ADJUSTMENT` de −7 la restaura a la demo |
| 5. Recuento | PASS — `?low=true` coincide con `lowStockCount` de la lista completa (SC-007); `?low=xx` → 400 `VALIDATION_ERROR` |

## V8. Permisos por rol en backend (RN-15, R-07, SC-008)

| Paso | Resultado |
|------|-----------|
| 1. `recepcion` → 403 | PASS — en `GET /vehicles/{id}/history`, `GET /parts`, `POST /parts`, `POST /parts/{id}/movements`, `POST /maintenances` |
| 2. `mecanico` → 403 | PASS — en `GET /parts`, `POST /parts`, `POST /parts/{id}/movements` y `GET .../parts` de una orden ajena |
| 3. `admin` → 403 | PASS — en `POST /api/service-orders/{id}/parts` (Q5) |
| 4. Sin token → 401 | PASS — `UNAUTHORIZED` en los 9 endpoints nuevos |
| 5. Resultado | PASS — 0 accesos no autorizados aceptados (SC-008) |

## V9. Flujo demostrable de extremo a extremo (SC-001, SC-002, SC-003)

| Paso | Resultado |
|------|-----------|
| 1. `mecanico`: historial → mantenimiento | PASS — el servicio terminado más reciente está a la vista y registra el próximo mantenimiento del vehículo |
| 2. Refacción a la orden en curso | PASS — 201 y el stock baja |
| 3. `admin` en Inventario | PASS — saldo menor y la refacción queda en «Stock bajo» al pasar su mínimo (CA-7) |
| 4. `recepcion` en Mantenimientos | PASS — ve el mantenimiento con su estado y el cliente para avisarlo (CA-3) |
| 5. Resultado | PASS — flujo completo en **38 ms** (< 5 min, SC-001) |

## V10. Interfaz, instalación repetible y pruebas (CA-8, SC-009, FR-018, FR-019)

| Paso | Resultado |
|------|-----------|
| 1. Pantallas nuevas | PASS — tokens del design system (ámbar `AppColors.warning` en Próximo y stock bajo, rojo `danger` en Vencido/Agotado, verde `success` en Normal/Disponible); estados vacío/cargando/error en español (`LoadingView`/`ErrorView`/`EmptyView` y estados inline en la tarjeta de refacciones); confirmación al salir de los formularios y al cambiar estado; sin valores de color o tipografía sueltos |
| 2. Flutter | PASS — `flutter analyze`: 0 issues; `flutter test`: **98/98** |
| 3. Backend | PASS — `npm run lint`: 0 hallazgos; `npm test`: **39 suites / 308 tests** (unit `maintenance-state` e `inventory-stock`, integración `vehicle-history`, `maintenances`, `parts-*`, `order-parts` y los 3 archivos de contrato del Sprint 3) — CA-8 |
| 4. Instalación desde cero | PASS — base desechable `motorix_test` recreada vacía → migraciones 001→011 (11 aplicadas) → `npm run seed` ×2: la primera crea todo (3 usuarios, 3 clientes, 3 vehículos, 4 citas, 3 órdenes, 6 refacciones, 3 mantenimientos, 1 uso), la segunda crea 0; 12 tablas y 11 migraciones registradas |
| 5. Resultado | PASS — el sprint queda demostrable con pruebas automatizadas en verde |
