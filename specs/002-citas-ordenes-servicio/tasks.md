---
description: "Lista de tareas del Sprint 2: citas y órdenes de servicio"
---

# Tasks: Citas y órdenes de servicio (Sprint 2)

**Input**: Documentos de diseño en `/specs/002-citas-ordenes-servicio/`

**Prerequisites**: plan.md (requerido), spec.md (historias con prioridades), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Solicitados explícitamente por el spec (SC-003 «las pruebas automatizadas de la lógica de transiciones existen y pasan», CA-8) y exigidos por la constitución (Principio VII). Se incluyen pruebas unitarias, de integración, de contrato y de Flutter.

**Organization**: Las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: Historia a la que pertenece la tarea (US1, US2, …)
- Cada tarea indica la ruta exacta del archivo

## Path Conventions

- Backend: `server/` (capas directas, sin `src/`), pruebas en `server/tests/{unit,integration,contract}`
- Frontend: `client/lib/` (models, providers, services, screens, widgets, utils), pruebas en `client/test/`
- Base de datos: `database/migrations/` (SQL numerado e inmutable)
- Contratos del feature: `specs/002-citas-ordenes-servicio/contracts/`

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Línea base verificada y utilidades de error compartidas por todo el sprint

- [X] T001 Verificar la línea base verde del Sprint 1 antes de tocar código: `npm test` y `npm run lint` en `server/`, y `flutter analyze` y `flutter test` en `client/` (deben pasar las 94 pruebas de backend y las 31 de frontend)
- [X] T002 [P] Extender `server/utils/errors.js` con fábricas de los códigos nuevos del sprint, con mensajes en español: `APPOINTMENT_NOT_FOUND`, `SERVICE_ORDER_NOT_FOUND`, `ORDER_ITEM_NOT_FOUND`, `VEHICLE_REQUIRED`, `VEHICLE_CLIENT_MISMATCH`, `MECHANIC_REQUIRED`, `MECHANIC_NOT_FOUND`, `INVALID_MECHANIC`, `MILEAGE_LOWER_THAN_PREVIOUS`, `INVALID_STATUS_TRANSITION`, `APPOINTMENT_CLOSED` y `ORDER_DELIVERED` (tabla de códigos en `specs/002-citas-ordenes-servicio/contracts/README.md`)

---

## Phase 2: Foundational (Prerrequisitos bloqueantes)

**Purpose**: Esquema del Sprint 2; bloquea a TODAS las historias de usuario

**⚠ CRITICAL**: Ninguna historia puede comenzar hasta completar esta fase

- [X] T003 [P] Crear `database/migrations/004_create_appointments.sql` con la tabla `appointments` según `specs/002-citas-ordenes-servicio/data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `client_id` INT UNSIGNED NOT NULL FK → `clients.id` RESTRICT; `vehicle_id` INT UNSIGNED NOT NULL FK → `vehicles.id` RESTRICT; `appointment_date` DATE NOT NULL; `appointment_time` TIME NOT NULL; `reason` VARCHAR(150) NOT NULL; `notes` VARCHAR(500) NULL; `status` ENUM('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELED') NOT NULL DEFAULT 'PENDING'; `created_at`/`updated_at` DATETIME; índices en `client_id`, `vehicle_id`, `status` y compuesto `(appointment_date, appointment_time)`; InnoDB `utf8mb4`
- [X] T004 [P] Crear `database/migrations/005_create_service_orders.sql` con la tabla `service_orders` según `specs/002-citas-ordenes-servicio/data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `client_id` y `vehicle_id` INT UNSIGNED NOT NULL FK RESTRICT; `mechanic_id` INT UNSIGNED NOT NULL FK → `users.id` RESTRICT; `entry_mileage` INT UNSIGNED NOT NULL; `mileage_correction_reason` VARCHAR(200) NULL; `reported_problem` VARCHAR(500) NOT NULL; `diagnosis`, `observations`, `recommendations` VARCHAR(1000) NULL; `status` ENUM('RECEIVED','DIAGNOSIS','IN_REPAIR','WAITING_PART','FINISHED','DELIVERED') NOT NULL DEFAULT 'RECEIVED'; `waiting_origin` ENUM('DIAGNOSIS','IN_REPAIR') NULL; `created_at`/`updated_at`; índices en `client_id`, `vehicle_id`, `mechanic_id`, `status`, `created_at`; **sin columna `appointment_id`** (Q3); InnoDB `utf8mb4`
- [X] T005 Ejecutar `database/scripts/aplicar-migraciones.ps1` y comprobar en `schema_migrations` los registros `004_create_appointments` y `005_create_service_orders`; volver a ejecutarlo para confirmar que es idempotente (0 aplicadas la segunda vez)

**Checkpoint**: Esquema listo; las historias de usuario pueden empezar

---

## Phase 3: User Story 1 - Registrar y consultar citas (Priority: P1) 🎯 MVP

**Goal**: La recepción agenda la llegada de vehículos: alta, consulta con filtros, edición y cancelación confirmada

**Independent Test**: Registrar una cita desde cero para un cliente y vehículo existentes y verla aparecer en la consulta, sin crear ninguna orden

### Tests for User Story 1

> **NOTE**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T006 [P] [US1] Prueba unitaria de la máquina de estados de citas en `server/tests/unit/appointment-transitions.test.js`: `PENDING → CONFIRMED | IN_PROGRESS`, `CONFIRMED → IN_PROGRESS`, `IN_PROGRESS → COMPLETED`, `→ CANCELED` desde cualquier estado activo; rechazar retrocesos y cancelar `COMPLETED`/`CANCELED`; nombres de pruebas y aserciones en español (FR-004, FR-005)
- [X] T007 [P] [US1] Prueba de integración en `server/tests/integration/appointments.test.js` contra `motorix_test`: alta 201, listado con `?date`/`?status`/`?q`, edición 200, cancelación 200, datos vacíos → 400 `VALIDATION_ERROR`, vehículo que no es del cliente → 400 `VEHICLE_CLIENT_MISMATCH`, cita inexistente → 404 `APPOINTMENT_NOT_FOUND`, cita cerrada → 400 `APPOINTMENT_CLOSED`
- [X] T008 [P] [US1] Prueba de contrato en `server/tests/contract/appointments.contract.test.js`: sobre `{ok,data}`/`{ok:false,error}`, 201 en POST, códigos de negocio nuevos, y 403 `FORBIDDEN` para MECHANIC en GET/POST/PATCH (CA-7)

### Implementation for User Story 1

- [X] T009 [P] [US1] Crear `server/models/appointment.model.js` con `insertar`, `buscarPorId`, `listar` (filtros `date`, `status`, `q` por nombre de cliente o placas, paginación `page`/`limit`, orden por fecha y hora) y `actualizar`
- [X] T010 [P] [US1] Crear `server/validators/appointments.js` con esquemas zod: `date` en `YYYY-MM-DD`, `time` en `HH:MM`, `reason` obligatorio ≤ 150, `notes` opcional ≤ 500, `clientId`/`vehicleId` obligatorios; mensajes de error en español
- [X] T011 [US1] Crear `server/services/appointments.service.js` con las reglas VA-01 a VA-05 de `specs/002-citas-ordenes-servicio/data-model.md`: referencias existentes (`CLIENT_REQUIRED`/`VEHICLE_REQUIRED`/`CLIENT_NOT_FOUND`/`VEHICLE_NOT_FOUND`), `VEHICLE_CLIENT_MISMATCH`, máquina de transiciones con rechazo 400 `INVALID_STATUS_TRANSITION`, estados cerrados con 400 `APPOINTMENT_CLOSED`, sin borrado; exportar la función de transición para que T006 pase (depende de T009, T010)
- [X] T012 [US1] Crear `server/controllers/appointments.controller.js` con los manejadores de las 4 rutas según `specs/002-citas-ordenes-servicio/contracts/appointments.md` (depende de T011)
- [X] T013 [US1] Crear `server/routes/appointments.routes.js` (`GET /api/appointments`, `GET/POST /api/appointments/{id}` y `PATCH`) con `authenticate` + `authorize(["ADMIN","RECEPTIONIST"])` y `validate`, y registrarlo en `server/routes/index.js`
- [X] T014 [P] [US1] Crear `client/lib/models/appointment.dart` con `fromJson`/`toJson` y etiquetas de estado en español (Pendiente, Confirmada, En proceso, Completada, Cancelada)
- [X] T015 [P] [US1] Prueba del provider en `client/test/appointments_provider_test.dart`: carga de citas, crear cita, cancelar con estado final Cancelada, error de servidor con mensaje en español
- [X] T016 [P] [US1] Prueba de widget en `client/test/appointment_form_test.dart`: validación de campos vacíos con mensaje en español y diálogo de cancelación con botón «Confirmar» (find.widgetWithText(FilledButton, 'Confirmar'))
- [X] T017 [US1] Ampliar `client/lib/services/api_client.dart` con los métodos de citas: listar (con filtros), obtener, crear y actualizar según `contracts/appointments.md`
- [X] T018 [US1] Crear `client/lib/providers/appointments_provider.dart` con carga, filtros de fecha y estado, crear, editar, cancelar y estados de UI (vacío/cargando/error/éxito) (depende de T014, T017)
- [X] T019 [US1] Registrar las rutas de citas en `client/lib/utils/app_route.dart` y agregar la entrada **Citas** en `client/lib/widgets/app_shell.dart`, visible solo para ADMIN y RECEPTIONIST
- [X] T020 [US1] Crear `client/lib/screens/appointments/appointment_list_screen.dart` con tabla (`data_table_2`), filtros de fecha y estado, búsqueda, estados vacío/cargando/error con `states_view.dart` y acciones Editar y Cancelar con `confirm_dialog.dart` (tokens de `docs/design-system.md`)
- [X] T021 [US1] Crear `client/lib/screens/appointments/appointment_form_screen.dart` con selector de cliente y vehículo (filtrado por cliente), `showDatePicker`/`showTimePicker` nativos, motivo y observaciones, validación en español y `PopScope` con `_hayCambios` (patrón de los formularios del Sprint 1)

**Checkpoint**: User Story 1 completa y verificable por sí sola (CA-1)

---

## Phase 4: User Story 2 - Crear órdenes de servicio (Priority: P2)

**Goal**: Recepción crea órdenes con cliente, vehículo, kilometraje de entrada, mecánico asignado y problema reportado; aparecen en estado RECIBIDO

**Independent Test**: Crear una orden para cliente y vehículo existentes con su kilometraje y verla en el listado en estado RECIBIDO

### Tests for User Story 2

> **NOTE**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T022 [P] [US2] Prueba unitaria de kilometraje en `server/tests/unit/mileage-validation.test.js`: valor ≥ 0 aceptado como primer registro cuando `vehicles.current_mileage = 0`; menor que el previo → rechazo `MILEAGE_LOWER_THAN_PREVIOUS`; corrección de ADMIN con motivo ≥ 10 caracteres → aceptado; nombres y mensajes en español (RN-3, RN-4, CA-6)
- [X] T023 [P] [US2] Prueba de integración en `server/tests/integration/service-orders.test.js` contra `motorix_test`: alta 201 con estado `RECEIVED`, actualización de `vehicles.current_mileage`, vehículo inexistente → 404 `VEHICLE_NOT_FOUND` sin crear registro (RN-2), sin `vehicleId` → 400 `VEHICLE_REQUIRED`, `mechanicId` inexistente → 404 y rol no mecánico → 400 `INVALID_MECHANIC`, kilometraje menor → 400, listado con `?status`/`?q`
- [X] T024 [P] [US2] Prueba de contrato en `server/tests/contract/service-orders.contract.test.js`: sobre JSON, 201 en POST, códigos nuevos, 403 para MECHANIC en `POST /api/service-orders` y 401 sin token

### Implementation for User Story 2

- [X] T025 [P] [US2] Crear `server/models/service_order.model.js` con `insertar`, `buscarPorId`, `listar` (filtros `status`, `mechanicId`, `q` por cliente o placas, paginación) y `actualizar` de campos básicos
- [X] T026 [P] [US2] Crear `server/validators/service_orders.js` con zod para el alta y la edición base: `clientId`/`vehicleId`/`mechanicId`/`entryMileage`/`reportedProblem` obligatorios, `entryMileage` entero ≥ 0, `reportedProblem` ≤ 500, `mileageCorrectionReason` opcional ≥ 10 caracteres; mensajes en español
- [X] T027 [US2] Crear `server/services/service_orders.service.js` con la creación según VS-01 a VS-04 de `specs/002-citas-ordenes-servicio/data-model.md`: referencias existentes, mecánico activo con rol MECHANIC, kilometraje validado contra `vehicles.current_mileage` con corrección solo ADMIN, `reported_problem` obligatorio, actualización de `vehicles.current_mileage` al crear y estado inicial `RECEIVED` (depende de T004, T025, T026)
- [X] T028 [US2] Crear `server/controllers/service_orders.controller.js` con los manejadores de `GET /api/service-orders`, `GET /api/service-orders/{id}`, `POST` y `PATCH /{id}` según `specs/002-citas-ordenes-servicio/contracts/service-orders.md` (depende de T027)
- [X] T029 [US2] Crear `server/routes/service_orders.routes.js` con `authenticate` + autorización por endpoint (`POST`/`PATCH`: ADMIN y RECEPTIONIST; `GET`: los 3 roles) y registrarlo en `server/routes/index.js`
- [X] T030 [P] [US2] Crear `client/lib/models/service_order.dart` con `fromJson`/`toJson` y etiquetas de estado en español (Recibido, Diagnóstico, En reparación, Esperando refacción, Terminado, Entregado)
- [X] T031 [P] [US2] Prueba del provider en `client/test/service_orders_provider_test.dart`: carga de órdenes, crear orden, manejo de error `MILEAGE_LOWER_THAN_PREVIOUS` con mensaje en español
- [X] T032 [P] [US2] Prueba de widget en `client/test/order_form_test.dart`: campos obligatorios con validación en español, selección cliente → vehículo filtrado y salida con cambios sin guardar pide confirmación
- [X] T033 [US2] Ampliar `client/lib/services/api_client.dart` con los métodos de órdenes: listar, obtener, crear y editar según `contracts/service-orders.md`
- [X] T034 [US2] Crear `client/lib/providers/service_orders_provider.dart` con lista, filtros, crear, editar y estados de UI (depende de T030, T033)
- [X] T035 [US2] Registrar las rutas de órdenes en `client/lib/utils/app_route.dart` y agregar la entrada **Órdenes** en `client/lib/widgets/app_shell.dart`, visible para los 3 roles
- [X] T036 [US2] Crear `client/lib/screens/orders/order_list_screen.dart` con tabla (cliente, vehículo, mecánico, estado, problema), filtros, estados vacío/cargando/error con `states_view.dart` y acciones Ver y Nueva orden
- [X] T037 [US2] Crear `client/lib/screens/orders/order_form_screen.dart` con cliente, vehículo (filtrado por cliente), mecánico (solo usuarios con rol MECHANIC), kilometraje de entrada, problema reportado, validación en español de kilometraje y `PopScope` con `_hayCambios`

**Checkpoint**: User Story 2 completa: órdenes creadas y consultables (CA-2, CA-6)

---

## Phase 5: User Story 3 - Vincular cada orden con cliente y vehículo (Priority: P3)

**Goal**: Ninguna orden sobrevive con referencias inválidas y la relación orden ↔ vehículo se puede consultar desde el vehículo

**Independent Test**: Intentar crear una orden con un vehículo inexistente o de otro cliente → rechazada sin crear registro; con un vehículo válido → la orden aparece asociada al consultarlo desde el vehículo

### Tests for User Story 3

- [X] T038 [P] [US3] Prueba de integración en `server/tests/integration/order-link.test.js`: vehículo de otro cliente → 400 `VEHICLE_CLIENT_MISMATCH`, sin `clientId` → 400 `CLIENT_REQUIRED`, con `?vehicleId=` solo devuelve las órdenes de ese vehículo, RN-2 rechazado sin registro (depende de T023 como base del entorno de órdenes)
- [X] T039 [P] [US3] Prueba de contrato en `server/tests/contract/order-link.contract.test.js`: `GET /api/service-orders?vehicleId=` con sobre y paginación; `VEHICLE_CLIENT_MISMATCH` con `error.message` en español

### Implementation for User Story 3

- [X] T040 [US3] Incorporar la regla de propiedad en `server/services/service_orders.service.js`: el vehículo debe existir y pertenecer al cliente (`VEHICLE_CLIENT_MISMATCH`, VS-01/VA-03) tanto en alta como en edición (depende de T027)
- [X] T041 [US3] Agregar el filtro `vehicleId` a `listar` en `server/models/service_order.model.js` y al query en `server/routes/service_orders.routes.js`; documentar `?vehicleId=` en `specs/002-citas-ordenes-servicio/contracts/service-orders.md`
- [X] T042 [US3] Agregar la acción «Ver órdenes» en `client/lib/screens/vehicles/vehicle_list_screen.dart` que navega a `client/lib/screens/orders/order_list_screen.dart` filtrada por vehículo (parámetro en `service_orders_provider.dart`)
- [X] T043 [P] [US3] Prueba Flutter en `client/test/vehicle_orders_filter_test.dart`: el filtro por vehículo carga solo las órdenes de ese vehículo y el estado vacío se muestra cuando no tiene órdenes

**Checkpoint**: User Story 3 completa: integridad cliente ↔ vehículo ↔ orden verificada

---

## Phase 6: User Story 4 - Consultar las órdenes asignadas (Priority: P4)

**Goal**: El mecánico ve exactamente las órdenes que tiene asignadas, con su detalle en modo lectura

**Independent Test**: Iniciar sesión como mecánico y comprobar que el listado muestra solo sus órdenes; un GET directo a una orden ajena responde 403

### Tests for User Story 4

- [X] T044 [P] [US4] Prueba de integración en `server/tests/integration/mechanic-scope.test.js` contra `motorix_test`: MECHANIC lista solo sus órdenes (`WHERE mechanic_id`), detalle de orden ajena → 403 `FORBIDDEN` (no 404), ADMIN y RECEPTIONIST listan todas, `?mechanicId` ajeno ignorado para MECHANIC (CA-3)
- [X] T045 [P] [US4] Prueba de contrato en `server/tests/contract/mechanic-scope.contract.test.js`: `GET /api/service-orders` como MECHANIC devuelve `total` solo de las suyas y `GET /{id}` ajeno → 403 con sobre de error en español

### Implementation for User Story 4

- [X] T046 [US4] Implementar el aislamiento R-07 en `server/services/service_orders.service.js` y `server/models/service_order.model.js`: para rol MECHANIC forzar `WHERE mechanic_id = <usuario del token>` en listado y detalle, y responder 403 `FORBIDDEN` ante un id ajeno (depende de T027, T025)
- [X] T047 [US4] Crear `client/lib/screens/orders/order_detail_screen.dart` en modo lectura (cliente, vehículo, mecánico, kilometraje, problema, estado, servicios y mano de obra si existen), registrar su ruta en `client/lib/utils/app_route.dart` y enlazarla desde `client/lib/screens/orders/order_list_screen.dart`
- [X] T048 [US4] Ajustar `client/lib/screens/orders/order_list_screen.dart` y `client/lib/providers/service_orders_provider.dart` por rol: para MECHANIC mostrar etiqueta «Solo mis órdenes», ocultar «Nueva orden» y mostrar estado vacío con mensaje y acción sugerida con `states_view.dart`
- [X] T049 [P] [US4] Prueba Flutter en `client/test/mechanic_orders_scope_test.dart`: la lista del mecánico muestra su etiqueta, no ofrece alta de órdenes y el estado vacío muestra el mensaje en español

**Checkpoint**: User Story 4 completa: CA-3 y SC-004 cumplidos

---

## Phase 7: User Story 5 - Registrar diagnósticos y servicios realizados (Priority: P5)

**Goal**: El mecánico documenta su trabajo en la orden: diagnóstico, servicios realizados y mano de obra

**Independent Test**: Abrir una orden asignada, escribir el diagnóstico, agregar servicios con precio y mano de obra con horas/tarifa, reabrir la orden y ver todo persistido

### Tests for User Story 5

- [X] T050 [P] [US5] Prueba de integración en `server/tests/integration/order-work.test.js` contra `motorix_test`: diagnóstico 200, alta de servicios 201 y mano de obra 201, baja con 200, campos vacíos → 400 `VALIDATION_ERROR`, `hours` ≤ 0 → 400, RECEPTIONIST → 403, MECHANIC de orden ajena → 403 (CA-4)
- [X] T051 [P] [US5] Prueba de contrato en `server/tests/contract/order-work.contract.test.js`: `POST/DELETE .../services` y `.../labor` según `contracts/service-orders.md`, `ORDER_DELIVERED` en orden entregada para rol distinto de ADMIN

### Implementation for User Story 5

- [X] T052 [P] [US5] Crear `database/migrations/006_create_order_services.sql` con `order_services` según `data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `order_id` INT UNSIGNED NOT NULL FK → `service_orders.id` RESTRICT; `description` VARCHAR(200) NOT NULL; `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0; `created_at` DATETIME; índice `order_id`; InnoDB `utf8mb4`
- [X] T053 [P] [US5] Crear `database/migrations/007_create_order_labor.sql` con `order_labor` según `data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `order_id` INT UNSIGNED NOT NULL FK → `service_orders.id` RESTRICT; `concept` VARCHAR(200) NOT NULL; `hours` DECIMAL(6,2) NOT NULL; `hourly_rate` DECIMAL(10,2) NOT NULL DEFAULT 0; `created_at` DATETIME; índice `order_id`; InnoDB `utf8mb4`
- [X] T054 [US5] Ejecutar `database/scripts/aplicar-migraciones.ps1` y verificar `schema_migrations` con `006` y `007`; re-ejecutar para confirmar idempotencia
- [X] T055 [P] [US5] Crear `server/models/order_service.model.js` con `insertar`, `listarPorOrden`, `eliminar`
- [X] T056 [P] [US5] Crear `server/models/order_labor.model.js` con `insertar`, `listarPorOrden`, `eliminar`
- [X] T057 [US5] Ampliar `server/services/service_orders.service.js`: registrar `diagnosis` (≤ 1000), agregar y eliminar servicios (`description` ≤ 200, `unitPrice` ≥ 0) y mano de obra (`concept` ≤ 200, `hours` > 0 y ≤ 999.99, `hourlyRate` ≥ 0) según VS-06, con permisos R-06 y 400 `ORDER_DELIVERED` para rol distinto de ADMIN (depende de T055, T056)
- [X] T058 [US5] Ampliar `server/controllers/service_orders.controller.js` y `server/routes/service_orders.routes.js` con `PATCH /{id}/work` (solo `diagnosis` en esta fase), `POST/DELETE /{id}/services[/{serviceId}]` y `POST/DELETE /{id}/labor[/{laborId}]`, con `authenticate` y autorización por endpoint
- [X] T059 [P] [US5] Crear `client/lib/models/order_item.dart` con `ServiceOrderItem` y `LaborOrderItem` (`fromJson`/`toJson`, montos como `double`)
- [X] T060 [P] [US5] Prueba de widget en `client/test/order_detail_test.dart`: el detalle muestra diagnóstico guardado, lista de servicios y de mano de obra, y el botón de eliminar servicio pide confirmación con «Confirmar»
- [X] T061 [US5] Ampliar `client/lib/services/api_client.dart` y `client/lib/providers/service_orders_provider.dart` con diagnóstico, servicios y mano de obra (agregar, eliminar con confirmación) (depende de T059)
- [X] T062 [US5] Ampliar `client/lib/screens/orders/order_detail_screen.dart` con las secciones de Diagnóstico, Servicios realizados y Mano de obra: altas con formulario inline, bajas con `confirm_dialog.dart`, validación en español y deshabilitar el botón mientras guarda (depende de T047, T061)

**Checkpoint**: User Story 5 completa: CA-4 cumplido con datos persistidos

---

## Phase 8: User Story 6 - Cambiar el estado de la orden (Priority: P6)

**Goal**: El mecánico avanza la orden por la secuencia permitida y cualquier transición inválida se rechaza

**Independent Test**: Tomar una orden en RECIBIDO, avanzarla hasta TERMINADO y comprobar que un salto o retroceso se rechaza con mensaje en español

### Tests for User Story 6

> Estas pruebas son el cumplimiento directo de **CA-8** y **SC-003**

- [X] T063 [P] [US6] Prueba unitaria en `server/tests/unit/order-transitions.test.js`: todas las transiciones permitidas (`RECEIVED → DIAGNOSIS`, `DIAGNOSIS → IN_REPAIR | WAITING_PART`, `IN_REPAIR → FINISHED | WAITING_PART`, `WAITING_PART → waiting_origin`, `FINISHED → DELIVERED`) y rechazadas (saltos, retrocesos, salida de `DELIVERED`); nombres y mensajes en español
- [X] T064 [P] [US6] Prueba de integración en `server/tests/integration/order-status.test.js` contra `motorix_test`: flujo completo 200, salto inválido → 400 `INVALID_STATUS_TRANSITION`, regreso desde `WAITING_PART` al origen, RECEPTIONIST → 403, MECHANIC de orden ajena → 403, ADMIN en cualquier orden → 200 (CA-5)
- [X] T065 [P] [US6] Prueba de contrato en `server/tests/contract/order-status.contract.test.js`: `PATCH /api/service-orders/{id}/status` con sobre `{ok,data}`, códigos 400/403 y mensaje en español

### Implementation for User Story 6

- [X] T066 [US6] Implementar la máquina de estados R-02 en `server/services/service_orders.service.js`: mapa de transiciones con `waiting_origin` (guardar origen al entrar a `WAITING_PART` y restaurarlo al salir), rechazo con 400 `INVALID_STATUS_TRANSITION` y permisos (ADMIN cualquiera, MECHANIC solo las suyas, RECEPTIONIST 403) (depende de T027)
- [X] T067 [US6] Agregar `PATCH /api/service-orders/{id}/status` en `server/controllers/service_orders.controller.js` y `server/routes/service_orders.routes.js` con `validate` del estado y autorización por endpoint
- [X] T068 [US6] Ampliar `client/lib/screens/orders/order_detail_screen.dart` con los controles de estado: botón «Cambiar estado» con los siguientes estados válidos según el actual, etiquetas en español, ESPERANDO_REFACCION incluido y confirmación con `confirm_dialog.dart` antes de aplicar (depende de T066, T067)
- [X] T069 [P] [US6] Prueba Flutter en `client/test/order_status_test.dart`: el detalle ofrece solo las transiciones válidas para la orden y el rol, y oculta el control para RECEPTIONIST

**Checkpoint**: User Story 6 completa: CA-5 y CA-8 cumplidos

---

## Phase 9: User Story 7 - Agregar observaciones y recomendaciones (Priority: P7)

**Goal**: El mecánico deja constancia del estado del vehículo en la orden

**Independent Test**: Agregar observaciones y recomendaciones a una orden asignada y reabrir la orden para verlas persistidas

### Tests for User Story 7

- [X] T070 [P] [US7] Prueba de integración en `server/tests/integration/order-notes.test.js` contra `motorix_test`: guardar observaciones y recomendaciones 200 y persisten al reabrir, texto > 1000 → 400, RECEPTIONIST → 403, orden `DELIVERED` con rol distinto de ADMIN → 400 `ORDER_DELIVERED`
- [X] T071 [P] [US7] Prueba de contrato en `server/tests/contract/order-notes.contract.test.js`: `PATCH /api/service-orders/{id}/work` con `observations`/`recommendations` según `contracts/service-orders.md`

### Implementation for User Story 7

- [X] T072 [US7] Ampliar `server/services/service_orders.service.js` y `server/validators/service_orders.js` para aceptar `observations` y `recommendations` (≤ 1000 caracteres cada uno, ≥ 1 campo obligatorio, reglas de rol y `ORDER_DELIVERED` de VS-07) en el mismo `PATCH /{id}/work` (depende de T057)
- [X] T073 [US7] Ampliar `client/lib/screens/orders/order_detail_screen.dart` con la sección «Observaciones y recomendaciones»: dos áreas de texto con validación en español, guardar con confirmación de éxito y edición posterior (depende de T062)
- [X] T074 [P] [US7] Prueba Flutter en `client/test/order_notes_test.dart`: guardar notas en la orden, mostrarlas al reabrir y bloquear el guardado con campos vacíos

**Checkpoint**: User Story 7 completa; US2 a US7 cubren todo el flujo demostrable

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras transversales, datos de ejemplo y validación final

- [X] T075 [P] Ampliar `server/scripts/seed.js` con datos de ejemplo idempotentes del sprint (~4 citas en distintos estados y ~3 órdenes asignadas a los mecánicos, con servicios y mano de obra) referenciando clientes, vehículos y usuarios existentes; ejecutar `npm run seed` dos veces y comprobar que la segunda crea 0 registros (SC-007, Principio III)
- [X] T076 [P] Actualizar `database/README.md` con las migraciones `004`–`007`, sus tablas y el orden de aplicación
- [X] T077 [P] Actualizar `docs/project-context.md` para dejar constancia de las decisiones nuevas del Sprint 2 (asignación manual de mecánico, estados con `waiting_origin`, sin vínculo cita↔orden, cancelación desde estado activo) — trazabilidad del Principio I
- [X] T078 [P] Actualizar `README.md` en la raíz con los módulos y pantallas del Sprint 2 si enumera funcionalidades
- [X] T079 Auditoría de seguridad en `server/`: `.env` ignorado y `.env.example` sin secretos, 500 sin trazas en los endpoints nuevos, permisos RN-15 en todas las rutas de citas y órdenes, mensajes de error en español, sin credenciales en las pruebas
- [X] T080 Revisión de diseño en `client/lib/screens/appointments/` y `client/lib/screens/orders/` contra `docs/design-system.md`: tokens (sin valores sueltos), estados vacío/cargando/error/éxito, confirmaciones obligatorias («Confirmar»/«Cancelar»), transiciones de 250 ms y PopScope en los formularios
- [X] T081 Ejecutar los escenarios V1 a V10 de `specs/002-citas-ordenes-servicio/quickstart.md` y registrar los resultados en `specs/002-citas-ordenes-servicio/quickstart-resultados.md` (incluye el recorrido del flujo demostrable en < 5 min, SC-001)
- [X] T082 Verificación final: `npm run lint` y `npm test` en `server/` (todo verde), `flutter analyze` sin problemas y `flutter test` en `client/` (todo verde)
- [X] T083 Revisar y marcar los criterios CA-1 a CA-8 de `docs/sprints/sprint-2-citas-ordenes.md` como cumplidos, con evidencia del quickstart y de las pruebas

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; se ejecuta primero
- **Foundational (Phase 2)**: depende de Setup; **BLOQUEA todas las historias**
- **User Stories (Phase 3–9)**: todas dependen de Foundational
  - Orden recomendado por prioridad: US1 → US2 → US3 → US4 → US5 → US6 → US7
  - US1 (citas) es completamente independiente de las órdenes: puede ejecutarse en paralelo con US2
  - US3 depende de US2 (edita la creación y el listado de órdenes)
  - US4 depende de US2 (consume `GET /{id}` y el listado); su pantalla detalle es base de US5–US7
  - US5 depende de US2/US4 (añade trabajo a la orden y secciones al detalle)
  - US6 depende de US2 (backend) y de US5 para la UI del detalle
  - US7 depende de US5 (mismo endpoint `PATCH /{id}/work` y misma pantalla)
- **Polish (Phase 10)**: depende de todas las historias deseadas

### Within Each User Story

- Pruebas primero (deben fallar) → modelos → servicios → controladores/rutas → frontend (modelo → api → provider → pantallas) → pruebas Flutter
- Historia completa antes de pasar a la siguiente prioridad

### Archivos compartidos (cuidado al paralelizar historias)

`client/lib/services/api_client.dart`, `client/lib/utils/app_route.dart`, `client/lib/widgets/app_shell.dart`, `server/routes/index.js`, `server/services/service_orders.service.js`, `server/controllers/service_orders.controller.js`, `server/routes/service_orders.routes.js`, `client/lib/screens/orders/order_detail_screen.dart`

- Si dos historias trabajan a la vez, que una persona edite cada archivo compartido; el resto de tareas [P] son seguras en paralelo

### Parallel Opportunities

- **Setup**: T002 (con T001 en paralelo si se desea)
- **Foundational**: T003 + T004 (archivos distintos)
- **US1**: T006 + T007 + T008 (pruebas backend) ∥ T009 + T010 (modelo/validador) ∥ T014 + T015 + T016 (frontend)
- **US2**: T022 + T023 + T024 ∥ T025 + T026 ∥ T030 + T031 + T032
- **US3**: T038 + T039 ∥ T043
- **US4**: T044 + T045 ∥ T049
- **US5**: T050 + T051 ∥ T052 + T053 + T055 + T056 ∥ T059 + T060
- **US6**: T063 + T064 + T065 ∥ T069
- **US7**: T070 + T071 ∥ T074
- **Polish**: T075 + T076 + T077 + T078 (documentación y seeds en paralelo)

---

## Parallel Example: User Story 1

```bash
# Lanzar juntas las pruebas de US1 (archivos distintos):
Tarea: "Prueba unitaria de la máquina de estados de citas en server/tests/unit/appointment-transitions.test.js"
Tarea: "Prueba de integración en server/tests/integration/appointments.test.js"
Tarea: "Prueba de contrato en server/tests/contract/appointments.contract.test.js"

# Lanzar juntos modelo y validador (sin dependencias entre sí):
Tarea: "Crear server/models/appointment.model.js"
Tarea: "Crear server/validators/appointments.js"

# Lanzar juntos el modelo Flutter y sus pruebas:
Tarea: "Crear client/lib/models/appointment.dart"
Tarea: "Prueba del provider en client/test/appointments_provider_test.dart"
```

---

## Implementation Strategy

### MVP primero (solo User Story 1)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO — bloquea todas las historias)
3. Completar Phase 3: User Story 1 (citas)
4. **PARAR y VALIDAR**: probar US1 de forma independiente (CA-1)
5. Demostrar/desplegar si está listo

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 (citas) → probar → demo (**MVP**)
3. US2 (crear órdenes) → probar → demo (ya es el flujo del taller)
4. US3 + US4 (vínculos y vista del mecánico) → probar → demo
5. US5 → US6 → US7 → flujo completo del sprint (SC-001)
6. Polish → validación del quickstart y pruebas en verde

### Estrategia en equipo paralelo

1. El equipo completa Setup + Foundational juntos
2. Después: desarrollador A → US1 (citas); desarrollador B → US2 (órdenes)
3. Luego en cadena: US3/US4 sobre las órdenes, y US5 → US6 → US7 (comparten archivos)
4. Todos terminan con Polish y la validación del quickstart

---

## Notes

- Las tareas [P] usan archivos distintos y no dependen de tareas incompletas
- La etiqueta [Story] da trazabilidad requisito → historia → tarea (Principio I)
- Cada historia debe poder probarse de forma independiente en su checkpoint
- Verificar que las pruebas fallen antes de implementar (rojo → verde)
- Commits pequeños y en español tras cada tarea o grupo lógico
- Si una tarea revela un conflicto con el spec, detenerse y aclarar antes de continuar
