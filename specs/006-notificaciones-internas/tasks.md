---
description: "Lista de tareas del sprint 6: notificaciones internas"
---

# Tareas: Notificaciones internas (Sprint 6)

**Input**: Documentos de diseño en `/specs/006-notificaciones-internas/`

**Prerrequisitos**: plan.md (obligatorio), spec.md (historias de usuario), research.md, data-model.md, contracts/, quickstart.md

**Pruebas**: se incluyen porque el propio spec las exige (**FR-013**: «DEBEN existir y pasar pruebas automatizadas del cálculo de cada aviso, de los permisos por rol, de la lectura por usuario y del rendimiento de la consulta», y **SC-007** exige la regresión completa). Se escriben **antes** de la implementación de su historia y deben fallar primero.

**Organización**: las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Historia]**: historia de usuario a la que pertenece (US1, US6, US2, US3, US4, US5, US7)
- Ruta de archivo exacta en cada descripción

## Convenciones de ruta

- Monorepo de tres carpetas: `server/` (Node.js ES Modules), `client/` (Flutter) y `database/` (migraciones)
- Pruebas del backend en `server/tests/{unit,integration,contract}/`; pruebas de frontend en `client/test/`
- Todo texto visible al usuario y nombres de pruebas en español; identificadores de código en inglés

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: condiciones de entrada del sprint y punto de partida verificable

- [x] T001 Registrar la enmienda de la constitución antes de implementar (puerta I del plan): actualizar `.specify/memory/constitution.md` (alcance de 5 a 7 sprints —se añaden los sprints 6 y 7—, versión 1.1.0 → 1.2.0 y reporte de impacto en el encabezado, igual que la enmienda del Sprint 5) y dejar constancia del criterio de entrada en `docs/aseguramiento-calidad-sprint-6.md` (sección 2; crear el archivo con esa sección si no existe) — **criterio de entrada: nada de código hasta aquí** — **ejecutada**: 2026-11-18, commit `eb22526`
- [x] T002 Crear e ingresar a la rama `006-notificaciones-internas` desde `main` en la raíz del repositorio (sin squash ni force-push durante todo el sprint, según `Trabajo.md`) — **ejecutada**: rama creada y pusheada el 2026-11-05
- [x] T003 [P] Verificar que la rama arranca con la línea base verde: `cd server && npm.cmd test`, y en `client/` `flutter test` y `flutter analyze lib`; anotar conteos y fecha en `docs/aseguramiento-calidad-sprint-6.md` (sección de línea base) — **ejecutada**: 2026-11-22, backend 51 suites / 423 pruebas, frontend 128 pruebas + analyze sin observaciones

---

## Fase 2: Fundacional (bloqueante para todas las historias)

**Propósito**: esquema y datos del sprint. **CRÍTICO**: ninguna historia puede comenzar hasta completar esta fase

- [x] T004 Crear la migración aditiva `database/migrations/015_notifications.sql` con: tabla `notification_reads` (`id INT UNSIGNED PK AUTO_INCREMENT`, `user_id INT UNSIGNED NOT NULL` FK → `users` `ON DELETE CASCADE`, `notification_key VARCHAR(100) NOT NULL`, `read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, `UNIQUE KEY uq_notification_reads_user_key (user_id, notification_key)`) y tabla `client_notices` (`id`, `client_id` FK → `clients` `RESTRICT`, `notice_type VARCHAR(40) NOT NULL`, `source_id INT UNSIGNED NOT NULL`, `notes VARCHAR(300) NULL`, `notified_by` FK → `users` `RESTRICT`, `notified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, `UNIQUE KEY uq_client_notices_source (client_id, notice_type, source_id)`, `KEY idx_client_notices_client (client_id)`) — data-model.md, P-8/P-9; sin `order_status_history` (no existe, P-3) — **ejecutada**: 2026-11-22
- [x] T005 [P] Documentar la migración 015 en `database/README.md` (propósito, las dos tablas, claves únicas y su rol: lectura por usuario / aviso a cliente) — **ejecutada**: 2026-11-22
- [x] T006 Aplicar las migraciones a la base principal y a `motorix_test` con `database/scripts/aplicar-migraciones.ps1` y verificar en `schema_migrations` el registro de `015_notifications`, además de las dos claves únicas y las FK en `information_schema` — **ejecutada**: 2026-11-22, ambas bases + unique keys y FK (CASCADE/RESTRICT) verificadas
- [x] T007 Crear `server/models/notification_read.model.js` con `leidasDe(user_id)` (claves leídas del usuario) y `marcarLeido(user_id, notificationKey)` (upsert idempotente sobre `uq_notification_reads_user_key`) — data-model.md — **ejecutada**: 2026-11-22
- [x] T008 Ampliar los seeds idempotentes en `server/scripts/seed.js` con al menos un caso por tipo de aviso (CA-12, FR-012): cita con `appointment_date = CURDATE()`, cita con `CURDATE() + 1` (motivo de la lista por avisar), orden no terminal con `updated_at` retrotraído 3 días (marcador propio, P-3), y verificación de un mantenimiento `UPCOMING`/`OVERDUE` y una refacción con `stock_current <= stock_min`; ejecutar `cd server && npm.cmd run seed` dos veces y confirmar que la segunda pasada crea 0 registros — **ejecutada**: 2026-11-22, doble pasada con 0 registros nuevos y casos verificados (1 cita hoy, 1 mañana, 1 orden detenida, 2 vencidos/1 próximo, 3 LOW/1 OUT)

**Checkpoint**: fundación lista; las historias pueden empezar

---

## Fase 3: User Story 1 — Campana y centro de avisos en el encabezado (Prioridad: P1) — MVP

**Objetivo**: la campana del encabezado muestra el total de no leídos y el panel abre los avisos agrupados por tipo, calculados en cada consulta, con estados de carga/vacío/error (FR-001, FR-002, FR-003, FR-005, FR-009)

**Prueba independiente**: teniendo activos un mantenimiento vencido, una cita de hoy, una refacción con stock bajo y una orden detenida, iniciar sesión como administrador y verificar que la campana muestra el total exacto y que el panel lista los cuatro avisos agrupados; sin avisos → campana en 0 y estado vacío

### Pruebas para US1 (primero, deben fallar)

- [x] T009 [P] [US1] Prueba unitaria de construcción de claves en `server/tests/unit/notification-rules.test.js`: formato `TIPO:id:ESTADO` (D-04) para `MAINTENANCE:…:UPCOMING|OVERDUE`, `APPOINTMENT:…:TODAY`, `STOCK:…:LOW|OUT` y `ORDER_STOPPED:…:{estado}`, con longitud ≤ 100 — **falla primero** — **ejecutada**: 2026-11-24
- [x] T010 [P] [US1] Prueba de integración del centro en `server/tests/integration/notifications.test.js`: administrador con los 4 casos sembrados → 4 grupos con sus ítems y `unreadCount` exacto (SC-001, 0 de más y 0 faltantes); sin avisos → `unreadCount 0` con grupos presentes y vacíos; recálculo en cada consulta (CA-2/CA-6) — **ejecutada**: 2026-11-24
- [x] T011 [P] [US1] Prueba de contrato de `GET /api/notifications` en `server/tests/contract/notifications.contract.test.js` según `contracts/notifications.md`: sobre `{ok,data}`, campos `unreadCount` y `groups` (con `key`, `read`, `severity`, `navigation`), 401 sin token; la matriz por rol se prueba en US2/US3/US5 — **ejecutada**: 2026-11-24
- [x] T012 [US1] Prueba de rendimiento de la consulta en `server/tests/integration/notifications.test.js`: `GET /api/notifications` con los datos sembrados responde en menos de 1000 ms (CA-13, FR-013) — **ejecutada**: 2026-11-24
- [x] T013 [P] [US1] Prueba de interfaz de campana y panel en `client/test/notifications_panel_test.dart`: la campana muestra el total, el panel agrupa por tipo con su detalle en español, y los estados de carga, vacío y error usan `states_view.dart` (CA-9, FR-009) — **ejecutada**: 2026-11-24, 5 pruebas

### Implementación de US1

- [x] T014 [US1] Crear `server/services/notifications.service.js` con `obtenerAvisos(usuario)`: reutiliza `listarMantenimientos()` de `server/services/maintenances.service.js` (estados `UPCOMING`/`OVERDUE` con los `warn_days`/`warn_km` de cada registro, RN-11), `part.listar({low:true})` de `server/models/part.model.js` (`LOW` o `OUT` según `stock_current = 0`), citas con `appointment_date = CURDATE()` sin importar estado (D-02) y órdenes con `status NOT IN ('FINISHED','DELIVERED') AND updated_at <= NOW() - INTERVAL 2 DAY` (D-01, P-3); claves D-04, `navigation` por tipo y `unreadCount` = avisos calculados cuya clave no esté en `leidasDe()` (P-1, P-15) — **ejecutada**: 2026-11-24
- [x] T015 [US1] Crear `server/controllers/notifications.controller.js` (`listarAvisos`) y `server/routes/notifications.routes.js` (`authenticate`, `authorize("ADMIN","RECEPTIONIST","MECHANIC")`), y montar `rutas.use("/notifications", rutasNotifications)` en `server/routes/index.js`; matriz inicial: fila ADMIN completa y demás roles con grupos vacíos hasta US2/US5 (sin fuga de datos, RN-15/FR-004) — **ejecutada**: 2026-11-24
- [x] T016 [P] [US1] Crear `client/lib/models/notification.dart` (`NotificationGroup`, `NotificationItem` con `key`, `read`, `severity`, `navigation`, y `unreadCount`) y agregar `GET /api/notifications` a `client/lib/services/api_client.dart` — **ejecutada**: 2026-11-24
- [x] T017 [US1] Crear `client/lib/providers/notifications_provider.dart` (`cargar()`, `unreadCount`, `groups`, estados de carga/error) con recarga en los tres puntos de D-03: inicio de sesión en `client/lib/providers/session_provider.dart`, apertura del panel y cambio de sección en `client/lib/widgets/app_shell.dart` — **ejecutada**: 2026-11-24
- [x] T018 [US1] Agregar la campana con contador al encabezado en `client/lib/widgets/app_shell.dart`: visible desde todas las secciones (CA-1), tap abre el panel — **ejecutada**: 2026-11-24
- [x] T019 [US1] Crear `client/lib/screens/notifications/notifications_panel.dart`: avisos agrupados por tipo con rótulo y detalle en español, estados de carga/vacío/error con `client/lib/widgets/states_view.dart` (CA-9, tokens de `docs/design-system.md`) — **ejecutada**: 2026-11-24
- [x] T020 [US1] Ejecutar las pruebas de US1 (notification-rules, notifications, notifications.contract, notifications_panel) y confirmar que las suites de dashboard e inventario siguen verdes sin tocar sus módulos (CA-8) — **ejecutada**: 2026-11-24, backend 54 suites / 442 pruebas, frontend 133 pruebas + `flutter analyze` sin observaciones

**Checkpoint**: US1 funcional y verificable de forma independiente; MVP demostrable como administrador

---

## Fase 4: User Story 6 — Marcar como leído y abrir el módulo relacionado (Prioridad: P2)

**Objetivo**: la lectura persiste por usuario, baja el contador de inmediato y cada aviso abre su pantalla relacionada (FR-006, FR-007, D-04, D-05)

**Prueba independiente**: marcar un aviso como leído y ver bajar el contador, cerrar y reabrir sesión para confirmar que persiste, repetir con un segundo usuario para confirmar que no se afecta, y seleccionar un aviso para ver que abre su pantalla

### Pruebas para US6 (primero, deben fallar)

- [x] T021 [P] [US6] Ampliar `server/tests/unit/notification-rules.test.js`: validación de la clave (patrón y máximo 100 caracteres → 400 `VALIDATION_ERROR`) y transiciones D-04/D-05 — mismo objeto con estado nuevo (`LOW → OUT`, `UPCOMING → OVERDUE`) genera clave distinta que cuenta como no leída; mismo estado = misma clave — **ejecutada**: 2026-11-24
- [x] T022 [P] [US6] Prueba de integración de la lectura en `server/tests/integration/notifications.test.js`: marcar leído baja `unreadCount` de inmediato, persiste en una consulta posterior (SC-004), es por usuario (otro usuario sigue viéndolo no leído, SC-004) e idempotente (repetir la llamada no cambia nada) — **ejecutada**: 2026-11-24
- [x] T023 [P] [US6] Prueba de contrato de `POST /api/notifications/read` en `server/tests/contract/notifications.contract.test.js` según `contracts/notifications.md`: 200 con `{read, unreadCount}`, 400 `VALIDATION_ERROR` con clave mal formada y mensaje en español, 401 sin token — **ejecutada**: 2026-11-24
- [x] T024 [P] [US6] Prueba de interfaz de lectura y navegación en `client/test/notifications_panel_test.dart`: marcar leído decrementa la campana y persiste al reabrir el panel, y seleccionar un aviso navega a su pantalla relacionada (FR-007) — **ejecutada**: 2026-11-24

### Implementación de US6

- [x] T025 [US6] Crear `notificationKeySchema` en `server/validators/notifications.js`: patrón `^[A-Z_]+:\d+:[A-Z_]+$`, máximo 100 caracteres, mensajes en español (D-04) — **ejecutada**: 2026-11-24
- [x] T026 [US6] Implementar `registrarLectura(usuario, key)` en `server/services/notifications.service.js`: validación con el schema, `marcarLeido()` (upsert) y recálculo del `unreadCount` del usuario para la respuesta (P-7) — **ejecutada**: 2026-11-24
- [x] T027 [US6] Exponer `POST /api/notifications/read` en `server/routes/notifications.routes.js` (`authenticate`, `authorize` de los 3 roles, `validate(notificationKeySchema)`) con su controlador `leerAviso` en `server/controllers/notifications.controller.js` — **ejecutada**: 2026-11-24
- [x] T028 [US6] Agregar `marcarComoLeido(key)` a `client/lib/providers/notifications_provider.dart` y `POST /api/notifications/read` a `client/lib/services/api_client.dart`: decremento optimista del contador y re-sync con `unreadCount` de la respuesta (D-03) — **ejecutada**: 2026-11-24
- [x] T029 [US6] Conectar el tap del ítem en `client/lib/screens/notifications/notifications_panel.dart`: marcar como leído y navegar con `navigation.route` + `entityId` a la pantalla relacionada (orden, cita, vehículo o inventario, FR-007; rutas en `client/lib/utils/app_route.dart`) — **ejecutada**: 2026-11-24, `AppRutas.seccionDeRuta` abre la sección del shell correspondiente
- [x] T030 [US6] Ejecutar las pruebas de US6 (unit, integración, contrato, panel) y confirmar que la lectura de un usuario no afecta a los demás — **ejecutada**: 2026-11-24, backend 54 suites / 453 pruebas, frontend 134 pruebas + `flutter analyze` sin observaciones

**Checkpoint**: US6 funcional; el ciclo del centro (ver → marcar → abrir) está completo

---

## Fase 5: User Story 2 — Avisos de recepción: mantenimientos y citas (Prioridad: P3)

**Objetivo**: recepción recibe mantenimientos, citas y órdenes detenidas —nunca stock—, con los mismos indicadores que sus módulos (FR-004 primera parte, FR-005)

**Prueba independiente**: sesión de recepcionista que ve mantenimientos y citas (y no stock), comparando los números con la lista de Mantenimientos y el panel de control

### Pruebas para US2 (primero, deben fallar)

- [x] T031 [P] [US2] Prueba de integración de recepción en `server/tests/integration/notifications.test.js`: token de recepción → grupos `MAINTENANCE`, `APPOINTMENT` y `ORDER_STOPPED` con datos y grupo `STOCK` vacío (FR-004, SC-003); sin token → 401 — **ejecutada**: 2026-11-24
- [x] T032 [US2] Prueba de paridad en `server/tests/integration/notifications.test.js`: los números del centro coinciden 1:1 con `GET /api/dashboard` (mantenimientos próximos/vencidos) y con la lista de Mantenimientos (mismo indicador Vencido/Próximo), y el stock del centro coincide con `GET /api/parts?low=true` para administrador (SC-002, CA-5, FR-005) — **ejecutada**: 2026-11-24

### Implementación de US2

- [x] T033 [US2] Agregar la fila `RECEPTIONIST` a `gruposPorRol` en `server/services/notifications.service.js`: mantenimientos, citas y órdenes detenidas; **sin stock** (CA-4, FR-004) — **ejecutada**: 2026-11-24
- [x] T034 [US2] Ajustar rótulos y severidades del grupo `MAINTENANCE` para reutilizar el cálculo de `server/services/maintenances.service.js` (`listarMantenimientos` / `calcularEstadoMantenimiento`) y que «Vencido»/«Próximo» coincidan con la lista (FR-005, RN-11) — **ejecutada**: 2026-11-24, la reutilización ya venía de T014 y queda documentada; la garantiza la paridad de T032
- [x] T035 [US2] Ejecutar las pruebas de US2 y regresar verdes `server/tests/integration/dashboard.test.js` y las de mantenimientos (CA-8) — **ejecutada**: 2026-11-24, 6 suites / 51 pruebas (notifications, dashboard y las 4 de mantenimientos)

**Checkpoint**: US2 funcional; recepción cubierta con números idénticos a sus módulos

---

## Fase 6: User Story 3 — Stock bajo y agotado para reabastecer (Prioridad: P4)

**Objetivo**: el aviso de stock distingue `LOW` de `OUT`, es exclusivo del administrador validado en backend y no contradice la insignia de Inventario (FR-004 segunda parte, FR-008)

**Prueba independiente**: teniendo una refacción por debajo de su mínimo y otra en cero, verificar que el administrador las ve con claves distintas y que recepción y mecánico no reciben ningún aviso de stock

### Pruebas para US3 (primero, deben fallar)

- [x] T036 [P] [US3] Prueba de integración de stock en `server/tests/integration/notifications.test.js`: refacción `LOW` y refacción `OUT` visibles para administrador con claves distintas; grupo `STOCK` vacío para recepción y para mecánico **validado en backend**; refacción sobre su mínimo sin aviso (SC-003, CA-4) — **ejecutada**: 2026-11-24, pasó sin cambios: la matriz de US2 ya garantizaba el comportamiento
- [x] T037 [US3] Prueba de convivencia CA-8/FR-008 en `server/tests/integration/notifications.test.js`: el stock del centro es idéntico (0 diferencias) a la insignia del inventario y a las alertas del dashboard con los mismos datos — **ejecutada**: 2026-11-24, mismo conjunto de claves en las tres fuentes

### Implementación de US3

- [x] T038 [US3] Agregar guarda explícita de stock solo ADMIN en `server/services/notifications.service.js` (defensa en profundidad además de la matriz de roles; FR-004/RN-15) — **ejecutada**: 2026-11-24
- [x] T039 [US3] Ejecutar las pruebas de US3 y verificar que `server/tests/integration/parts-catalog.test.js`/inventario y `dashboard` siguen verdes con su insignia y sus alertas originales intactas (FR-008) — **ejecutada**: 2026-11-24, 5 suites / 52 pruebas (notifications, parts-catalog, parts-alerts, dashboard, inventory contract)

**Checkpoint**: US3 funcional; el stock no sale del administrador en ninguna consulta

---

## Fase 7: User Story 4 — Órdenes detenidas para destrabarlas (Prioridad: P5)

**Objetivo**: el criterio D-01 (2 días sin cambio de estado en cualquier estado no terminal) identifica las órdenes detenidas y el aviso abre su detalle (FR-003 última parte, US4)

**Prueba independiente**: teniendo una orden sin cambios por más de 2 días y otra activa reciente, verificar que solo la primera aparece para administrador y recepción, y que seleccionar el aviso abre esa orden

### Pruebas para US4 (primero, deben fallar)

- [x] T040 [P] [US4] Prueba unitaria del criterio D-01 en `server/tests/unit/notification-rules.test.js`: orden no terminal con `updated_at` de 3 días → detenida; orden de 1 día → no aparece; estados `FINISHED` y `DELIVERED` → nunca (N = 2 fijo, sin configuración) — **ejecutada**: 2026-11-24, los casos ya estaban de US1 y se añadió el soporte de `updated_at` como cadena de la base
- [x] T041 [P] [US4] Prueba de integración de órdenes detenidas en `server/tests/integration/notifications.test.js`: visible para administrador y recepción con la orden identificable (cliente/vehículo/problema reportado); una orden activa reciente no aparece; al pasar a `FINISHED` desaparece del centro (CA-6) — **ejecutada**: 2026-11-24, falló primero por el detalle incompleto y el aviso quedó con cliente y problema reportado

### Implementación de US4

- [x] T042 [US4] Verificar y completar el mapeo de navegación del aviso `ORDER_STOPPED` hacia el detalle de la orden en `client/lib/screens/notifications/notifications_panel.dart` con la ruta de `client/lib/utils/app_route.dart` (aceptación 3 de US4) — **ejecutada**: 2026-11-24, `/orders` → sección 4 verificada con test en `notifications_panel_test.dart`
- [x] T043 [US4] Ejecutar las pruebas de US4 (unit + integración + navegación) — **ejecutada**: 2026-11-24, backend 2 suites / 31 pruebas, frontend 7 pruebas

**Checkpoint**: US4 funcional; el criterio de orden detenida queda fijado por pruebas

---

## Fase 8: User Story 5 — Mecánico solo con avisos de sus órdenes (Prioridad: P6)

**Objetivo**: el mecánico recibe únicamente las órdenes detenidas de sus órdenes asignadas, sin mantenimientos generales ni stock ni citas (FR-004 última parte, D-08)

**Prueba independiente**: sesión de mecánico con órdenes asignadas que solo ve avisos de esas órdenes; sesión de mecánico sin órdenes que ve estado vacío sin errores

### Pruebas para US5 (primero, deben fallar)

- [x] T044 [P] [US5] Prueba de integración del mecánico con órdenes en `server/tests/integration/notifications.test.js`: solo ítems `ORDER_STOPPED` de órdenes con `mechanic_id = usuario`; grupos `MAINTENANCE`, `APPOINTMENT` y `STOCK` vacíos; órdenes detenidas de otros mecánicos **no entregadas** en la respuesta (SC-003, D-08) — **ejecutada**: 2026-11-24
- [x] T045 [US5] Prueba de integración del mecánico sin órdenes en `server/tests/integration/notifications.test.js`: todos los grupos vacíos, `unreadCount 0`, respuesta 200 sin error (estado vacío, CA-9) — **ejecutada**: 2026-11-24
- [x] T046 [P] [US5] Prueba de interfaz con sesión de mecánico en `client/test/notifications_panel_test.dart`: la campana no muestra avisos ajenos y el panel queda en estado vacío — **ejecutada**: 2026-11-24

### Implementación de US5

- [x] T047 [US5] Agregar la fila `MECHANIC` a `gruposPorRol` en `server/services/notifications.service.js`: solo `ORDER_STOPPED` filtrado por `mechanic_id = usuario`, sin mantenimientos generales ni ningún otro grupo (D-08, CA-4, RN-15) — **ejecutada**: 2026-11-24
- [x] T048 [US5] Ejecutar las pruebas de US5 y la regresión de las rutas que usan `authorize` (`server/tests/integration/notifications.test.js`, `contract`) — **ejecutada**: 2026-11-24, backend notifications + contract 21 suites / 184 pruebas, frontend 9 pruebas del panel y `flutter analyze lib` sin observaciones

**Checkpoint**: las 7 historias funcionan de forma independiente; la matriz de roles está completa

---

## Fase 9: User Story 7 — Lista de clientes por avisar (Prioridad: P7)

**Objetivo**: recepción ve clientes con teléfono, motivo y contexto, y registra «ya lo hablé» quién y cuándo, una vez por hecho, con nota opcional (FR-010, FR-011, D-07)

**Prueba independiente**: teniendo una orden terminada sin entregar, abrir la lista como recepción, verificar teléfono/vehículo/motivo, marcar un cliente como avisado y confirmar que sale de la lista con quién y cuándo, que no vuelve por el mismo hecho y que un hecho nuevo lo devuelve; con sesión de mecánico, 403

### Pruebas para US7 (primero, deben fallar)

- [ ] T049 [P] [US7] Prueba de integración de la lista en `server/tests/integration/client-notices.test.js`: los 4 motivos (`ORDER_READY` con orden `FINISHED`, `APPOINTMENT_TOMORROW`, `MAINTENANCE_UPCOMING`/`OVERDUE`), exclusión por hecho ya avisado (mismo cliente con 2 motivos → 2 filas, CA-11), registro 201 y repetición 200 sin duplicar (SC-005), 403 a mecánico, 404 a cliente o hecho inexistente, `note` opcional ≤ 300 (D-07)
- [ ] T050 [P] [US7] Prueba de contrato en `server/tests/contract/client-notices.contract.test.js` según `contracts/client-notices.md`: campos exactos de `GET` y `POST`, códigos reutilizados (`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`) sin catálogo nuevo, 403 a MECHANIC
- [ ] T051 [P] [US7] Prueba de interfaz en `client/test/client_notices_test.dart`: lista con teléfono, motivo y contexto; marcar «Ya lo hablé» quita la fila y registra quién y cuándo; estados de carga/vacío/error con `states_view.dart`

### Implementación de US7

- [ ] T052 [US7] Crear `server/models/client_notice.model.js` con `pendientes()` (motivos con `LEFT JOIN client_notices ON (client_id, notice_type, source_id) ... WHERE id IS NULL`, P-8) y `registrar()` (upsert sobre `uq_client_notices_source`)
- [ ] T053 [US7] Crear `server/services/client-notices.service.js`: motivos `ORDER_READY` (`service_orders.status = 'FINISHED'`), `APPOINTMENT_TOMORROW` (`appointment_date = CURDATE() + 1` y `status NOT IN ('COMPLETED','CANCELED')`), `MAINTENANCE_UPCOMING`/`MAINTENANCE_OVERDUE` con el cálculo de `maintenances.service.js` (CA-5); `registrarAviso` valida existencia y correspondencia del hecho (404) y guarda `notified_by`/`notified_at`/`notes` en transacción (CA-11, D-07)
- [ ] T054 [US7] Crear `clientNoticeSchema` en `server/validators/notifications.js`: `clientId` numérico, `type` ∈ {`ORDER_READY`, `APPOINTMENT_TOMORROW`, `MAINTENANCE_UPCOMING`, `MAINTENANCE_OVERDUE`}, `sourceId` numérico y `note` opcional ≤ 300 caracteres, mensajes en español (P-9, D-07)
- [ ] T055 [US7] Crear `server/controllers/client_notices.controller.js` y `server/routes/client_notices.routes.js` (`authenticate`, `authorize("ADMIN","RECEPTIONIST")` en GET y POST → 403 a MECHANIC) y montar `rutas.use("/client-notices", rutasClientNotices)` en `server/routes/index.js` (P-10)
- [ ] T056 [P] [US7] Crear `client/lib/models/client_notice.dart` y `client/lib/providers/client_notices_provider.dart`, y agregar `GET/POST /api/client-notices` a `client/lib/services/api_client.dart`
- [ ] T057 [US7] Crear `client/lib/screens/clients/client_notice_screen.dart` (teléfono, motivo, contexto, acción «Ya lo hablé» con nota opcional, estados con `states_view.dart`) con su entrada en `client/lib/widgets/app_shell.dart` **solo para ADMIN y recepción** y su ruta en `client/lib/utils/app_route.dart` (CA-10, FR-010)
- [ ] T058 [US7] Ejecutar las pruebas de US7 (integración, contrato, interfaz) y confirmar que el backend niega el acceso al mecánico

**Checkpoint**: las 7 historias funcionan de forma independiente

---

## Fase 10: Pulido y preocupaciones transversales

**Propósito**: documentación, convivencia, regresión y entregables del sprint

- [ ] T059 [P] Actualizar `docs/project-context.md` (sección 6.12) con el comportamiento entregado (campana, matriz de rol, lectura por usuario, lista de clientes por avisar, claves D-04) y revisar `docs/design-system.md` solo si cambia un token (FR-014)
- [ ] T060 [P] Verificar la convivencia CA-8/FR-008: suites `dashboard`, `parts-catalog`/inventario y de mantenimientos en verde con la insignia y las alertas originales intactas
- [ ] T061 Regresión completa del backend: `cd server && npm.cmd test` con todas las suites de la línea base en verde más las nuevas (SC-007)
- [ ] T062 Regresión completa del frontend: `cd client && flutter analyze lib` sin problemas y `flutter test` en verde (SC-007)
- [ ] T063 Recorrido manual de extremo a extremo siguiendo `specs/006-notificaciones-internas/quickstart.md` (V1 a V10, SC-008) y dejar las capturas en `docs/evidencias/sprint-6/` (crear la carpeta; la acomodación final de las evidencias se acuerda con el usuario al cerrar el sprint)
- [ ] T064 Completar `docs/aseguramiento-calidad-sprint-6.md`: trazabilidad de CA con tareas y pruebas, línea base y regresión con conteos, y anexo de evidencias

---

## Dependencias y orden de ejecución

### Dependencias por fase

- **Fase 1 (Preparación)**: sin dependencias; la enmienda (T001) es **criterio de entrada** y debe completarse antes de cualquier cambio de código
- **Fase 2 (Fundacional)**: depende de la Fase 1 y **bloquea todas las historias**
- **Fase 3+ (Historias)**: todas dependen de la Fase 2; se ejecutan en orden de prioridad: US1 → US6 → US2 → US3 → US4 → US5 → US7
- **Fase 10 (Pulido)**: depende de las historias que se vayan entregando; la regresión final (T061, T062) requiere todas las historias terminadas

### Dependencias entre historias

- **US1 (P1)**: sin dependencias de otras historias una vez fundada la Fase 2; instala el servicio, la ruta y el panel que reutilizan las demás
- **US6 (P2)**: depende de US1 (necesita el panel y los ítems para marcarlos); no depende del resto
- **US2 (P3)**: completa la fila de recepción sobre la matriz de US1; sin dependencia de US3–US7
- **US3 (P4)**: funcional sin US4–US7; usa el grupo de stock de US1 y la matriz de US2
- **US4 (P5)**: el criterio vive en el servicio de US1 y la navegación en el panel de US6 (anterior en prioridad)
- **US5 (P6)**: completa la fila de mecánico sobre la matriz de US1; sin dependencia del resto
- **US7 (P7)**: **independiente del centro**: solo requiere la Fase 2 (su tabla ya está en la migración 015) y puede avanzar en paralelo con US2–US6

### Dentro de cada historia

- Las pruebas se escriben primero y deben **fallar** antes de la implementación
- Modelo/servicio antes que rutas; lógica antes que interfaz
- Terminar y verificar cada historia antes de pasar a la siguiente prioridad

### Oportunidades de paralelismo

- T003, T005, T009, T010, T011, T013, T016, T021, T022, T023, T024, T031, T036, T040, T041, T044, T046, T049, T050, T051, T056, T059 y T060 pueden correr en paralelo entre sí (archivos distintos)
- Una vez la Fase 2 lista, US1 puede avanzar junto con US7 (no se pisan archivos: US7 no toca el panel)
- US2, US3 y US5 comparten `notifications.service.js`: conviene ejecutarlas en orden (o por bloques de archivo) para evitar conflictos

---

## Ejemplo paralelo: User Story 7

```text
Tarea: "Prueba de integración de la lista en server/tests/integration/client-notices.test.js"
Tarea: "Prueba de contrato en server/tests/contract/client-notices.contract.test.js"
Tarea: "Prueba de interfaz en client/test/client_notices_test.dart"
Tarea: "Crear client/lib/models/client_notice.dart y client/lib/providers/client_notices_provider.dart"
# Lanzadas juntas (archivos distintos) antes de implementar
```

---

## Estrategia de implementación

### MVP primero (solo US1)

1. Completar Fase 1: preparación (enmienda + rama + línea base)
2. Completar Fase 2: fundacional (migración 015 + modelo de lectura + seeds)
3. Completar Fase 3: US1
4. **PARAR y VALIDAR**: probar US1 de forma independiente (campana + panel como administrador)
5. Demostrable con el centro de avisos del administrador

### Entrega incremental

1. Preparación + Fundacional → base lista
2. US1 → probar por sí sola → demo de campana y panel (MVP)
3. US6 → probar por sí sola → demo de marcar leído y abrir módulo
4. US2 → probar por sí sola → demo de recepción con mantenimientos y citas
5. US3 → probar por sí sola → demo de stock solo para administrador
6. US4 → probar por sí sola → demo de órdenes detenidas
7. US5 → probar por sí sola → demo del mecánico con sus órdenes
8. US7 → probar por sí sola → demo de clientes por avisar
9. Pulido → regresión completa y cierre del documento de calidad

### Estrategia con equipo paralelo

1. El equipo completa Fase 1 y Fase 2 juntos
2. Con la fundación lista:
   - Desarrollador A: US1 → US6 (cadena del panel)
   - Desarrollador B: US7 (módulo independiente)
   - Después: US2 → US3 → US4 → US5 (todos tocan `notifications.service.js`; secuencial por el mismo archivo)

---

## Notas

- `[P]` = archivos distintos sin dependencias; `[Historia]` rastrea la tarea a su historia
- Cada historia debe poder completarse y comprobarse de forma independiente
- Verificar que las pruebas **fallan** antes de implementar
- Commitear después de cada tarea o grupo lógico (mensajes en Conventional Commits, sin línea de coautor)
- Parar en cada checkpoint para validar la historia
- Evitar: tareas vagas, conflictos de archivo dentro de una historia y dependencias que rompan la independencia
- Los códigos de error se **reutilizan** (`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`): no se agrega ninguno nuevo (VI.6)
- Reglas de negocio fijadas a no reabrir: D-01 (N = 2), D-02 (cita de hoy), D-03 (sin polling), D-04 (clave tipo+objeto+estado), D-08 (mecánico solo sus órdenes); D-06 y D-07 con sus defaults del spec
