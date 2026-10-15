---
description: "Lista de tareas del Sprint 3: historial, mantenimiento e inventario"
---

# Tasks: Historial, mantenimiento e inventario (Sprint 3)

**Input**: Documentos de diseño en `/specs/003-historial-mantenimiento-inventario/`

**Prerequisites**: plan.md (requerido), spec.md (historias con prioridades), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Solicitados explícitamente por el spec (SC-006 «las pruebas automatizadas de lógica de inventario y mantenimiento existen y pasan», CA-8) y exigidos por la constitución (Principio VII). Se incluyen pruebas unitarias, de integración, de contrato y de Flutter.

**Organization**: Las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: Historia a la que pertenece la tarea (US1, US2, …)
- Cada tarea indica la ruta exacta del archivo

## Convenciones de rutas

- Backend: `server/` (capas directas, sin `src/`), pruebas en `server/tests/{unit,integration,contract}`
- Frontend: `client/lib/` (models, providers, services, screens, widgets, utils), pruebas en `client/test/`
- Base de datos: `database/migrations/` (SQL numerado e inmutable)
- Contratos del feature: `specs/003-historial-mantenimiento-inventario/contracts/`

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: Línea base verificada y utilidades de error compartidas por todo el sprint

- [X] T001 Verificar la línea base verde del Sprint 2 antes de tocar código: `npm test` y `npm run lint` en `server/`, y `flutter analyze` y `flutter test` en `client/` (deben pasar las 215 pruebas de backend y las 61 de frontend)
- [X] T002 [P] Extender `server/utils/errors.js` con fábricas de los códigos nuevos del sprint, con mensajes en español: `PART_NOT_FOUND`, `PART_REQUIRED`, `PART_CODE_DUPLICATED`, `STOCK_INSUFFICIENT` y `MAINTENANCE_TARGET_REQUIRED` (`ORDER_DELIVERED` y `VALIDATION_ERROR` ya existen; tabla de códigos en `specs/003-historial-mantenimiento-inventario/contracts/README.md`)

---

## Fase 2: Fundacional (prerrequisitos bloqueantes)

**Propósito**: Esquema del Sprint 3 (tablas `maintenance`, `parts`, `inventory_movements`, `order_parts`); bloquea a TODAS las historias de usuario

**⚠ CRITICAL**: Ninguna historia puede comenzar hasta completar esta fase

- [X] T003 [P] Crear `database/migrations/008_create_maintenance.sql` con la tabla `maintenance` según `specs/003-historial-mantenimiento-inventario/data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `vehicle_id` INT UNSIGNED NOT NULL **UNIQUE** FK → `vehicles.id` RESTRICT (un registro vigente por vehículo, R-03); `next_due_date` DATE NULL; `next_due_mileage` INT UNSIGNED NULL; `warn_days` INT UNSIGNED NOT NULL DEFAULT 30; `warn_km` INT UNSIGNED NOT NULL DEFAULT 500; `recommendations` VARCHAR(1000) NULL; `registered_by` INT UNSIGNED NOT NULL FK → `users.id` RESTRICT; `created_at`/`updated_at` DATETIME; **CHECK** `next_due_date IS NOT NULL OR next_due_mileage IS NOT NULL` (RN-11, al menos un objetivo); índice en `next_due_date`; **sin columna de estado** (se calcula en cada lectura, VM-06/R-04); InnoDB `utf8mb4`
- [X] T004 [P] Crear `database/migrations/009_create_parts.sql` con la tabla `parts` según `data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `part_code` VARCHAR(50) NOT NULL UNIQUE (`uq_parts_part_code`); `name` VARCHAR(100) NOT NULL; `category` VARCHAR(50) NOT NULL; `brand` VARCHAR(50) NULL; `stock_current` INT NOT NULL DEFAULT 0 con CHECK `>= 0` (RN-8); `stock_min` INT UNSIGNED NOT NULL; `purchase_price`/`sale_price` DECIMAL(10,2) NOT NULL DEFAULT 0 con CHECK `>= 0`; `created_at`/`updated_at`; **sin borrado** (sin `DELETE` ni columna lógica); InnoDB `utf8mb4`
- [X] T005 [P] Crear `database/migrations/010_create_inventory_movements.sql` con la tabla `inventory_movements` según `data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `part_id` INT UNSIGNED NOT NULL FK → `parts.id` RESTRICT; `movement_type` ENUM('IN','OUT','ADJUSTMENT') NOT NULL; `quantity` INT NOT NULL (mayor que 0 en `IN`/`OUT`; delta firmado ≠ 0 en `ADJUSTMENT`); `order_id` INT UNSIGNED NULL FK → `service_orders.id` RESTRICT (solo en `OUT` por uso en orden, RN-6); `reason` VARCHAR(200) NULL (obligatorio ≥ 10 en `ADJUSTMENT`); `created_by` INT UNSIGNED NOT NULL FK → `users.id` RESTRICT; `created_at`; índices en `part_id`, `(part_id, created_at)` y `order_id`; libro de auditoría sin borrado (FR-015); InnoDB `utf8mb4`
- [X] T006 [P] Crear `database/migrations/011_create_order_parts.sql` con la tabla `order_parts` según `data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `order_id` INT UNSIGNED NOT NULL FK → `service_orders.id` RESTRICT; `part_id` INT UNSIGNED NOT NULL FK → `parts.id` RESTRICT; `quantity` INT UNSIGNED NOT NULL con CHECK `> 0` (VO-02); `created_by` INT UNSIGNED NOT NULL FK → `users.id` RESTRICT (mecánico, Q5); `created_at`; índices en `order_id` y `part_id`; **sin UNIQUE** (filas múltiples por orden, cada agregado es un evento con su propia `OUT`, R-06) y **sin `DELETE`**; InnoDB `utf8mb4`
- [X] T007 Ejecutar `database/scripts/aplicar-migraciones.ps1` y comprobar en `schema_migrations` los registros `008_create_maintenance`, `009_create_parts`, `010_create_inventory_movements` y `011_create_order_parts`; volver a ejecutarlo para confirmar que es idempotente (0 aplicadas la segunda vez)

**Checkpoint**: Esquema listo; las historias de usuario pueden empezar

---

## Fase 3: Historia de usuario 1 - Historial de servicios del vehículo (Prioridad: P1) 🎯 MVP

**Objetivo**: El mecánico consulta el historial de un vehículo: solo órdenes `FINISHED`/`DELIVERED` en orden cronológico descendente, con fecha, kilometraje, diagnóstico, servicios, mano de obra, refacciones, observaciones y recomendaciones, calculado en consulta sin tablas derivadas

**Prueba independiente**: Con órdenes en distintos estados para un vehículo, abrir Historial y ver únicamente las terminadas/entregadas en orden cronológico, sin duplicados y con su kilometraje (CA-1, SC-001)

### Pruebas de la historia de usuario 1

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T008 [P] [US1] Prueba de integración en `server/tests/integration/vehicle-history.test.js` contra `motorix_test`: `GET /api/vehicles/{id}/history` → 200 con `vehicle` (`label`, `clientName`, `currentMileage`) y `entries[]` solo de órdenes `FINISHED`/`DELIVERED` en orden cronológico **descendente**, con `entryMileage`, `diagnosis`, `services`, `labor`, `parts`, `observations`, `recommendations` y `mechanicName` (FR-001); excluye `RECEIVED`, `DIAGNOSIS`, `IN_REPAIR`, `WAITING_PART` y `CANCELLED` (caso límite); 0 duplicados frente a las órdenes originales y las órdenes de origen sin modificar (SC-001, FR-017); vehículo inexistente → 404 `VEHICLE_NOT_FOUND`; RECEPTIONIST → 403 `FORBIDDEN` (RN-15), pruebas que deben fallar al inicio
- [X] T009 [P] [US1] Prueba de contrato en `server/tests/contract/vehicle-history.contract.test.js` contra `specs/003-historial-mantenimiento-inventario/contracts/vehicle-history.md`: `{ok,data}` con `vehicle` y `entries[]`, campos completos de cada entrada, `entries` vacío sin servicios terminados, 404 y 403 según contrato, pruebas que deben fallar al inicio
- [X] T010 [P] [US1] Prueba de widget en `client/test/vehicle_history_test.dart`: la entrada **Historial** es visible para ADMIN y MECHANIC y no aparece para RECEPTIONIST, y cada tarjeta muestra fecha, kilometraje y diagnóstico del servicio (CA-1, FR-003, FR-018), pruebas que deben fallar al inicio

### Implementación de la historia de usuario 1

- [X] T011 [P] [US1] Crear `server/models/history.model.js` con la consulta que une `service_orders` con `vehicles` y `clients`, filtra `status IN ('FINISHED','DELIVERED')` y agrupa los ítems de `order_services`, `order_labor` y `order_parts` por orden (cálculo en cada consulta, FR-002/RN-10: sin tabla ni vista derivada)
- [X] T012 [US1] Crear `server/services/history.service.js` que devuelve 404 `VEHICLE_NOT_FOUND` si el vehículo no existe, aplica la matriz de permisos R-07 (solo ADMIN y MECHANIC) y arma `vehicle` + `entries[]` con los totales de servicios, mano de obra y refacciones (depende de T011)
- [X] T013 [US1] Crear `server/controllers/history.controller.js` con `getVehicleHistory` (depende de T012)
- [X] T014 [US1] Crear `server/routes/history.routes.js` con `GET /api/vehicles/:vehicleId/history` (`authenticate` + `authorize(["ADMIN","MECHANIC"])`) y registrarlo en `server/routes/index.js`
- [X] T015 [P] [US1] Crear `client/lib/models/history_entry.dart` con `fromJson` y las etiquetas de estado en español (Entregado, Terminado)
- [X] T016 [US1] Ampliar `client/lib/services/api_client.dart` con el método `obtenerHistorialVehiculo(vehicleId)` según `contracts/vehicle-history.md` (implementado como llamada directa `api.get('/vehicles/{id}/history')` dentro del provider de US1: patrón del proyecto — `ApiClient` expone solo métodos HTTP genéricos)
- [X] T017 [US1] Crear `client/lib/providers/vehicle_history_provider.dart` con selector de vehículo, carga del historial y estados vacío/cargando/error (depende de T015, T016)
- [X] T018 [US1] Crear `client/lib/screens/history/vehicle_history_screen.dart` con selector de vehículo, tarjetas por servicio (fecha, kilometraje, diagnóstico, servicios, mano de obra, refacciones, observaciones y recomendaciones) y estados con `states_view.dart` (tokens de `docs/design-system.md`)
- [X] T019 [US1] Registrar la ruta en `client/lib/utils/app_route.dart`, agregar la entrada **Historial** en `client/lib/widgets/app_shell.dart` visible solo para ADMIN y MECHANIC, y registrar el provider en `client/lib/main.dart` (el registro de secciones vive en `app_shell.dart`: la navegación es por índices del rail y `app_route.dart` solo define la transición `AppRoute`, sin catálogo de rutas)

**Checkpoint**: Historia de usuario 1 completa y verificable por sí sola (CA-1)

---

## Fase 4: Historia de usuario 2 - Registrar el kilometraje de cada servicio (Prioridad: P2)

**Objetivo**: El kilometraje de cada servicio queda registrado y se conserva: el historial muestra el kilometraje de cada orden, y el registro de mantenimiento captura el kilometraje objetivo con su cálculo de estado en el backend

**Prueba independiente**: `POST /api/maintenances` guarda el kilometraje objetivo junto con la fecha; un kilometraje negativo, un registro sin objetivo o un rol sin permiso se rechazan; `GET /api/maintenances` devuelve el kilometraje y el estado calculado (FR-003, FR-004, CA-2)

### Pruebas de la historia de usuario 2

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T020 [P] [US2] Prueba unitaria del cálculo de estado en `server/tests/unit/maintenance-state.test.js`: dentro de la antelación → `UPCOMING`; fecha objetivo ya pasada o `current_mileage` alcanzando el kilometraje objetivo → `OVERDUE`; con ambos objetivos, vencido al cumplirse cualquiera de los dos; el resto → `NORMAL`; antelación con `warn_days`/`warn_km` del propio registro (defecto 30 y 500); `daysRemaining` y `mileageRemaining` negativos cuando ya venció (FR-007, RN-11, RN-12, Q4); nombres de pruebas y mensajes en español, prueba que debe fallar al inicio
- [X] T021 [P] [US2] Prueba de integración en `server/tests/integration/maintenances.test.js` contra `motorix_test`: alta 201; segundo POST del mismo vehículo → 200 con la fila reemplazada sin duplicados (UNIQUE `vehicle_id`); sin `vehicleId` → 400 `VEHICLE_REQUIRED`; vehículo inexistente → 404 `VEHICLE_NOT_FOUND`; sin `nextDueDate` ni `nextDueMileage` → 400 `MAINTENANCE_TARGET_REQUIRED`; `nextDueMileage` negativo o fecha con otro formato → 400 `VALIDATION_ERROR`; `state` en el cuerpo → 400 (VM-06); RECEPTIONIST → 403 y ADMIN/MECHANIC → 201 (RN-15, R-07); `GET /api/maintenances` devuelve `maintenances` con el kilometraje guardado y `state`/`daysRemaining`/`mileageRemaining` calculados, pruebas que deben fallar al inicio
- [X] T022 [P] [US2] Prueba de contrato en `server/tests/contract/maintenances.contract.test.js` contra `specs/003-historial-mantenimiento-inventario/contracts/maintenances.md`: `{ok,data}` con `maintenances` y `total`, sin campos de estado admitidos en el cuerpo (VM-06), códigos `MAINTENANCE_TARGET_REQUIRED`/`VALIDATION_ERROR`/`FORBIDDEN`, 201 en alta y 200 en reemplazo, pruebas que deben fallar al inicio

### Implementación de la historia de usuario 2

- [X] T023 [P] [US2] Crear `server/validators/maintenances.js` con zod y mensajes en español: `vehicleId` obligatorio entero (VM-01); al menos un objetivo `nextDueDate`/`nextDueMileage` (VM-02, RN-11); `nextDueDate` estricto `YYYY-MM-DD` y `nextDueMileage` entero ≥ 0 (VM-03); `warnDays` y `warnKm` enteros ≥ 0 con defecto 30 y 500 (VM-04); `recommendations` opcional ≤ 1000 caracteres (VM-05); `state`, `daysRemaining` y `mileageRemaining` no admitidos en el cuerpo (VM-06)
- [X] T024 [P] [US2] Crear `server/models/maintenance.model.js` con `buscarPorVehiculo`, `upsert` (inserta o reemplaza sobre la clave única `vehicle_id`), `listar` con filtros y `contarPorEstado`; sin columna de estado persistida (VM-06) y sin borrado
- [X] T025 [US2] Crear `server/services/maintenances.service.js` que guarda en transacción (inserta o actualiza la fila única, registrando `registered_by`), calcula `NORMAL`/`UPCOMING`/`OVERDUE` con el algoritmo exportado de T020 y arma la respuesta con `vehicleLabel`, `clientName`, `daysRemaining` y `mileageRemaining` (depende de T023, T024)
- [X] T026 [US2] Crear `server/controllers/maintenances.controller.js` con `listMaintenances` y `upsertMaintenance` según `contracts/maintenances.md` (depende de T025)
- [X] T027 [US2] Crear `server/routes/maintenances.routes.js` con `GET /api/maintenances` (ADMIN, RECEPTIONIST y MECHANIC) y `POST /api/maintenances` (solo ADMIN y MECHANIC) con `authenticate` + `authorize` + `validate`, y registrarlo en `server/routes/index.js`

**Checkpoint**: Historia de usuario 2 completa: el kilometraje de cada servicio se registra en el backend y se conserva en el historial (FR-003); los datos inválidos se rechazan con mensaje en español (CA-2)

---

## Fase 5: Historia de usuario 3 - Establecer el próximo mantenimiento (Prioridad: P3)

**Objetivo**: El mecánico registra desde el móvil el próximo mantenimiento por fecha, kilometraje o ambos, con antelación configurable por registro y recomendaciones

**Prueba independiente**: Desde el formulario de Mantenimientos crear un registro con fecha y kilometraje objetivo y verlo aparecer en la lista; sin objetivo no se guarda (CA-2, SC-002)

### Pruebas de la historia de usuario 3

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T028 [P] [US3] Prueba de widget en `client/test/maintenance_form_test.dart`: sin objetivo muestra el mensaje en español, campos de fecha/kilómetros/antelación, `showDatePicker` nativo y `PopScope` con `_hayCambios` (patrón de los formularios existentes), pruebas que deben fallar al inicio
- [X] T029 [P] [US3] Prueba del provider en `client/test/maintenances_provider_test.dart`: carga de la lista, crear hace aparecer el registro de inmediato (SC-002), `MAINTENANCE_TARGET_REQUIRED` muestra el mensaje en español sin perder lo escrito, estados vacío/cargando/error, pruebas que deben fallar al inicio

### Implementación de la historia de usuario 3

- [X] T030 [P] [US3] Crear `client/lib/models/maintenance.dart` con `fromJson`/`toJson` según `contracts/maintenances.md` (`vehicleId`, `vehicleLabel`, `clientName`, `nextDueDate`, `nextDueMileage`, `warnDays`, `warnKm`, `recommendations`, `state`, `daysRemaining`, `mileageRemaining`) y etiquetas de estado en español (Normal, Próximo, Vencido)
- [X] T031 [US3] Ampliar `client/lib/services/api_client.dart` con los métodos `listarMantenimientos()` y `crearMantenimiento(payload)` (implementado como llamada directa `api.get('/maintenances')` y `api.post('/maintenances', …)` dentro de `MaintenancesProvider`: patrón del proyecto)
- [X] T032 [US3] Crear `client/lib/providers/maintenances_provider.dart` con carga, creación, recarga de la lista y estados de UI (depende de T030, T031)
- [X] T033 [US3] Crear `client/lib/screens/maintenances/maintenance_form_screen.dart` con selector de vehículo, fecha objetivo, kilometraje objetivo, antelación en días y kilómetros, recomendaciones, validación en español, botón bloqueado mientras guarda y `PopScope`
- [X] T034 [US3] Crear `client/lib/screens/maintenances/maintenance_list_screen.dart` con tabla (`data_table_2`), vehículo, cliente, objetivo, antelación y recomendaciones, más estados vacío/cargando/error con `states_view.dart`
- [X] T035 [US3] Registrar las rutas en `client/lib/utils/app_route.dart`, agregar la entrada **Mantenimientos** en `client/lib/widgets/app_shell.dart` visible para ADMIN, MECHANIC y RECEPTIONIST (R-11), y registrar el provider en `client/lib/main.dart` (la navegación vive en `app_shell.dart`: rutas por índice del rail; `app_route.dart` solo define la transición `AppRoute`)

**Checkpoint**: Historia de usuario 3 completa: el próximo mantenimiento se registra desde el móvil y aparece en la lista (CA-2, SC-002)

---

## Fase 6: Historia de usuario 4 - Mantenimientos próximos y vencidos (Prioridad: P4)

**Objetivo**: Recepcionista consulta los mantenimientos ordenados por urgencia con los estados visuales Normal (verde), Próximo (ámbar) y Vencido (rojo), y puede filtrarlos por estado

**Prueba independiente**: Con la cuenta de recepcionista abrir Mantenimientos y ver los vehículos ordenados por urgencia con sus estados y el filtro por estado (CA-3, SC-003)

### Pruebas de la historia de usuario 4

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T036 [P] [US4] Prueba de integración en `server/tests/integration/maintenances-list.test.js` contra `motorix_test`: `GET /api/maintenances?state=NORMAL|UPCOMING|OVERDUE` devuelve el 100 % de los registros del umbral (SC-003); estado desconocido → 400 `VALIDATION_ERROR`; orden `OVERDUE` → `UPCOMING` → `NORMAL` y dentro de cada estado por fecha objetivo ascendente; RECEPTIONIST → 200 en GET (CA-3, R-07); sin resultados → arreglo vacío y `total: 0`, pruebas que deben fallar al inicio
- [X] T037 [P] [US4] Prueba de widget en `client/test/maintenance_list_test.dart`: los tres estados visuales con los tokens de color (Normal en verde, Próximo en ámbar, Vencido en rojo), filtro por estado, orden por urgencia y estado vacío (FR-006, FR-018), pruebas que deben fallar al inicio

### Implementación de la historia de usuario 4

- [X] T038 [US4] Ampliar `client/lib/screens/maintenances/maintenance_list_screen.dart` con chips de filtro por estado, orden por urgencia (Vencido → Próximo → Normal) y etiquetas de estado con los tokens de `docs/design-system.md` (sin valores sueltos)
- [X] T039 [US4] Ampliar `client/lib/providers/maintenances_provider.dart` con el filtro `?state` y el recálculo de la lista filtrada

**Checkpoint**: Historia de usuario 4 completa: CA-3 y SC-003 cumplidos

---

## Fase 7: Historia de usuario 5 - Refacciones e inventario (Prioridad: P5)

**Objetivo**: El administrador registra y consulta refacciones con sus datos mínimos; el alta con stock inicial queda asentada como movimiento `IN` en la misma transacción, y solo ADMIN tiene permisos sobre el inventario

**Prueba independiente**: Crear una refacción con stock inicial y verla en la consulta del catálogo con su movimiento `IN` reflejado en el saldo; rechazar código duplicado y accesos de otros roles (CA-4, FR-008, FR-012)

### Pruebas de la historia de usuario 5

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T040 [P] [US5] Prueba de integración en `server/tests/integration/parts-catalog.test.js` contra `motorix_test`: alta 201 con el `IN` inicial registrado en la misma transacción y `stockCurrent` coincidente (FR-008, FR-012); `partCode` repetido → 400 `PART_CODE_DUPLICATED`; `name`, `category` o `stockMin` faltantes → 400 `VALIDATION_ERROR`; precios o stock negativos → 400; `GET /api/parts?q=` filtra por código, nombre o categoría y devuelve `lowStock` calculado; PATCH edita nombre, categoría, marca, stock mínimo y precios pero no acepta `stockCurrent` ni `partCode`; refacción inexistente → 404 `PART_NOT_FOUND`; MECHANIC y RECEPTIONIST → 403 en GET/POST/PATCH (R-07, RN-15, SC-008), pruebas que deben fallar al inicio
- [X] T041 [P] [US5] Prueba de widget en `client/test/parts_form_test.dart`: alta válida con código, nombre, categoría, stock inicial y mínimo, precios; código duplicado muestra el mensaje en español sin perder lo escrito; validación de campos en español y `PopScope`, pruebas que deben fallar al inicio
- [X] T042 [P] [US5] Prueba del provider en `client/test/parts_provider_test.dart`: carga del catálogo, crear hace aparecer la refacción, error de servidor con mensaje en español y estados vacío/cargando/error, pruebas que deben fallar al inicio

### Implementación de la historia de usuario 5

- [X] T043 [P] [US5] Crear `server/validators/parts.js` con zod y mensajes en español para refacciones: `partCode` obligatorio ≤ 50 (único), `name` obligatorio ≤ 100, `category` obligatoria ≤ 50, `brand` opcional ≤ 50, `stockCurrent` entero ≥ 0 opcional con defecto 0 (solo en el alta), `stockMin` entero ≥ 0 obligatorio, precios ≥ 0 con hasta 2 decimales; en `PATCH` no se aceptan `partCode` ni `stockCurrent`
- [X] T044 [P] [US5] Crear `server/models/part.model.js` con `create`, `findById`, `findByCode`, `list` (filtros `q` por código/nombre/categoría, paginación), `update` y el cálculo de `lowStock` (`stockCurrent <= stockMin`); sin borrado de refacciones (FR-015) — nota de adaptación: el contrato no expone paginación (`{parts, total}` sin página/límite), `list` devuelve el catálogo completo y `total` es el número de resultados
- [X] T045 [P] [US5] Crear `server/models/inventory_movement.model.js` con `create`, `listByPart` (más recientes primero) y `sumByPart`; sin borrado de movimientos (FR-015)
- [X] T046 [US5] Crear `server/services/inventory.service.js` con `createPart`: alta de la refacción y su movimiento `IN` inicial en una sola transacción con `SELECT ... FOR UPDATE` sobre `parts`, devolviendo `PART_CODE_DUPLICATED` si el código existe y validando `stock_current >= 0` (RN-8); el `IN` se registra solo si el stock inicial es mayor que 0 (depende de T043, T044, T045)
- [X] T047 [US5] Crear `server/controllers/parts.controller.js` con `listParts`, `createPart` y `updatePart` según `contracts/inventory.md`, construyendo la respuesta `{parts, total}` con `lowStock` por ítem (depende de T046)
- [X] T048 [US5] Crear `server/routes/parts.routes.js` con `GET /api/parts`, `POST /api/parts` y `PATCH /api/parts/:id` con `authenticate` + `authorize(["ADMIN"])` (R-07) y `validate`, y registrarlo en `server/routes/index.js`
- [X] T049 [P] [US5] Crear `client/lib/models/part.dart` con `fromJson`/`toJson` y precios como cadena decimal con 2 decimales
- [X] T050 [US5] Ampliar `client/lib/services/api_client.dart` con los métodos de refacciones: listar (con `q`), crear y actualizar — nota de adaptación: `ApiClient` es genérico (`get/post/patch/delete`); las llamadas con `q`/`low` van directas en `PartsProvider` (`get('/parts', query: …)`, `post`, `patch`)
- [X] T051 [US5] Crear `client/lib/providers/parts_provider.dart` con carga, creación, edición y estados de UI (depende de T049, T050)
- [X] T052 [US5] Crear `client/lib/screens/inventory/parts_list_screen.dart` con tabla (`data_table_2`), búsqueda y estados vacío/cargando/error con `states_view.dart`
- [X] T053 [US5] Crear `client/lib/screens/inventory/part_form_screen.dart` con código, nombre, categoría, marca, stock inicial, stock mínimo, precios, validación en español, botón bloqueado mientras guarda y `PopScope`
- [X] T054 [US5] Registrar las rutas en `client/lib/utils/app_route.dart`, agregar la entrada **Inventario** en `client/lib/widgets/app_shell.dart` visible solo para ADMIN (R-11), y registrar el provider en `client/lib/main.dart` — nota de adaptación: `AppRoute` solo define la transición de página (patrón de T019/T035); la navegación real es la entrada del rail en `app_shell.dart` (índice 8, roles `{'ADMIN'}`) y el provider quedó en `main.dart`

**Checkpoint**: Historia de usuario 5 completa: el administrador crea y consulta refacciones con su `IN` inicial (CA-4) y los demás roles reciben 403 en backend

---

## Fase 8: Historia de usuario 6 - Stock disponible (Prioridad: P6)

**Objetivo**: El saldo de cada refacción refleja los movimientos registrados (`IN` y `ADJUSTMENT`; la `OUT` automática llega con US7), con bloqueo transaccional que impide saldos negativos, y la consulta de stock muestra la disponibilidad

**Prueba independiente**: Registrar movimientos sobre el catálogo y ver el saldo actualizado en la consulta de stock, con el rechazo de operaciones sin existencias y la señalización de stock bajo (CA-4, CA-6, FR-009, FR-013)

### Pruebas de la historia de usuario 6

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T055 [P] [US6] Prueba de integración en `server/tests/integration/stock-balance.test.js` contra `motorix_test`: `POST /api/parts/:id/movements` `IN` → 201 con `part.stockCurrent` actualizado; `ADJUSTMENT` negativo con motivo ≥ 10 → 201 y saldo a la baja; `ADJUSTMENT` positivo → 201 y saldo a la alza; `movementType: "OUT"` manual → 400 `VALIDATION_ERROR` (las salidas son automáticas, RN-7); `ADJUSTMENT` sin motivo o con motivo < 10 → 400 `VALIDATION_ERROR`; `quantity` 0 → 400; ajuste que dejaría `stockCurrent < 0` → 400 `STOCK_INSUFFICIENT` **sin efecto** (el saldo queda intacto, RN-8/CA-6/SC-006); refacción inexistente → 404 `PART_NOT_FOUND`; MECHANIC/RECEPTIONIST → 403 (RN-15); `GET /api/parts/:id/movements` devuelve los movimientos más recientes primero, pruebas que deben fallar al inicio
- [X] T056 [P] [US6] Prueba de contrato en `server/tests/contract/inventory.contract.test.js` contra `specs/003-historial-mantenimiento-inventario/contracts/inventory.md`: forma de `data.part` y `data.movement` (sin campos de alerta `lowStockCount` ni `?low=true`, que se validan en US8/T073), códigos `STOCK_INSUFFICIENT`/`PART_NOT_FOUND`/`PART_CODE_DUPLICATED`, `FORBIDDEN` para roles distintos de ADMIN y ausencia de `DELETE`, pruebas que deben fallar al inicio
- [X] T057 [P] [US6] Prueba de widget en `client/test/parts_stock_test.dart`: la lista muestra el stock actual, el stock mínimo y la etiqueta «Stock bajo» cuando `stockCurrent <= stockMin`, con el estado vacío correspondiente (CA-4, FR-014, FR-018), pruebas que deben fallar al inicio — nota: pasó de inmediato porque T052 ya implementó columnas, píldora y vacío; se verificó el color ámbar (`AppColors.warning`)

### Implementación de la historia de usuario 6

- [X] T058 [P] [US6] Crear `client/lib/models/inventory_movement.dart` con `fromJson` y etiquetas de tipo en español (Entrada, Salida, Ajuste)
- [X] T059 [US6] Ampliar `server/validators/parts.js` con los esquemas de movimientos: `movementType` obligatorio solo `IN` o `ADJUSTMENT` (el `OUT` manual → 400 `VALIDATION_ERROR`, RN-7), `quantity` entero ≠ 0 con signo en `ADJUSTMENT`, `reason` obligatorio ≥ 10 en `ADJUSTMENT` y prohibido en `IN`
- [X] T060 [US6] Ampliar `server/services/inventory.service.js` con `registrarMovimiento`: transacción con `SELECT ... FOR UPDATE` sobre `parts` que actualiza `stock_current`, escribe el movimiento y rechaza con 400 `STOCK_INSUFFICIENT` toda operación que dejaría el saldo negativo, sin efecto parcial (R-05, RN-8; depende de T059)
- [X] T061 [US6] Ampliar `server/controllers/parts.controller.js` y `server/routes/parts.routes.js` con `GET /api/parts/:id/movements` y `POST /api/parts/:id/movements` (solo ADMIN, R-07)
- [X] T062 [US6] Ampliar `client/lib/services/api_client.dart` y `client/lib/providers/parts_provider.dart` con la consulta de movimientos de una refacción y el refresco del saldo en la lista — nota de adaptación: `ApiClient` es genérico; `movimientosDe(partId)` va en el provider con `get('/parts/{id}/movements')`, y el saldo se refresca con `cargar()` tras cada mutación
- [X] T063 [US6] Ampliar `client/lib/screens/inventory/parts_list_screen.dart` con el stock actual, el stock mínimo y la etiqueta «Stock bajo» con los tokens de color (ámbar para stock bajo, rojo para stock crítico en cero) — nota: ya estaba implementado en T052 (columnas «Stock actual»/«Stock mínimo», píldora `AppColors.warning` para «Stock bajo» y `AppColors.danger` para «Agotado»); verificado por T057

**Checkpoint**: Historia de usuario 6 completa: CA-4 y CA-6 cumplidos (el caso de salida por uso en órdenes se completa en US7, T064)

---

## Fase 9: Historia de usuario 7 - Refacciones utilizadas en la orden (Prioridad: P7)

**Objetivo**: El mecánico agrega refacciones con su cantidad únicamente a sus órdenes que no están `DELIVERED`; cada uso genera en la misma transacción la fila en `order_parts`, la salida `OUT` y el descuento del stock

**Prueba independiente**: Agregar una refacción a la orden propia y ver `order_parts` con la fila, el movimiento `OUT` con `orderId` y el stock decrementado; la orden entregada, la orden ajena o una cantidad mayor al stock se rechazan sin ningún efecto (CA-5, RN-6/7/8/9)

### Pruebas de la historia de usuario 7

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T064 [P] [US7] Prueba de integración en `server/tests/integration/order-parts.test.js` contra `motorix_test`: `POST /api/service-orders/{id}/parts` → 201 con fila en `order_parts`, movimiento `OUT` con `orderId` y `stockCurrent` descontado (RN-7, CA-5, SC-005); repetir el mismo `partId` crea otra fila con su propia salida (R-06); sin `partId` → 400 `PART_REQUIRED`; `partId` inexistente → 404 `PART_NOT_FOUND`; `quantity` ≤ 0 → 400 `VALIDATION_ERROR`; `quantity` mayor que `stockCurrent` → 400 `STOCK_INSUFFICIENT` sin efecto (ni fila, ni salida, ni descuento; RN-8, CA-6); orden en `DELIVERED` → 400 `ORDER_DELIVERED` (RN-9); orden de otro mecánico → 403 `FORBIDDEN`; ADMIN y RECEPTIONIST → 403 en POST (Q5, RN-15); orden inexistente → 404 `SERVICE_ORDER_NOT_FOUND`; `GET` devuelve `parts` con `total` ordenado por `createdAt` ascendente y 403 a MECHANIC con orden ajena, pruebas que deben fallar al inicio
- [X] T065 [P] [US7] Prueba de contrato en `server/tests/contract/order-parts.contract.test.js` contra `specs/003-historial-mantenimiento-inventario/contracts/order-parts.md`: forma de `data.orderPart` y `data.parts`, códigos `PART_REQUIRED`/`PART_NOT_FOUND`/`ORDER_DELIVERED`/`STOCK_INSUFFICIENT`, 201 en POST, ausencia de `DELETE`, pruebas que deben fallar al inicio
- [X] T066 [P] [US7] Prueba de widget en `client/test/order_parts_test.dart`: la sección «Refacciones» lista las piezas con su cantidad, agregar una refacción actualiza la lista, `STOCK_INSUFFICIENT` y `ORDER_DELIVERED` muestran el mensaje en español y el botón queda deshabilitado mientras guarda (FR-018), pruebas que deben fallar al inicio

### Implementación de la historia de usuario 7

- [X] T067 [P] [US7] Crear `server/models/order_part.model.js` con `create`, `listByOrder`, `findByOrderAndPart` y `updateQuantity`; sin borrado (R-06) — nota de adaptación: `findByOrderAndPart`/`updateQuantity` se omiten por R-06: la migración 011 y el contrato obligan a que repetir la misma refacción cree **otra fila** (cada uso es un evento inmutable); el modelo expone `crear`, `listarPorOrden` y `buscarPorId` (respuesta del POST)
- [X] T068 [US7] Ampliar `server/services/inventory.service.js` con `agregarRefaccionOrden`: transacción con `SELECT ... FOR UPDATE` sobre `parts` y `service_orders` que valida que la orden pertenezca al mecánico y no esté `DELIVERED` (RN-6, RN-9, Q5), crea o incrementa la fila en `order_parts`, registra el `OUT` con `order_id` y `created_by` del mecánico, descuenta `stock_current` y aborta con 400 `STOCK_INSUFFICIENT` sin efecto si no alcanza (RN-7, RN-8; depende de T060, T067) — nota de adaptación: siempre **crea** la fila nueva (R-06, ver T067); el servicio añade también `listarRefaccionesOrden` (lectura GET con 404 de orden y 403 al mecánico ajeno)
- [X] T069 [US7] Ampliar `server/controllers/service_orders.controller.js` y `server/routes/service_orders.routes.js` con `GET /api/service-orders/:id/parts` (ADMIN, RECEPTIONIST y MECHANIC, 403 si es ajena para MECHANIC) y `POST /api/service-orders/:id/parts` (solo el mecánico de la orden) con `authenticate` + `authorize` + `validate`
- [X] T070 [P] [US7] Crear `client/lib/models/order_part.dart` con `fromJson` según `contracts/order-parts.md` (`partCode`, `name`, `quantity`)
- [X] T071 [US7] Ampliar `client/lib/services/api_client.dart` y `client/lib/providers/service_orders_provider.dart` con `listarRefaccionesOrden(orderId)` y `agregarRefaccionOrden(orderId, payload)` — nota de adaptación: `ApiClient` es genérico; las llamadas van directas en el provider (`cargarRefacciones(orderId)` con `get('/service-orders/{id}/parts')` y `agregarRefaccionOrden` con `post`, que recarga la sección al éxito)
- [X] T072 [US7] Ampliar `client/lib/screens/orders/order_detail_screen.dart` con la sección «Refacciones»: selector de refacción, cantidad, alta confirmada, mensajes `STOCK_INSUFFICIENT`/`ORDER_DELIVERED` en español y botón bloqueado mientras guarda — nota de adaptación: el alta es inline con validación y snackbar (el diálogo de confirmación de 8.5 es solo para acciones destructivas); el selector usa `PartsProvider` (registrado en `main.dart` y en los arneses de `order_detail_test`/`order_notes_test`/`order_status_test`); la fila de la lista muestra «código · nombre · cantidad uds»

**Checkpoint**: Historia de usuario 7 completa: CA-5 cumplido y, junto con US6, CA-6 y SC-005/SC-006

---

## Fase 10: Historia de usuario 8 - Alertas de stock bajo (Prioridad: P8)

**Objetivo**: El administrador ve las refacciones con `stockCurrent <= stockMin`, con un contador de alertas que alimenta el filtro de la interfaz

**Prueba independiente**: Con al menos una refacción bajo mínimo, abrir Inventario y activar «Stock bajo» para ver solo esas refacciones con su stock actual y mínimo, con el contador correcto (CA-7, SC-007)

### Pruebas de la historia de usuario 8

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T073 [P] [US8] Prueba de integración en `server/tests/integration/parts-alerts.test.js` contra `motorix_test`: `GET /api/parts?low=true` devuelve solo las refacciones con `stockCurrent <= stockMin` (FR-014), `lowStockCount` coincide con el total de refacciones en alerta (SC-007), sin alertas → lista vacía y contador 0, el ítem incluye `lowStock`, `?q` combinado con `?low` funciona, valor de `?low` distinto de `true` → 400 `VALIDATION_ERROR`, MECHANIC/RECEPTIONIST → 403, pruebas que deben fallar al inicio
- [X] T074 [P] [US8] Prueba de widget en `client/test/parts_alerts_test.dart`: el chip «Stock bajo» filtra la lista, el contador muestra el número de alertas, sin alertas muestra el estado vacío con mensaje en español (CA-7, FR-018), pruebas que deben fallar al inicio — nota: 2 de 3 fallaron al inicio; el contador pasó de inmediato porque T052 ya lo pintaba

### Implementación de la historia de usuario 8

- [X] T075 [US8] Ampliar `server/models/part.model.js` y `server/controllers/parts.controller.js` con el filtro `?low=true` (`WHERE stock_current <= stock_min`), el campo `lowStock` por ítem y `lowStockCount` en la respuesta de `GET /api/parts` — nota de adaptación: el filtro, `lowStock` y el contador global ya existían desde US5 (T043–T047); lo nuevo fue la validación de `?low` en `inventory.service.listParts` (valor distinto de `true` → 400 `VALIDATION_ERROR`)
- [X] T076 [US8] Ampliar `client/lib/providers/parts_provider.dart` y `client/lib/screens/inventory/parts_list_screen.dart` con el chip «Stock bajo», el contador de alertas y la lista filtrada — nota de adaptación: el proveedor ya tenía `soloStockBajo`/`filtrarStockBajo` (T051) y el encabezado el contador (T052); se agregó el `FilterChip` junto al contador, el vacío «No hay refacciones con stock bajo.» y se ajustaron las aserciones de T057 (`parts_stock_test`) para distinguir la píldora dentro de la tabla del chip del encabezado (mismo texto)

**Checkpoint**: Historia de usuario 8 completa: CA-7 y SC-007 cumplidos

---

## Fase 11: Pulido y aspectos transversales

**Propósito**: Datos de ejemplo, documentación, seguridad, diseño y validación final

- [X] T077 [P] Ampliar `server/scripts/seed.js` con datos de ejemplo idempotentes del sprint (refacciones con stock y stock mínimo, al menos una bajo mínimo, movimientos `IN`, al menos un mantenimiento próximo o vencido y 1 orden `FINISHED` con refacción usada para el historial) referenciando vehículos, usuarios y órdenes existentes; ejecutar `npm run seed` dos veces y comprobar que la segunda crea 0 registros (FR-019, SC-009, Principio III) — verificado: 4 refacciones (AMO-003 bajo mínimo y FUS-004 agotado) con `IN` iniciales, mantenimiento vencido de ABC1234 (84,000 vs 86,000 km) y 1 uso en la orden `FINISHED`; segunda pasada: 0 creados en las tres secciones
- [X] T078 [P] Actualizar `database/README.md` con las migraciones `008`–`011`, sus tablas y el orden de aplicación
- [X] T079 [P] Actualizar `docs/project-context.md` para dejar constancia de las decisiones del Sprint 3 (historial calculado en consulta, fila única de mantenimiento por vehículo con estado calculado en el backend, política de stock negativo y catálogo de movimientos `IN`/`OUT`/`ADJUSTMENT`) — trazabilidad del Principio I — nota: se documentaron 8 decisiones (las 5 clarificaciones más R-06, signo de cantidades y `lowStockCount` global)
- [X] T080 [P] Actualizar `README.md` en la raíz con los módulos y pantallas del Sprint 3 si enumera funcionalidades
- [X] T081 Auditoría de seguridad en `server/`: `.env` ignorado y `.env.example` sin secretos, 500 sin trazas en los endpoints nuevos (`history`, `maintenances`, `parts`, `service-orders/:id/parts`), permisos RN-15 respetando la matriz de `contracts/README.md`, mensajes de error en español y sin credenciales en las pruebas — verificado: `.gitignore` cubre `.env*` y `.env.example` solo trae placeholders; `errorHandler` responde `INTERNAL_ERROR` genérico sin `.stack`; matriz coincide con las rutas (historial ADMIN/MECHANIC, `maintenances` GET 3 roles y POST ADMIN/MECHANIC, `parts` y movimientos solo ADMIN, `service-orders/{id}/parts` GET 3 roles con aislamiento y POST solo MECHANIC, sin DELETE del Sprint 3); fábricas de error en español; pruebas del Sprint 3 con `firmarToken` (sin secretos reales)
- [X] T082 Revisión de diseño en `client/lib/screens/history/`, `client/lib/screens/maintenances/`, `client/lib/screens/inventory/` y `client/lib/screens/orders/order_detail_screen.dart` contra `docs/design-system.md`: tokens (sin valores sueltos), estados vacío/cargando/error/éxito, confirmaciones obligatorias, transiciones de 250 ms y `PopScope` en los formularios — verificado: solo tokens `AppColors`/`AppSpacing`/`AppRadii`; `LoadingView`/`ErrorView`/`EmptyView` en listas y estados inline en la tarjeta de refacciones; `PopScope` + `mostrarConfirmacion` en `part_form_screen` y `maintenance_form_screen`, y confirmación al cambiar estado de la orden; navegación con `AppRoute` (250 ms)
- [X] T083 Ejecutar los escenarios V1 a V10 de `specs/003-historial-mantenimiento-inventario/quickstart.md` y registrar los resultados en `specs/003-historial-mantenimiento-inventario/quickstart-resultados.md` — verificado: V1 y V10.4 con comandos directos (seed ×2 idempotente; instalación desde cero en base desechable con 001→011 y 12 tablas), V2–V9 con script contra la API real (92 comprobaciones PASS, 0 FAIL, flujo V9 en 38 ms)
- [X] T084 Verificación final: `npm run lint` y `npm test` en `server/` (todo verde), `flutter analyze` sin problemas y `flutter test` en `client/` (todo verde) — verificado: lint 0 hallazgos, 39 suites / 308 tests backend, analyze 0 issues y 98/98 pruebas Flutter
- [X] T085 Revisar y marcar los criterios CA-1 a CA-8 de `docs/sprints/sprint-3-historial-inventario.md` como cumplidos, con evidencia del quickstart y de las pruebas — verificado: los 8 CA marcados con su evidencia (quickstart-resultados.md y suites en verde)

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias; se ejecuta primero
- **Fundacional (Fase 2)**: depende de Preparación; **BLOQUEA todas las historias**
- **Historias (Fase 3–10)**: todas dependen de Fundacional
  - Orden recomendado por prioridad: US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8
  - US1 (historial) es de solo lectura sobre tablas existentes: puede ejecutarse en paralelo con la Fase 2 y con US2
  - US2 → US3 (el formulario consume el backend de mantenimientos) y US2 → US4 (la pantalla base es de US3)
  - US5 → US6 (movimientos sobre el catálogo), US5 → US7 (refacciones en orden) y US5 → US8 (alertas sobre la lista)
  - US6 → US7 (comparten `server/services/inventory.service.js` y el flujo de movimientos)
  - US6 y US8 tocan `parts_list_screen.dart` y `parts_provider.dart`: ejecutarlas en secuencia; US7 puede correr en paralelo con US8
- **Pulido (Fase 11)**: depende de todas las historias deseadas

### Dentro de cada historia

- Pruebas primero (deben fallar) → modelos → servicios → controladores/rutas → frontend (modelo → api → provider → pantallas) → rutas, rail y `main.dart`
- Historia completa antes de pasar a la siguiente prioridad

### Archivos compartidos (cuidado al paralelizar historias)

`client/lib/services/api_client.dart`, `client/lib/utils/app_route.dart`, `client/lib/widgets/app_shell.dart`, `client/lib/main.dart`, `server/routes/index.js`, `server/services/inventory.service.js`, `server/controllers/parts.controller.js`, `server/routes/parts.routes.js`, `client/lib/screens/inventory/parts_list_screen.dart`, `client/lib/providers/parts_provider.dart`

- Si dos historias trabajan a la vez, que una persona edite cada archivo compartido; el resto de tareas [P] son seguras en paralelo

### Oportunidades de paralelización

- **Preparación**: T002 (con T001 en paralelo si se desea)
- **Fundacional**: T003 + T004 + T005 + T006 (archivos distintos)
- **US1**: T008 + T009 + T010 (pruebas) ∥ T011 + T015 (backend y modelo Flutter)
- **US2**: T020 + T021 + T022 + T023 + T024
- **US3**: T028 + T029 + T030
- **US4**: T036 + T037
- **US5**: T040 + T041 + T042 + T043 + T044 + T045 ∥ T049
- **US6**: T055 + T056 + T057 + T058
- **US7**: T064 + T065 + T066 + T067 + T070
- **US8**: T073 + T074
- **Entre historias**: US1 ∥ US2 (backend), US4 ∥ US5, US7 ∥ US8
- **Pulido**: T077 + T078 + T079 + T080 (documentación y seeds en paralelo)

---

## Ejemplo de paralelización: Historia de usuario 1

```bash
# Lanzar juntas las pruebas de US1 (archivos distintos):
Tarea: "Prueba de integración en server/tests/integration/vehicle-history.test.js"
Tarea: "Prueba de contrato en server/tests/contract/vehicle-history.contract.test.js"
Tarea: "Prueba de widget en client/test/vehicle_history_test.dart"

# Lanzar juntos el modelo del backend y el modelo Flutter (sin dependencias entre sí):
Tarea: "Crear server/models/history.model.js"
Tarea: "Crear client/lib/models/history_entry.dart"

# En cadena (dependencias del servicio):
Tarea: "Crear server/services/history.service.js"   # depende del modelo
Tarea: "Crear server/controllers/history.controller.js"  # depende del servicio
```

---

## Estrategia de implementación

### MVP primero (solo Historia de usuario 1)

1. Completar Fase 1: Preparación
2. Completar Fase 2: Fundacional (CRÍTICO — bloquea todas las historias)
3. Completar Fase 3: Historia de usuario 1 (historial)
4. **PARAR y VALIDAR**: probar US1 de forma independiente (CA-1)
5. Demostrar/desplegar si está listo

### Entrega incremental

1. Preparación + Fundacional → base lista
2. US1 (historial) → probar → demo (**MVP**)
3. US2 + US3 (backend de mantenimientos y formulario) → probar → demo (ya se programa el taller)
4. US4 (consulta para recepción) → probar → demo
5. US5 → US6 → US7 → US8 → inventario completo (SC-001 a SC-007)
6. Pulido → validación del quickstart y pruebas en verde

### Estrategia en equipo paralelo

1. El equipo completa Preparación + Fundacional juntos
2. Después: desarrollador A → US1 (historial); desarrollador B → US2 (mantenimientos)
3. Luego en cadena: US3 → US4 (mismas pantallas), y US5 → US6 → US7 (comparten `inventory.service.js`), con US8 en paralelo a US7
4. Todos terminan con Pulido y la validación del quickstart

---

## Notas

- Las tareas [P] usan archivos distintos y no dependen de tareas incompletas
- La etiqueta [Story] da trazabilidad requisito → historia → tarea (Principio I)
- Cada historia debe poder probarse de forma independiente en su checkpoint
- Verificar que las pruebas fallen antes de implementar (rojo → verde)
- Commits pequeños y en español tras cada tarea o grupo lógico
- Si una tarea revela un conflicto con el spec, detenerse y aclarar antes de continuar
- Base de datos: desarrollo en `motorix`, pruebas del backend contra `motorix_test`; migraciones con `database/scripts/aplicar-migraciones.ps1`
- Cuentas para la validación manual y el quickstart: `admin`/`Admin2026!`, `recepcion`/`Recepcion2026!`, `mecanico`/`Mecanico2026!`
- El repositorio aún no tiene git inicializado; al hacerlo, crear la rama `003-historial-mantenimiento-inventario` antes de implementar
