# Investigación — Sprint 2: Citas y órdenes de servicio

**Fecha**: 2026-10-14
**Rama**: `002-citas-ordenes-servicio`

Fuentes consultadas: `.specify/memory/constitution.md`, `docs/project-context.md`
(secciones 6.3, 6.4, 16, 24–27), `docs/design-system.md`,
`docs/sprints/sprint-2-citas-ordenes.md` y las aclaraciones del spec (sesión
2026-10-14: Q1 estados, Q2 asignación, Q3 cancelación).

Todas las incógnitas del Contexto Técnico quedan resueltas en esta fase: **0
`NEEDS CLARIFICATION` pendientes** (el stack se hereda completo del Sprint 1).

## Decisiones

### R-01. Esquema del sprint: migraciones nuevas 004–007

- **Decisión**: cuatro scripts SQL numerados e inmutables en `database/migrations/`:
  `004_create_appointments.sql`, `005_create_service_orders.sql`,
  `006_create_order_services.sql` y `007_create_order_labor.sql`; se aplican con
  `aplicar-migraciones.ps1` y quedan registrados en `schema_migrations`.
- **Justificación**: Principio III (scripts numerados e inmutables, nada ya aplicado
  se edita); `order_services` y `order_labor` dependen de `service_orders`, por lo que
  van en scripts posteriores.
- **Alternativas consideradas**: un solo script con las 4 tablas (descartado: pierde
  granularidad de aplicación); editar un script del Sprint 1 (prohibido por la
  constitución).

### R-02. Máquina de estados de la orden en `services/`, con `waiting_origin`

- **Decisión**: la columna `status` usa
  `ENUM('RECEIVED','DIAGNOSIS','IN_REPAIR','WAITING_PART','FINISHED','DELIVERED')` y
  la tabla de transiciones vive en `server/services/service_orders.service.js`
  (lógica de negocio en `services/`, Principio II):
  `RECEIVED → DIAGNOSIS`; `DIAGNOSIS → IN_REPAIR | WAITING_PART`;
  `IN_REPAIR → FINISHED | WAITING_PART`; `WAITING_PART → waiting_origin`;
  `FINISHED → DELIVERED`; `DELIVERED` sin salidas. La columna
  `waiting_origin ENUM('DIAGNOSIS','IN_REPAIR') NULL` recuerda desde dónde se entró
  a espera de refacción para regresar exactamente a ese estado (Q1). Sin retrocesos.
- **Justificación**: Q1 (2026-10-14) fija avance lineal sin retrocesos y regreso al
  estado de origen; CA-5 y CA-8 exigen rechazar transiciones inválidas con pruebas.
- **Alternativas consideradas**: tabla `order_status_history` (descartada: trazabilidad
  de cambios no está en el alcance); triggers o procedimientos almacenados (descartados:
  la lógica de negocio debe vivir en el backend); estados como columnas booleanas
  (descartado: no modela exclusión mutua).

### R-03. Asignación manual de mecánico (`mechanic_id` NOT NULL)

- **Decisión**: `mechanic_id INT UNSIGNED NOT NULL` FK → `users.id`; lo eligen
  recepción o administrador al crear la orden y pueden reasignarlo con PATCH; el
  backend exige que el usuario exista, esté activo y tenga rol MECHANIC
  (`MECHANIC_REQUIRED` 400, `MECHANIC_NOT_FOUND` 404, `INVALID_MECHANIC` 400). El
  mecánico no se autoasigna.
- **Justificación**: Q2 (2026-10-14); coincide con el flujo del sprint
  («crear orden → asignar orden a mecánico») y con US4/CA-4.
- **Alternativas consideradas**: asignación automática por menor carga (descartada en
  Q2: exige reglas de disponibilidad fuera de alcance); híbrida con sugerencia
  (descartada en Q2: agrega lógica y UI sin pedirse).

### R-04. Citas: estados propios y sin vínculo con órdenes

- **Decisión**: `appointments` con
  `ENUM('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELED')` y fecha/hora en
  columnas `DATE` + `TIME`. Transiciones: `PENDING → CONFIRMED | IN_PROGRESS`;
  `CONFIRMED → IN_PROGRESS`; `IN_PROGRESS → COMPLETED`; cualquiera de los activos
  `→ CANCELED` con confirmación (Q3); sin retrocesos ni reactivación. **No existe
  `appointment_id` en `service_orders`** (Q3): cancelar una cita no afecta órdenes.
- **Justificación**: estados de `docs/project-context.md` 6.3, FR-004/FR-005 y Q3
  (2026-10-14); el spec prohíbe el borrado, así que cancelar solo cambia estado.
- **Alternativas consideradas**: vínculo cita→orden opcional u obligatorio (descartados
  en Q3); tabla de citas con campos datetime compactos (descartado: la agenda se
  consulta por día y separar fecha/hora simplifica filtros e índices).

### R-05. Kilometraje de entrada: validación contra el vehículo y corrección solo de ADMIN

- **Decisión**: `entry_mileage` se valida contra `vehicles.current_mileage`; si es
  menor → 400 `MILEAGE_LOWER_THAN_PREVIOUS`, salvo que quien envía sea ADMIN **y**
  incluya `mileageCorrectionReason` (mínimo 10 caracteres) → se guarda el motivo en
  `service_orders.mileage_correction_reason` y se aplica la corrección (RN-4). Si el
  vehículo nunca registró kilometraje (`current_mileage = 0`), se acepta cualquier
  valor ≥ 0. Al crear la orden se actualiza `vehicles.current_mileage` con el valor
  capturado, de modo que la siguiente visita valide contra el último conocido.
- **Justificación**: RN-3/RN-4, CA-6, supuestos del spec (primer registro ≥ 0;
  corrección explícita reservada a administrador con motivo escrito).
- **Alternativas consideradas**: tomar el máximo de órdenes previas (descartado: dos
  fuentes de verdad para el mismo dato); tabla de historial de kilometrajes (descartada:
  el historial del vehículo es Sprint 4); autocorrección libre (descartada: viola RN-4).

### R-06. Matriz de permisos del Sprint 2 (evaluada en backend)

- **Decisión** (middleware `authenticate` + `authorize` existentes):

| Recurso | ADMIN | RECEPTIONIST | MECHANIC |
|---------|-------|--------------|----------|
| Citas: listar, ver, crear, editar, cancelar | sí | sí | **403** (no gestiona citas) |
| Órdenes: listar/ver | sí (todas) | sí (todas) | **solo las suyas** |
| Órdenes: crear y reasignar mecánico | sí | sí | **403** |
| Órdenes: cambiar estado | sí | **403** (solo consulta y crea) | sí (solo las suyas) |
| Órdenes: diagnóstico, servicios, mano de obra, observaciones | sí | **403** | sí (solo las suyas) |

- **Justificación**: FR-017, Q1 (recepción no cambia estados), Q3 (mecánico no toca
  citas), CA-7/RN-15: todo se valida en backend, no ocultando botones.
- **Alternativas consideradas**: permisos por endpoint con roles múltiples en la
  ruta (mismo mecanismo, se decide por endpoint la lista de roles); permisos
  granulares por usuario (descartado: 3 roles fijos).

### R-07. Aislamiento de las órdenes del mecánico en la consulta SQL

- **Decisión**: para rol MECHANIC el modelo añade siempre
  `WHERE mechanic_id = <usuario del token>` en listado y detalle; un id ajeno
  responde 403 `FORBIDDEN`, no 404 (no se revela existencia de órdenes ajenas).
- **Justificación**: CA-3/US4 «el mecánico ve únicamente las órdenes que tiene
  asignadas»; la constitución exige validación en backend, no en la interfaz.
- **Alternativas consideradas**: filtrar solo en el frontend (descartado: viola
  CA-7/RN-15); devolver 404 para ids ajenos (descartado: 403 es más claro y ya es el
  patrón de `authorize` del Sprint 1).

### R-08. Solapamiento de citas permitido

- **Decisión**: no se bloquean dos citas con el mismo vehículo, cliente u horario;
  la agenda muestra todas y el usuario decide.
- **Justificación**: supuesto documentado en el spec (decisión consciente de alcance).
- **Alternativas consideradas**: bloqueo de conflicto con 409 (descartado: no está
  requerido y añade reglas de agenda).

### R-09. Fechas y horas: `DATE`/`TIME` en la base, ISO en la API, pickers nativos

- **Decisión**: `appointment_date DATE` y `appointment_time TIME`; en JSON se envían
  como `YYYY-MM-DD` y `HH:MM`; se comparan con la hora local del equipo. El frontend
  usa `showDatePicker`/`showTimePicker` nativos de Flutter (sin dependencia nueva).
- **Justificación**: MVP local de un solo huso horario; Principio VIII sin dependencias
  nuevas para lo que resuelven los widgets nativos.
- **Alternativas consideradas**: `DATETIME` único (descartado: el filtro diario de
  agenda y las pruebas son más simples con fecha y hora separadas); librerías de
  fechas/moment (descartadas: dependencia innecesaria).

### R-10. Seeds del sprint: citas y órdenes idempotentes

- **Decisión**: ampliar `server/scripts/seed.js` con datos de ejemplo: ~4 citas en
  distintos estados y fechas, ~3 órdenes (una por mecánico de ejemplo) con servicios y
  mano de obra, referenciando clientes, vehículos y usuarios ya sembrados; sin
  duplicados al re-ejecutar (`npm run seed` dos veces → 0 creados la segunda).
- **Justificación**: Principio III (la app nunca arranca vacía), restricción de
  idempotencia del insumo y SC-007.
- **Alternativas consideradas**: script de seeds separado por sprint (descartado:
  duplicaría la lógica de idempotencia ya resuelta en el Sprint 1).

### R-11. Pantallas, navegación y estado: nuevas secciones en el rail

- **Decisión**: se agregan al `NavigationRail` las entradas **Citas** (visible para
  ADMIN y RECEPTIONIST) y **Órdenes** (visible para los 3 roles); pantallas
  `screens/appointments/` (lista + formulario) y `screens/orders/` (lista, formulario
  de alta y detalle con diagnóstico, servicios, mano de obra, estados y observaciones);
  providers `appointments_provider.dart` y `service_orders_provider.dart`; modelos
  `appointment.dart`, `service_order.dart`, `order_item.dart`; rutas nuevas con el
  patrón `AppRoute`/`transicionPantalla()` existente y reutilización de
  `states_view.dart`, `confirm_dialog.dart` y las tablas ya creadas. **Sin
  dependencias nuevas** en `pubspec.yaml`.
- **Justificación**: Principio VIII (mismo sistema de diseño y tokens), FR-019 y la
  navegación definida en Q1 del Sprint 1 (rail lateral).
- **Alternativas consideradas**: secciones dentro de Inicio (descartado: crece rápido
  y rompe la navegación existente); pestañas superiores (descartado: ya se resolvió
  rail lateral en el Sprint 1).

### R-12. Superficie de API y códigos de error nuevos

- **Decisión**: sobre el sobre JSON y los middlewares existentes:
  `GET/POST /api/appointments`, `GET/PATCH /api/appointments/{id}` (el estado, incluida
  la cancelación, se cambia en el PATCH con validación de transición);
  `GET/POST /api/service-orders`, `GET/PATCH /api/service-orders/{id}`,
  `PATCH .../{id}/status`, `PATCH .../{id}/work` (diagnóstico, observaciones,
  recomendaciones), `POST/DELETE .../{id}/services[/{serviceId}]` y
  `POST/DELETE .../{id}/labor[/{laborId}]`. Códigos nuevos:
  `APPOINTMENT_NOT_FOUND` (404), `SERVICE_ORDER_NOT_FOUND` (404),
  `ORDER_ITEM_NOT_FOUND` (404), `VEHICLE_REQUIRED` (400),
  `VEHICLE_CLIENT_MISMATCH` (400), `MECHANIC_REQUIRED` (400),
  `MECHANIC_NOT_FOUND` (404), `INVALID_MECHANIC` (400),
  `MILEAGE_LOWER_THAN_PREVIOUS` (400), `INVALID_STATUS_TRANSITION` (400),
  `APPOINTMENT_CLOSED` (400), `ORDER_DELIVERED` (400). Reutiliza
  `VALIDATION_ERROR`, `FORBIDDEN`, `CLIENT_REQUIRED`, `CLIENT_NOT_FOUND`,
  `VEHICLE_NOT_FOUND`, `UNAUTHORIZED` e `INTERNAL_ERROR`.
- **Justificación**: Principio VI (rutas coherentes, códigos apropiados) y el patrón
  de contrato del Sprint 1; `PATCH` con `status` evita un endpoint por recurso.
- **Alternativas consideradas**: `POST .../cancel` solo para citas (descartado: la
  cancelación ya es una transición de estado y un endpoint dedicado duplicaría la
  validación); `DELETE /api/service-orders/{id}` (descartado: RN-9 prohíbe el borrado
  ordinario de órdenes).

### R-13. Pruebas del Sprint 2

- **Decisión**:
  - Unit (`server/tests/unit/`): `order-transitions.test.js` (todas las transiciones
    permitidas y rechazadas, incluido el regreso desde `WAITING_PART`),
    `appointment-transitions.test.js` y `mileage-validation.test.js`.
  - Integración (`server/tests/integration/`): `appointments.test.js` y
    `service-orders.test.js` contra `motorix_test` (CRN-2/RN-3/RN-4, permisos,
    aislamiento CA-3).
  - Contrato (`server/tests/contract/`): `appointments.contract.test.js` y
    `service-orders.contract.test.js` (sobre JSON, códigos y roles por endpoint).
  - Frontend (`client/test/`): providers de citas y órdenes, visibilidad de acciones
    por rol y validación de formularios. Nombres y mensajes de aserción en español.
- **Justificación**: Principio VII (toda lógica de negocio — transiciones, kilometraje,
  permisos — debe tener pruebas) y CA-8.
- **Alternativas consideradas**: E2E automatizado con Playwright/Cypress (descartado:
  fuera del alcance definido en el Sprint 1; la validación E2E es el quickstart).

## Pendientes fuera de esta fase

- Actualizar `docs/project-context.md` si el equipo desea reflejar las decisiones
  nuevas (sin vínculo cita↔orden, asignación manual, `waiting_origin`) — trazabilidad
  del Principio I al momento de implementar.
- No hay incógnitas técnicas abiertas: **0 `NEEDS CLARIFICATION`**.
