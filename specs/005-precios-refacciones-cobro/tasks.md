---
description: "Lista de tareas del sprint 5: precios de refacciones y cobro completo"
---

# Tareas: Precios de refacciones y cobro completo (Sprint 5)

**Input**: Documentos de diseño en `/specs/005-precios-refacciones-cobro/`

**Prerrequisitos**: plan.md (obligatorio), spec.md (historias de usuario), research.md, data-model.md, contracts/, quickstart.md

**Pruebas**: se incluyen porque el propio spec las exige (**FR-013**: «DEBEN existir y pasar pruebas automatizadas de cálculo del total, guardado de precios, redondeo, permisos por rol, cobros simultáneos y compatibilidad…», y **SC-006** exige la regresión completa). Se escriben **antes** de la implementación de su historia y deben fallar primero.

**Organización**: las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Historia]**: historia de usuario a la que pertenece (US1, US2, US3, US4, US5)
- Ruta de archivo exacta en cada descripción

## Convenciones de ruta

- Monorepo de tres carpetas: `server/` (Node.js ES Modules), `client/` (Flutter) y `database/` (migraciones)
- Pruebas del backend en `server/tests/{unit,integration,contract}/`; pruebas de frontend en `client/test/`
- Todo texto visible al usuario y nombres de pruebas en español; identificadores de código en inglés

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: condiciones de entrada del sprint y punto de partida verificable

- [x] T001 Registrar la enmienda de la constitución antes de implementar (H-01): actualizar `.specify/memory/constitution.md` (alcance de 4 a 5 sprints en las líneas 36, 48 y 84, versión 1.0.0 → 1.1.0 y reporte de impacto en el encabezado) y marcar el criterio de entrada como cumplido en `docs/aseguramiento-calidad-sprint-5.md` (sección 2) — **ejecutada**: commit `ef56cc7`
- [x] T002 Crear e ingresar a la rama `005-precios-refacciones-cobro` desde `main` en la raíz del repositorio (sin squash ni force-push durante todo el sprint, según `Trabajo.md`) — **ejecutada**: rama creada el 2026-11-03
- [x] T003 [P] Verificar que la rama arranca con la línea base verde: `cd server && npm.cmd test`, y en `client/` `flutter test` y `flutter analyze lib`; anotar conteos y fecha en `docs/aseguramiento-calidad-sprint-5.md` (sección 8) — **ejecutada**: backend 49 suites/390 pruebas, frontend 120 pruebas y `flutter analyze` sin problemas (2026-11-03)

---

## Fase 2: Fundacional (bloqueante para todas las historias)

**Propósito**: esquema del sprint. **?? CRÍTICO**: ninguna historia puede comenzar hasta completar esta fase

- [x] T004 Crear la migración aditiva `database/migrations/014_order_parts_price.sql` con: columnas `unit_price DECIMAL(10,2) NOT NULL DEFAULT 0`, `price_correction_reason VARCHAR(200) NULL`, `price_corrected_by INT UNSIGNED NULL` y `price_corrected_at DATETIME NULL` en `order_parts`; backfill `UPDATE order_parts op JOIN parts p ON p.id = op.part_id SET op.unit_price = p.sale_price;` (D-01/D-03); CHECK `unit_price >= 0 AND unit_price <= 99999.99`; CHECK `purchase_price <= 99999.99` y `sale_price <= 99999.99` en `parts` (D-08); y FK `price_corrected_by → users(id)` con `ON DELETE RESTRICT ON UPDATE CASCADE` — **ejecutada**: commit `9b529f9`
- [x] T005 [P] Documentar la migración 014 en `database/README.md` (propósito, columnas nuevas, backfill del precio vigente y CHECK de tope) — **ejecutada**: commit `9b529f9`
- [x] T006 Aplicar las migraciones a la base principal y a `motorix_test` con `database/scripts/aplicar-migraciones.ps1` y verificar en `schema_migrations` el registro de `014_order_parts_price`, además de que ninguna línea de `order_parts` quedó con `unit_price = 0.00` — **ejecutada**: ambas bases al día; 9 líneas, 0 en cero y 0 desalineadas; los 3 CHECK presentes en `information_schema`

**Checkpoint**: fundación lista; las historias pueden empezar

---

## Fase 3: User Story 1 — Registrar categoría, marca y precios de una refacción (Prioridad: P1) ?? MVP

**Objetivo**: el catálogo acepta y conserva categoría, marca y los dos precios, con validación de límites (FR-001, FR-002)

**Prueba independiente**: registrar y editar una refacción con los dos precios, reconsultarla y confirmar que se rechazan precios negativos, de 3 decimales y mayores a $99,999.99, verificando también la advertencia de venta menor a compra

### Pruebas para US1 (primero, deben fallar)

- [x] T007 [P] [US1] Prueba de integración del tope de precios en `server/tests/integration/parts-catalog.test.js`: `salePrice "100000.00"` → 400 `VALIDATION_ERROR` con mensaje «…no puede superar los 99,999.99.», precio con 3 decimales → 400, y `salePrice < purchasePrice` → 201 (D-07: permitido, la advertencia es de interfaz) — **ejecutada**: red primero, verde después (el mensaje específico viaja en `error.details[]`)
- [x] T008 [P] [US1] Prueba de contrato del catálogo con tope en `server/tests/contract/inventory.contract.test.js` según `contracts/parts-catalog.md` (código `VALIDATION_ERROR` y mensaje en español) — **ejecutada**
- [x] T009 [P] [US1] Prueba de formulario con tope y advertencia en `client/test/parts_form_test.dart`: el tope se rechaza en cliente con mensaje en español y `salePrice < purchasePrice` muestra una advertencia ámbar **no bloqueante** — **ejecutada**: 7/7 pruebas del archivo

### Implementación de US1

- [x] T010 [US1] Agregar el tope `$99,999.99` (zod `.refine` sobre el valor numérico, mensaje en español) a `purchasePrice` y `salePrice` de create y patch en `server/validators/parts.js` — **ejecutada**: factor `precio(campo)` compartido
- [x] T011 [US1] Validar el tope en el formulario y mostrar la advertencia ámbar no bloqueante cuando `salePrice < purchasePrice` en `client/lib/screens/inventory/part_form_screen.dart` (solo espejo: la autoridad es el backend) — **ejecutada**: getter `_ventaMenorQueCompra` con `onChanged` en vivo
- [x] T012 [US1] Ejecutar las pruebas de US1 (`parts-catalog`, `inventory.contract` y `parts_form`) y confirmar que pasan sin tocar otros módulos — **ejecutada**: backend 19/19, frontend 7/7 y `flutter analyze` sin problemas

**Checkpoint**: US1 funcional y verificable de forma independiente

---

## Fase 4: User Story 2 — Total de la orden con refacciones (Prioridad: P2)

**Objetivo**: cada línea guarda su precio al agregarse y el total y el ticket lo usan (FR-003 primera parte, FR-004)

**Prueba independiente**: agregar refacciones, consultar el total (suma de los 3 conceptos con 2 decimales), cambiar el precio en el catálogo y confirmar que ni la línea ni el total cambian

### Pruebas para US2 (primero, deben fallar)

- [x] T013 [P] [US2] Prueba de integración de la instantánea y del total en `server/tests/integration/order-parts.test.js`: al agregar 2 unidades la línea responde `unitPrice` igual al precio vigente; cambiar `salePrice` en el catálogo no altera la línea ni `partsSubtotal`; toda línea existente tiene `unit_price` definido (mayor o igual a 0) tras la 014; orden sin trabajo → total `"0.00"` — **ejecutada**: red primero, verde después
- [x] T014 [P] [US2] Prueba de contrato de `order-parts` en `server/tests/contract/order-parts.contract.test.js` según `contracts/order-parts.md` (campo `unitPrice` como cadena con exactamente 2 decimales en POST y GET con token de administrador) — **ejecutada**
- [x] T015 [P] [US2] Prueba unitaria de redondeo con refacciones en `server/tests/unit/order-total.test.js`: cantidades enteras por precios con 2 decimales se suman en centavos exactos y el total sale con 2 decimales (SC-005) — **ejecutada**

### Implementación de US2

- [x] T016 [US2] Guardar la instantánea en el alta: leer `sale_price` en la misma conexión en `server/services/inventory.service.js` (`agregarRefaccionOrden`) y persistirlo en `server/models/order_part.model.js` (`CAMPOS` con `op.unit_price AS unitPrice`, `aOrderPart` y `crear()` con `unit_price`) — **ejecutada**
- [x] T017 [US2] Cambiar la fuente del total en `server/services/order-total.service.js`: la consulta de refacciones pasa de `p.sale_price AS salePrice` a `op.unit_price AS salePrice` (fórmula y `sumarTotales()` sin cambios) — **ejecutada**
- [x] T018 [US2] Ejecutar las pruebas de US2 (order-parts, order-total, order-parts.contract) y confirmar que la línea base de `order-total` sigue verde sin cambios de interfaz — **ejecutada**: 23/23 en las 3 suites y 89/89 en pagos, tickets, órdenes y dashboard

**Checkpoint**: US2 funcional; el total ya no depende del precio vigente del catálogo

---

## Fase 5: User Story 3 — Pago y ticket con el nuevo total (Prioridad: P3)

**Objetivo**: el cobro usa el total con refacciones, el ticket lo detalla con precio guardado y el pago pendiente desfasado se cancela (FR-005, FR-007, FR-008, FR-009, D-04)

**Prueba independiente**: registrar el pago por el total con refacciones, generar el ticket y verificar que lista cantidad, precio unitario e importe; con un pago pendiente de importe distinto, consultarlo para verlo cancelado y crear el cobro nuevo

### Pruebas para US3 (primero, deben fallar)

- [x] T019 [P] [US3] Prueba de integración del pago por total con refacciones en `server/tests/integration/payments.test.js`: pago igual al total → crea; importe distinto → 400 `PAYMENT_AMOUNT_MISMATCH`; orden terminada solo con refacciones y total mayor a 0.00 → cobrable (default de D-02) — **ejecutada**: el caso D-02 es nuevo (los otros dos ya existían)
- [x] T020 [P] [US3] Prueba de cancelación por desfase en `server/tests/integration/payments.test.js`: un `PENDING` con importe ≠ total pasa a `CANCELLED` al consultar `GET /api/service-orders/{id}/total` y `GET /api/service-orders/{id}/payments` (idempotente: repetir no cambia nada) y el cobro nuevo procede; un pendiente **que coincide** sigue respondiendo 409 `PENDING_PAYMENT_EXISTS`; los pagos `PAID` no cambian — **ejecutada**: red primero, verde después
- [x] T021 [P] [US3] Prueba de cobros simultáneos (H-09, CA-8) en `server/tests/integration/payment-concurrency.test.js`: N `POST .../payments` con `Promise.all` sobre la misma orden → exactamente 1 pago `PAID` en 100 % de los intentos y 1 `PENDING` con el cliente de Mercado Pago simulado, sin errores 500 — **ejecutada**: las 2 pruebas pasan (el bloqueo `FOR UPDATE` ya garantizaba la serialización; quedan como salvaguarda)
- [x] T022 [P] [US3] Prueba de ticket con precio guardado en `server/tests/integration/tickets.test.js`: el ticket lista cada refacción con cantidad, `unitPrice` e importe, y vuelve idéntico tras cambiar todos los precios del catálogo (SC-002, CA-6) — **ejecutada**: red primero (mostraba el precio nuevo del catálogo), verde después
- [x] T023 [P] [US3] Prueba de contrato de pagos en `server/tests/contract/payments.contract.test.js` según `contracts/payments.md`: forma de respuestas intacta y efecto documentado de cancelación del desfase — **ejecutada**

### Implementación de US3

- [x] T024 [US3] Implementar `cancelarPendienteDesfasado(orderId, total, conexion = pool)` en `server/services/payments.service.js` con una sola sentencia atómica e idempotente: `UPDATE payments SET status = 'CANCELLED' WHERE order_id = ? AND status = 'PENDING' AND amount <> ?` (la máquina R-04 ya permite `PENDING → CANCELLED`) — **ejecutada**
- [x] T025 [US3] Invocar el helper en `GET .../id/total` y `GET .../id/payments` (`server/controllers/payments.controller.js`) y dentro de `registrarPago` **antes** de VN-04/VN-05 (`server/services/payments.service.js`), de modo que `PENDING_PAYMENT_EXISTS` solo bloquee pendientes que sí coinciden con el total — **ejecutada** (el efecto ya estaba documentado en `contracts/payments.md`, sin cambios)
- [x] T026 [US3] Cambiar la fuente del ticket en `server/services/tickets.service.js` (`seccionesDeTrabajo()`): `p.sale_price` → `op.unit_price AS salePrice` — **ejecutada**
- [x] T027 [US3] Ejecutar las pruebas de US3 (payments, payment-concurrency, tickets, payments.contract) — **ejecutada**: 65/65 en las 6 suites backend
- [x] T028 [P] [US3] Verificar la interfaz del ticket en `client/test/ticket_screen_test.dart` y, solo si falta, completar `client/lib/screens/tickets/ticket_screen.dart` para mostrar cantidad, precio unitario e importe con 2 decimales por refacción — **ejecutada**: la pantalla ya lo mostraba; se agregó la prueba que lo fija (3/3)

**Checkpoint**: US3 funcional; ciclo total → pago → ticket completo con precio guardado

---

## Fase 6: User Story 4 — Integridad de pagos y tickets ya emitidos (Prioridad: P4)

**Objetivo**: nada emitido cambia con los precios del catálogo y la captura errónea se corrige con motivo (FR-003 segunda parte, FR-006, D-05)

**Prueba independiente**: con una orden abierta con refacciones, un pago y un ticket emitidos, cambiar todos los precios del catálogo y verificar 0 diferencias; luego corregir una línea como administrador y ver la línea, el total y el motivo registrado

### Pruebas para US4 (primero, deben fallar)

- [ ] T029 [P] [US4] Prueba de compatibilidad del historial en `server/tests/integration/historical-compat.test.js`: congelar el JSON de los pagos y del ticket de una orden, cambiar todos los precios del catálogo y comparar → 0 diferencias de importe o contenido (SC-002, CA-6)
- [ ] T030 [P] [US4] Prueba de integración de la corrección de precio en `server/tests/integration/order-parts.test.js`: admin con `unitPrice` y `reason` → 200 con `priceCorrection*` y total recalculado; `reason` con menos de 10 caracteres → 400; token de recepción o mecánico → 403; fila de otra orden → 404 `ORDER_ITEM_NOT_FOUND`; orden `DELIVERED` → 400 `ORDER_DELIVERED`; orden con pago `PAID` → 400 `ORDER_ALREADY_PAID`

### Implementación de US4

- [ ] T031 [US4] Crear `orderPartPricePatchSchema` en `server/validators/service_orders.js`: `unitPrice` con el formato de precio existente (`^\d+(\.\d{1,2})?$`) y tope `$99,999.99`; `reason` obligatorio de **10 a 200 caracteres** con mensaje en español (D-05, D-08)
- [ ] T032 [US4] Implementar `corregirPrecioRefaccionOrden(idOrden, partRowId, payload, usuario)` en `server/services/inventory.service.js`: guarda de fila perteneciente a la orden, orden no `DELIVERED` y sin pago `PAID`; `UPDATE` de `unit_price`, `price_correction_reason`, `price_corrected_by` y `price_corrected_at` en transacción (única mutación admitida sobre `order_parts`, R-06 sigue sin DELETE)
- [ ] T033 [US4] Exponer `PATCH /api/service-orders/:id/parts/:partRowId/price` en `server/routes/service_orders.routes.js` (`authenticate`, `authorize("ADMIN")`, `validate(orderPartPricePatchSchema)`) con su controlador en `server/controllers/service_orders.controller.js`
- [ ] T034 [P] [US4] Prueba de contrato de la corrección en `server/tests/contract/order-parts.contract.test.js` según `contracts/order-parts.md` (respuesta con campos `priceCorrection*` y los códigos reutilizados)
- [ ] T035 [US4] Ampliar `client/lib/models/order_part.dart` (`unitPrice` y `priceCorrection*` como campos **nulos**) y `client/lib/providers/service_orders_provider.dart` (`corregirPrecioRefaccionOrden`)
- [ ] T036 [US4] Interfaz de la corrección en `client/lib/screens/orders/order_detail_screen.dart`: precio de línea visible para los roles que lo reciben y acción «Corregir precio» solo para ADMIN con diálogo de motivo obligatorio, confirmación y mensajes en español (tokens de `docs/design-system.md`)
- [ ] T037 [P] [US4] Prueba de interfaz de la corrección en `client/test/order_detail_test.dart`: el administrador ve el precio de línea y el diálogo; un motivo corto se rechaza; la corrección se cierra con éxito

**Checkpoint**: US4 funcional; el historial emitido es inmutable y la corrección queda auditada

---

## Fase 7: User Story 5 — Mecánico sin precios de compra (Prioridad: P5)

**Objetivo**: el mecánico agrega refacciones sin recibir ningún precio en ninguna consulta; el precio de compra solo lo ve el administrador (FR-010, D-10, H-10)

**Prueba independiente**: sesión de mecánico agregando refacciones con el selector lleno y verificando que ninguna respuesta trae `purchasePrice`, `salePrice` ni `unitPrice`; sesión de administrador que sí los recibe

### Pruebas para US5 (primero, deben fallar)

- [ ] T038 [P] [US5] Prueba de integración del lookup y la proyección en `server/tests/integration/parts-catalog.test.js`: mecánico `GET /api/parts` → 403 (sin cambios, SC-008); `GET /api/parts/lookup` → 200 **sin** `purchasePrice` ni `salePrice` en ningún elemento; recepción → 403 en ambas rutas; `GET .../service-orders/{id}/parts` con token de mecánico → elementos **sin** `unitPrice` (SC-003)
- [ ] T039 [P] [US5] Prueba de contrato del lookup en `server/tests/contract/inventory.contract.test.js` según `contracts/parts-catalog.md` (shape `parts[]` con los 7 campos sin precios)

### Implementación de US5

- [ ] T040 [US5] Crear `GET /api/parts/lookup` en `server/routes/parts.routes.js` (`authenticate`, `authorize("MECHANIC")`), `server/controllers/parts.controller.js` (`listLookup`) y `server/services/inventory.service.js` (`listarLookup` con los mismos filtros que el catálogo), con la proyección sin precios en `server/models/part.model.js`
- [ ] T041 [US5] Proyección por rol en la lista de refacciones de la orden: omitir `unitPrice` cuando el rol es `MECHANIC` en `server/services/inventory.service.js` / `server/models/order_part.model.js` (FR-010)
- [ ] T042 [US5] Selector del mecánico en `client/lib/providers/parts_provider.dart` (`cargarLookup()` que usa `/parts/lookup` sin precios) y `client/lib/screens/orders/order_detail_screen.dart` (el diálogo «agregar refacción» usa el lookup; cierra H-10)
- [ ] T043 [P] [US5] Prueba de interfaz del selector en `client/test/order_detail_test.dart`: con sesión de mecánico el selector trae opciones y no muestra ningún precio
- [ ] T044 [US5] Ejecutar las pruebas de US5 (parts-catalog, inventory.contract, order_detail) y revisar que `parts-catalog.test.js` de la línea base sigue verde (los 403 de `GET /api/parts` intactos)

**Checkpoint**: las 5 historias funcionan de forma independiente

---

## Fase 8: Pulido y preocupaciones transversales

**Propósito**: datos de ejemplo, documentación, regresión y entregables del sprint

- [ ] T045 [P] Ampliar los seeds idempotentes en `server/scripts/seed.js`: garantizar una orden cobrable con refacciones, agregar una orden abierta con línea de refacción con precio y un pago `PENDING` de Mercado Pago con importe distinto al total, todo con marcadores propios para no duplicar (FR-012, CA-12)
- [ ] T046 [P] Verificar los seeds ejecutándolos dos veces (`cd server && npm.cmd run seed`): la segunda pasada no crea registros y la orden cobrable con refacciones existe (SC-007)
- [ ] T047 [P] Actualizar `docs/project-context.md`: eliminar el campo `active` inexistente de la entidad Part (H-08) y documentar las reglas nuevas (precio guardado en la línea, lookup del mecánico, corrección con motivo, tope de precio); revisar `docs/design-system.md` solo si cambia un token (FR-014, CA-14)
- [ ] T048 [P] Verificar el panel y los listados con el total nuevo: suites `server/tests/integration/dashboard.test.js`, `service-orders.test.js` y `payments.test.js` en verde (FR-011, CA-11)
- [ ] T049 Regresión completa del backend: `cd server && npm.cmd test` con todas las suites de la línea base en verde más la nueva de concurrencia (SC-006, CA-8)
- [ ] T050 Regresión completa del frontend: `cd client && flutter analyze lib` sin problemas y `flutter test` en verde (SC-006)
- [ ] T051 Recorrido manual de extremo a extremo y capturas en `docs/evidencias/sprint-5/` (minúsculas y guiones) siguiendo `specs/005-precios-refacciones-cobro/quickstart.md` (V1 a V10, SC-008)
- [ ] T052 Completar `docs/aseguramiento-calidad-sprint-5.md`: trazabilidad CA con tareas y pruebas, estados de hallazgos y riesgos, regresión con conteos, control de calidad final y anexo de evidencias E-01 a E-06

---

## Dependencias y orden de ejecución

### Dependencias por fase

- **Fase 1 (Preparación)**: sin dependencias; la enmienda (T001) es **criterio de entrada** y debe completarse antes de cualquier cambio de código
- **Fase 2 (Fundacional)**: depende de la Fase 1 y **bloquea todas las historias**
- **Fase 3+ (Historias)**: todas dependen de la Fase 2; después pueden ir en paralelo o en orden de prioridad (US1 → US2 → US3 → US4 → US5)
- **Fase 8 (Pulido)**: depende de las historias que se vayan entregando; la regresión final (T049, T050) requiere todas las historias terminadas

### Dependencias entre historias

- **US1 (P1)**: sin dependencias de otras historias una vez fundada la fase 2
- **US2 (P2)**: sin dependencias de otras historias; US3 y US4 se apoyan en su instantánea
- **US3 (P3)**: funcional sin US4/US5; usa la instantánea de US2
- **US4 (P4)**: se prueba sobre el flujo de US2 y US3 (historia 1 sin ella ya funciona)
- **US5 (P5)**: sin dependencias del resto del sprint

### Dentro de cada historia

- Las pruebas se escriben primero y deben **fallar** antes de la implementación
- Modelo/servicio antes que rutas; lógica antes que interfaz
- Terminar y verificar cada historia antes de pasar a la siguiente prioridad

### Oportunidades de paralelismo

- T003, T005, T007, T008, T009, T013, T014, T015, T019, T020, T021, T022, T023, T029, T030, T034, T037, T038, T039, T043, T045, T046, T047, T048 y T028 pueden correr en paralelo entre sí (archivos distintos)
- Una vez la fase 2 lista, US1 y US2 pueden avanzar en paralelo; US5 puede avanzar en paralelo con US3/US4

---

## Ejemplo paralelo: User Story 3

```text
Tarea: "Prueba de integración del pago por total con refacciones en server/tests/integration/payments.test.js"
Tarea: "Prueba de cobros simultáneos en server/tests/integration/payment-concurrency.test.js"
Tarea: "Prueba de ticket con precio guardado en server/tests/integration/tickets.test.js"
Tarea: "Prueba de contrato de pagos en server/tests/contract/payments.contract.test.js"
# Lanzadas juntas (archivos distintos) antes de implementar
```

---

## Estrategia de implementación

### MVP primero (solo US1)

1. Completar Fase 1: preparación (enmienda H-01 + rama)
2. Completar Fase 2: fundacional (migración 014)
3. Completar Fase 3: US1
4. **PARAR y VALIDAR**: probar US1 de forma independiente
5. Demostrable con el catálogo solo

### Entrega incremental

1. Preparación + Fundacional → base lista
2. US1 → probar por sí sola → demo del catálogo con tope
3. US2 → probar por sí sola → demo del total con precio guardado
4. US3 → probar por sí sola → demo de cobro y ticket
5. US4 → probar por sí sola → demo de integridad y corrección
6. US5 → probar por sí sola → demo del mecánico sin precios
7. Pulido → regresión completa y cierre del documento de calidad

---

## Notas

- `[P]` = archivos distintos sin dependencias; `[Historia]` rastrea la tarea a su historia
- Cada historia debe ser completar y comprobar de forma independiente
- Verificar que las pruebas **fallan** antes de implementar
- Commitear después de cada tarea o grupo lógico (mensajes en Conventional Commits, sin línea de coautor)
- Parar en cada checkpoint para validar la historia
- Evitar: tareas vagas, conflictos de archivo dentro de una historia y dependencias que rompan la independencia
- Los códigos de error se **reutilizan** (`VALIDATION_ERROR`, `FORBIDDEN`, `ORDER_ITEM_NOT_FOUND`, `ORDER_DELIVERED`, `ORDER_ALREADY_PAID`, `PAYMENT_AMOUNT_MISMATCH`, `PENDING_PAYMENT_EXISTS`): no se agrega ninguno nuevo
