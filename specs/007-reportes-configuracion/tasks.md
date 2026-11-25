---
description: "Lista de tareas del sprint 7: reportes, configuración, términos y seguridad"
---

# Tareas: Reportes, configuración, términos y seguridad (Sprint 7)

**Input**: Documentos de diseño en `/specs/007-reportes-configuracion/`

**Prerrequisitos**: plan.md (obligatorio), spec.md (historias de usuario), research.md, data-model.md, contracts/, quickstart.md

**Pruebas**: se incluyen porque el propio spec las exige (**FR-030**: «DEBEN existir y pasar pruebas automatizadas de las reglas de configuración, el cálculo de reportes, los permisos por rol, la exportación, la aceptación de términos, la bitácora, la política de contraseñas, la inactividad y la no exposición de datos», y **SC-014** exige la regresión completa). Se escriben **antes** de la implementación de su historia y deben **fallar** al principio (TDD, principio VII de la constitución).

**Organización**: las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente. Las fases 3 a 8 forman el **bloque A** (configuración, términos y seguridad) y las fases 9 a 12 el **bloque B** (reportes y exportación); si el tiempo no alcanza, el bloque B es lo que se aplaza (plan, «Estrategia de entrega»).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Historia]**: historia de usuario a la que pertenece (US1, US2, US3, US8, US9, US10, US4, US5, US6, US7; el orden es el de prioridad de la spec)
- Ruta de archivo exacta en cada descripción

## Convenciones de ruta

- Monorepo de tres carpetas: `server/` (Node.js ES Modules), `client/` (Flutter) y `database/` (migraciones)
- Pruebas del backend en `server/tests/{unit,integration,contract}/`; pruebas de frontend en `client/test/`
- Todo texto visible al usuario y nombres de pruebas en español; identificadores de código en inglés
- Importes: cadenas de 2 decimales calculadas en centavos enteros (`aCentavos` / `aCadena` de `server/services/order-total.service.js`)
- Cada llamada a `audit.service.registrar()` usa solo el catálogo cerrado de acciones del contrato `contracts/audit-log.md`

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: punto de partida verificable del sprint

- [X] T001 Confirmar la rama `007-reportes-configuracion` creada desde `main` el 2026-11-24 (sin squash ni force-push durante todo el sprint) y que `git status` solo muestra los archivos sueltos ajenos al sprint (`motorix-fases-pmi.md`, `Tabla-calidad-motorix.md`)
- [X] T002 [P] Crear `docs/aseguramiento-calidad-sprint-7.md` a partir de `docs/aseguramiento-calidad/plantilla-aseguramiento-calidad.md` (datos generales, objetivo y alcance, criterios de entrada y de salida, puertas G-01 a G-07 con la decisión de omitir `/speckit.analyze` si el responsable la mantiene), con las secciones de línea base, regresión y anexo de evidencias vacías para llenarlas al cierre
- [X] T003 Verificar que la rama arranca con la línea base verde: `cd server && npm.cmd test` y `npm.cmd run lint`, y en `client/` `flutter test` y `flutter analyze`; anotar conteos y fecha en la sección de línea base de `docs/aseguramiento-calidad-sprint-7.md` (referencia del cierre del Sprint 6: 56 suites y 479 pruebas de backend; 145 de Flutter; 1 advertencia de lint previa en `server/tests/integration/order-parts.test.js`)

---

## Fase 2: Fundacional (bloqueante para todas las historias)

**Propósito**: esquema, configuración con respaldo, bitácora, fecha de terminación de la orden y ajuste del helper de pruebas. **CRÍTICO**: ninguna historia puede comenzar hasta completar esta fase

### Pruebas fundacionales (primero, deben fallar)

- [ ] T004 [P] Escribir `server/tests/unit/settings-resolution.test.js`: `obtenerConfiguracion()` devuelve el valor guardado o el de respaldo (`shop.name` = `Motorix`, `shop.address` = `null`, `shop.phone` = `null`, `maintenance.warn_days` = 30, `maintenance.warn_km` = 500); `resolverMargenes(fila, config)` devuelve el valor propio cuando `warn_days`/`warn_km` no es `NULL` y el del taller cuando es `NULL`, columna por columna (P-2, P-3, D-16)
- [ ] T005 [P] Escribir `server/tests/unit/audit-detail.test.js`: el saneado de `detail` usa lista blanca por acción (`LOGIN_FAILED`: identificador recortado a 100 caracteres; `ACCOUNT_LOCKED`: minutos; `USER_CREATED`: rol; `USER_UPDATED`: campo y valores anterior y nuevo; `SETTINGS_UPDATED`; `PART_PRICE_CHANGED`; `ORDER_PART_PRICE_CORRECTED`; `PAYMENT_CANCELLED`; `TERMS_PUBLISHED`), descarta toda clave que parezca reservada (`password`, `hash`, `token`, `card`) y trunca `detail` a 500 caracteres; una acción fuera del catálogo se rechaza (CA-21, P-13)
- [ ] T006 [P] Escribir `server/tests/integration/order-finished-at.test.js`: `cambiarEstado` escribe `finished_at` y deja `finished_at_estimated = 0` al pasar a `FINISHED` (también al volver de `WAITING_PART` a `FINISHED`) cuando es `NULL`; las órdenes ya terminadas antes de la migración quedan con `finished_at_estimated = 1`; pasar a `DELIVERED` **no** lo modifica; editar la orden sin cambiar de estado no lo toca; las transiciones y permisos del Sprint 2 siguen idénticos (D-19, P-7)

### Esquema y acceso a datos

- [ ] T007 Crear la migración aditiva `database/migrations/016_settings_reports_security.sql` — **parte 1, tablas nuevas** (`CREATE TABLE IF NOT EXISTS`, InnoDB `utf8mb4_unicode_ci`): `settings` (`setting_key VARCHAR(60) PK`, `setting_value VARCHAR(200) NOT NULL`, `updated_by INT UNSIGNED NOT NULL` FK → `users.id`, `updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`); `service_types` (`id INT UNSIGNED PK AUTO_INCREMENT`, `name VARCHAR(100) NOT NULL` con `UNIQUE uq_service_types_name`, `interval_days INT UNSIGNED NULL`, `interval_km INT UNSIGNED NULL`, `active TINYINT(1) NOT NULL DEFAULT 1`, `created_by INT UNSIGNED NOT NULL` FK → `users.id`, `created_at`/`updated_at` DATETIME, `CHECK chk_service_types_interval` `(interval_days IS NOT NULL AND interval_days > 0) OR (interval_km IS NOT NULL AND interval_km > 0)`, `CHECK chk_service_types_interval_max` `interval_days <= 3650` y `interval_km <= 1000000`); `terms_versions` (`id INT UNSIGNED PK AUTO_INCREMENT`, `version INT UNSIGNED NOT NULL` con `UNIQUE`, `terms_text MEDIUMTEXT NOT NULL`, `privacy_text MEDIUMTEXT NOT NULL`, `published_by INT UNSIGNED NULL` FK → `users.id`, `published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`); `terms_acceptances` (`id INT UNSIGNED PK AUTO_INCREMENT`, `user_id INT UNSIGNED NOT NULL` FK → `users.id` `ON DELETE CASCADE`, `terms_version_id INT UNSIGNED NOT NULL` FK → `terms_versions.id`, `accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, `UNIQUE (user_id, terms_version_id)`); `audit_log` (`id BIGINT UNSIGNED PK AUTO_INCREMENT`, `user_id INT UNSIGNED NULL` FK → `users.id` `ON DELETE SET NULL`, `actor VARCHAR(100) NOT NULL`, `action VARCHAR(40) NOT NULL`, `entity_type VARCHAR(40) NULL`, `entity_id INT UNSIGNED NULL`, `detail VARCHAR(500) NULL`, `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, índices `idx_audit_created (created_at)`, `idx_audit_user_created (user_id, created_at)` e `idx_audit_action_created (action, created_at)`) — data-model.md, research P-1
- [ ] T008 Ampliar `database/migrations/016_settings_reports_security.sql` — **parte 2, cambios a tablas existentes** (después de las tablas nuevas): `maintenance` → `warn_days` y `warn_km` pasan a `INT UNSIGNED NULL` sin valor por omisión (se conservan los `CHECK >= 0`); `order_services` → `service_type_id INT UNSIGNED NULL` con FK → `service_types.id` (`ON DELETE RESTRICT`) e índice `idx_order_services_type`; `order_parts` → `unit_cost DECIMAL(10,2) NULL` con `CHECK (unit_cost IS NULL OR (unit_cost >= 0 AND unit_cost <= 99999.99))`; `service_orders` → `finished_at DATETIME NULL`, `finished_at_estimated TINYINT(1) NOT NULL DEFAULT 0` e índice `idx_service_orders_finished_at`; `tickets` → `workshop_name VARCHAR(100) NOT NULL DEFAULT 'Motorix'`, `workshop_address VARCHAR(200) NULL`, `workshop_phone VARCHAR(30) NULL`, `next_service_date DATE NULL`, `next_service_mileage INT UNSIGNED NULL`; `users` → `last_activity_at DATETIME NULL` — data-model.md, research P-3 a P-8 y P-12
- [ ] T009 Ampliar `database/migrations/016_settings_reports_security.sql` — **parte 3, rellenos y versión 1 de los términos**: poner `NULL` en `maintenance.warn_days` donde vale 30 y en `maintenance.warn_km` donde vale 500 (columna por columna, P-3); `order_parts.unit_cost = parts.purchase_price` donde `parts.purchase_price > 0` y `NULL` en el resto (P-8); `service_orders.finished_at = updated_at` y `finished_at_estimated = 1` para las órdenes `FINISHED` o `DELIVERED` (aproximación D-19, P-7); insertar la **versión 1** de `terms_versions` con una plantilla en español (uso permitido del sistema, confidencialidad de los datos de clientes y vehículos, responsabilidad de las cuentas personales y aviso de privacidad, CA-18) mediante `INSERT ... SELECT ... WHERE NOT EXISTS` para que sea idempotente; sin migración inversa
- [ ] T010 [P] Documentar la migración 016 en `database/README.md` (propósito, las 5 tablas nuevas, las 12 columnas nuevas o modificadas, el significado de `NULL` en `maintenance.warn_*` y las aproximaciones de los rellenos)
- [ ] T011 Aplicar la migración primero a `motorix_test` y después a la base principal con `database/scripts/aplicar-migraciones.ps1`; verificar en `schema_migrations` el registro de `016_settings_reports_security`, las claves únicas, los `CHECK` y las llaves foráneas en `information_schema`, que los rellenos dejaron `NULL` donde corresponde y que la versión 1 de los términos existe una sola vez al reejecutar el script (R-04)
- [ ] T012 [P] Crear `server/models/settings.model.js` con `obtenerTodas()` (filas clave-valor) y `guardar(clave, valor, userId, conexion)` (upsert por `setting_key`) — data-model.md
- [ ] T013 Crear `server/services/settings.service.js` con `obtenerConfiguracion()` (objeto completo `{ shop, maintenance, defaults }` con valor guardado o de respaldo; respaldo del taller desde `server/config/taller.js` y 30 días / 500 km) y `resolverMargenes(fila, config)` (propio si no es `NULL`, del taller si lo es) — hace pasar `settings-resolution.test.js`; research P-2 y P-3
- [ ] T014 [P] Crear `server/models/audit.model.js` con **solo** `insertar({ userId, actor, action, entityType, entityId, detail })` y `listar({ from, to, userId, action, page, pageSize })` (más reciente primero, `pageSize` por omisión 50 y máximo 200); sin funciones de edición ni borrado (CA-20) — data-model.md
- [ ] T015 [P] Crear `server/utils/audit-detail.js` con el catálogo cerrado de acciones y `sanearDetalle(accion, datos)` (lista blanca por acción, descarte de claves reservadas y truncado a 500 caracteres) — hace pasar `audit-detail.test.js`; research P-13
- [ ] T016 Crear `server/services/audit.service.js` con `registrar({ user, actor, action, entityType, entityId, datos }, conexion)` que valida la acción contra el catálogo, sanea `detail` con `sanearDetalle` y escribe con `audit.model.insertar`; un fallo al auditar nunca debe romper la operación que se audita (se captura y se registra en consola) — research P-13
- [ ] T017 Ajustar `server/tests/helpers/usuarios.js`: `crearUsuarioPrueba` registra en `terms_acceptances` la aceptación de la versión vigente de `terms_versions` del usuario recién creado (función `aceptarTerminosVigentes(userId)` exportada), para que las suites autenticadas no reciban 403 cuando se active el bloqueo (R-01); no cambia ninguna otra conducta del helper
- [ ] T018 Modificar `server/models/service_order.model.js` (`actualizar` acepta `finishedAt`) y `server/services/service_orders.service.js` (`cambiarEstado` fija `finished_at` con la fecha actual y `finished_at_estimated = 0` solo en la transición a `FINISHED` y solo si todavía es `NULL`) sin alterar las demás reglas de transición
- [ ] T019 Ejecutar la regresión completa del backend (`cd server && npm.cmd test`) contra el esquema nuevo y confirmar que **todas** las suites anteriores siguen en verde antes de empezar las historias (las columnas nuevas admiten `NULL` o tienen valor por omisión)

**Checkpoint**: esquema aplicado, configuración con respaldo y bitácora listas; las historias pueden empezar

---

## Fase 3: User Story 1 — Datos del taller editables desde la aplicación (Prioridad: P1) — MVP

**Objetivo**: el administrador edita nombre, dirección y teléfono del taller desde Configuración; los tickets nuevos los usan y los emitidos conservan su instantánea (FR-001, FR-002, FR-009)

**Prueba independiente**: con ADMIN, cambiar nombre y teléfono en Configuración, generar un ticket nuevo y comprobar que muestra los datos nuevos, mientras un ticket emitido antes conserva los datos con los que se emitió; un recepcionista o un mecánico recibe 403 en la configuración

### Pruebas para US1 (primero, deben fallar)

- [ ] T020 [P] [US1] Escribir `server/tests/integration/settings.test.js`: `GET /api/settings` devuelve el objeto completo con valores de respaldo en una instalación sin valores guardados (CA-3); `PATCH` parcial guarda `shop.name`, `shop.address` y `shop.phone` y los devuelve; rechaza nombre vacío o de más de 100 caracteres, dirección de más de 200, teléfono de más de 30, cuerpo sin ninguna clave y claves desconocidas con `400 VALIDATION_ERROR` y mensaje en español conservando el valor anterior; RECEPTIONIST y MECHANIC reciben `403 FORBIDDEN` en GET y PATCH; cada cambio escribe un registro `SETTINGS_UPDATED` con el valor anterior y el nuevo (CA-1, CA-10)
- [ ] T021 [P] [US1] Escribir `server/tests/contract/settings.contract.test.js` con las formas de `contracts/settings.md` (sobre `{ok, data}`, campos y tipos de `shop`, `maintenance` y `defaults`, y códigos de error)
- [ ] T022 [P] [US1] Escribir `server/tests/integration/ticket-snapshot.test.js`: el ticket nuevo guarda al emitirse `workshop_name`, `workshop_address` y `workshop_phone` vigentes; cambiar la configuración después **no** altera ese ticket al volver a consultarlo ni al reimprimirlo; un ticket emitido con los datos de respaldo conserva `Motorix` sin dirección ni teléfono; el ticket creado después del cambio usa los datos nuevos; el desglose (servicios, mano de obra, refacciones, totales y pago) sigue calculándose en cada lectura y coincide con el cobro (CA-1, SC-001, D-03)
- [ ] T023 [P] [US1] Escribir `client/test/settings_test.dart` (sección «Taller»): la pantalla carga los datos, muestra estados de carga, vacío y error con `states_view.dart`, valida el nombre obligatorio y las longitudes, guarda y muestra el mensaje de éxito, ofrece «restablecer» con los valores de `defaults`, pide confirmación «Cambios sin guardar» al salir con cambios pendientes, y la sección solo aparece para ADMIN en `app_shell` (FR-017)

### Implementación de US1

- [ ] T024 [P] [US1] Crear `server/validators/settings.js` con `settingsPatchSchema` (zod, mensajes en español): `shop.name` 1–100 caracteres, `shop.address` ≤ 200 (vacío = sin dirección), `shop.phone` ≤ 30, `maintenance.warnDays` entero 0–365 y `maintenance.warnKm` entero 0–20,000 (estos dos se usan en US2), `.strict()` y al menos una clave
- [ ] T025 [US1] Ampliar `server/services/settings.service.js` con `actualizar(patch, usuario)`: guarda solo las claves enviadas con `settings.model.guardar` en una transacción, registra `SETTINGS_UPDATED` con `audit.service.registrar` (clave, valor anterior y nuevo) y devuelve el objeto completo de `obtenerConfiguracion()`
- [ ] T026 [US1] Crear `server/controllers/settings.controller.js` y `server/routes/settings.routes.js` (`GET /` y `PATCH /`, ambos con `authenticate` y `authorize("ADMIN")`, `PATCH` con `validate(settingsPatchSchema)`) y montar `rutas.use("/settings", rutasSettings)` en `server/routes/index.js`
- [ ] T027 [US1] Modificar `server/models/ticket.model.js` (`crear` recibe y guarda `workshopName`, `workshopAddress` y `workshopPhone`; `buscarPorOrden` y `aTicket` los devuelven) y `server/services/tickets.service.js` (`generarTicket` lee `obtenerConfiguracion()` y los pasa a `crear`; `armarTicket` arma `workshop` desde la instantánea guardada y **ya no** desde `config/taller.js`) — contracts/changes-to-existing.md, research P-6
- [ ] T028 [P] [US1] Crear `client/lib/models/app_settings.dart` (taller, márgenes y valores de respaldo) y `client/lib/providers/settings_provider.dart` (`cargar`, `guardarTaller`, estados de carga, error y éxito) y registrar el proveedor en `client/lib/main.dart`
- [ ] T029 [US1] Agregar a `client/lib/services/api_client.dart` los métodos `obtenerConfiguracion()` y `actualizarConfiguracion(...)` hacia `/api/settings`
- [ ] T030 [US1] Crear `client/lib/screens/settings/settings_screen.dart` con la sección «Taller» (nombre, dirección, teléfono, botón «Restablecer» y «Guardar» con mensaje de éxito), usando `states_view.dart`, tokens de `AppColors`, `AppSpacing` y `AppRadii` y mensajes en español; todo formulario de esta pantalla (taller, márgenes, tipos de servicio y términos) pide confirmación «Cambios sin guardar» al salir con cambios pendientes, con `PopScope` y `mostrarConfirmacion` como en `client/lib/screens/appointments/appointment_form_screen.dart` (`docs/project-context.md` §16); la sección «Márgenes» y las de catálogo y términos se agregan en sus historias
- [ ] T031 [US1] Agregar la sección «Configuración» (ícono de ajustes, `roles: {'ADMIN'}`) como **índice 11** de `_secciones` en `client/lib/widgets/app_shell.dart`, con su caso en `_vistaSeccion`, y `configuracion = '/settings'` en `client/lib/utils/app_route.dart`, sin recorrer los índices existentes
- [ ] T032 [US1] Ampliar `server/scripts/seed.js` (idempotente) con valores iniciales de configuración del taller (`INSERT IGNORE` de `shop.name`, `shop.address` y `shop.phone` con un nombre, dirección y teléfono de demostración) para que el ticket de ejemplo muestre datos del taller (CA-12)

**Checkpoint**: US1 funcional y probable de forma independiente

---

## Fase 4: User Story 2 — Márgenes de «Próximo» del mantenimiento (Prioridad: P2)

**Objetivo**: el administrador ajusta los márgenes de días y kilómetros; el valor del taller rige para todo mantenimiento sin antelación propia y los tres módulos coinciden (FR-003, FR-004; D-16, D-17)

**Prueba independiente**: cambiar los márgenes en Configuración y comprobar que la lista de Mantenimientos, el panel de control y el centro de avisos clasifican como «Próximo» con los valores nuevos, y que un mantenimiento con antelación propia la conserva

### Pruebas para US2 (primero, deben fallar)

- [ ] T033 [P] [US2] Escribir `server/tests/integration/maintenance-margins.test.js`: el mantenimiento con `warn_days`/`warn_km` `NULL` se clasifica con el valor del taller y cambia al cambiar la configuración; el que tiene antelación propia la conserva; sin valor guardado rigen 30 días y 500 km (CA-3, SC-003); la lista de Mantenimientos, `GET /api/dashboard`, `GET /api/notifications` y `GET /api/client-notices` coinciden 1:1 tras cambiar los márgenes (SC-002); `POST /api/maintenances` sin `warnDays` ni `warnKm` guarda `NULL` y con número lo guarda como propio; `warnDaysCustom` y `warnKmCustom` reflejan cada caso; límites de `PATCH /api/settings` (`warnDays` entero 0–365 y `warnKm` entero 0–20,000, fuera de rango o no entero → `400 VALIDATION_ERROR` conservando el valor anterior)
- [ ] T034 [P] [US2] Ampliar `server/tests/contract/` con `maintenances-changes.contract.test.js` según `contracts/changes-to-existing.md` (campos `warnDaysCustom` y `warnKmCustom`, `warnDays` y `warnKm` opcionales y con `null` en el alta) y ajustar, sin cambiar su intención, las pruebas existentes de mantenimientos que asumían que `POST` guarda 30 y 500 cuando faltan los campos
- [ ] T035 [P] [US2] Ampliar `client/test/maintenance_form_test.dart` y `client/test/settings_test.dart` (sección «Márgenes»): el formulario deja vacío el campo para «usar el valor del taller» y envía `null`; la pantalla de configuración valida los rangos y guarda; los modelos leen `warnDaysCustom` y `warnKmCustom`

### Implementación de US2

- [ ] T036 [US2] Modificar `server/validators/maintenances.js` (`warnDays` y `warnKm` opcionales y admiten `null`; siguen siendo enteros no negativos), `server/services/maintenances.service.js` (`registrarMantenimiento` ya **no** asume 30 y 500: guarda `NULL` si faltan) y `server/models/maintenance.model.js` (`upsert` acepta `null`) — contracts/changes-to-existing.md
- [ ] T037 [US2] Modificar `server/services/maintenances.service.js` (`armaMantenimiento` y `listarMantenimientos` cargan `obtenerConfiguracion()` **una vez** y usan `resolverMargenes`; la respuesta devuelve `warnDays` y `warnKm` efectivos más `warnDaysCustom` y `warnKmCustom`) y `server/services/client-notices.service.js` (línea del cálculo con `warnDays`/`warnKm`) para que ambos usen los márgenes resueltos y el dashboard y el centro de avisos coincidan por construcción
- [ ] T038 [US2] Modificar `server/validators/settings.js` y `server/services/settings.service.js` para aceptar y guardar `maintenance.warnDays` y `maintenance.warnKm` con sus límites y registrar `SETTINGS_UPDATED`
- [ ] T039 [P] [US2] Modificar `client/lib/models/maintenance.dart` (`warnDaysCustom`, `warnKmCustom`) y `client/lib/screens/maintenances/maintenance_form_screen.dart` (campos de antelación vacíos por omisión con la leyenda «usa el valor del taller (X)» y envío de `null`)
- [ ] T040 [US2] Agregar la sección «Márgenes de “Próximo”» (días y kilómetros, con «Restablecer») a `client/lib/screens/settings/settings_screen.dart` y a `client/lib/providers/settings_provider.dart` (`guardarMargenes`)
- [ ] T041 [US2] Ajustar `server/scripts/seed.js` (alrededor de la línea que fija `warnDays: 30` y `warnKm: 500` del mantenimiento de ejemplo) para que los mantenimientos de ejemplo usen el valor del taller (`NULL`) salvo uno con antelación propia, manteniendo la idempotencia

**Checkpoint**: US1 y US2 funcionales; la configuración ya gobierna ticket y mantenimientos

---

## Fase 5: User Story 3 — Catálogo de tipos de servicio con intervalos (Prioridad: P3)

**Objetivo**: el administrador mantiene un catálogo de tipos de servicio con intervalo en días y kilómetros, y las líneas de servicio de una orden pueden enlazarse a un tipo activo (FR-005, FR-006, FR-009)

**Prueba independiente**: crear «Cambio de aceite» (180 días y 5,000 km), editarlo, desactivarlo y verificar que un tipo ya usado en una orden nunca se borra y que el selector solo ofrece tipos activos

### Pruebas para US3 (primero, deben fallar)

- [ ] T042 [P] [US3] Escribir `server/tests/integration/service-types.test.js`: alta con nombre e intervalo(s) (`201`); nombre repetido sin distinguir mayúsculas → `409 SERVICE_TYPE_NAME_TAKEN`; sin ningún intervalo, intervalo 0, negativo, no entero, de más de 3650 días o de más de 1,000,000 km → `400 VALIDATION_ERROR`; `PATCH` parcial de `name`, `intervalDays`, `intervalKm` y `active` (se puede quitar un intervalo con `null` si queda otro); no existe ninguna ruta `DELETE` (404); desactivar un tipo usado no toca las líneas que ya lo usan; `GET /api/service-types?active=` filtra y `usedInServices` cuenta las líneas; `GET /lookup` devuelve solo tipos activos a los tres roles; el alta y la edición dan `403 FORBIDDEN` a RECEPTIONIST y MECHANIC (CA-4, CA-10)
- [ ] T043 [P] [US3] Escribir `server/tests/integration/order-service-type.test.js`: `POST /api/service-orders/:id/services` acepta `serviceTypeId` de un tipo activo y la respuesta devuelve `serviceTypeId` y `serviceTypeName`; rechaza un tipo inexistente o inactivo con `400 VALIDATION_ERROR`; sin `serviceTypeId` el servicio se registra como antes (línea sin tipo, valor `null`); las líneas existentes siguen siendo válidas (CA-4, D-04)
- [ ] T044 [P] [US3] Escribir `server/tests/contract/service-types.contract.test.js` con las formas de `contracts/service-types.md` y los campos nuevos de `contracts/changes-to-existing.md` para los servicios de la orden
- [ ] T045 [P] [US3] Escribir `client/test/service_types_test.dart` (sección de catálogo en Configuración: lista, alta, edición, desactivar con confirmación, confirmación «Cambios sin guardar» al salir del formulario con cambios pendientes, estados de carga, vacío y error) y `client/test/order_service_type_test.dart` (el formulario de servicio de la orden ofrece solo tipos activos y envía `serviceTypeId`; sin elegir tipo sigue funcionando)

### Implementación de US3

- [ ] T046 [P] [US3] Crear `server/validators/service_types.js` (`serviceTypeCreateSchema` y `serviceTypePatchSchema` con zod y mensajes en español: `name` 1–100 caracteres, `intervalDays` y `intervalKm` enteros mayores que 0 con máximos 3650 y 1,000,000, al menos un intervalo) y añadir `serviceTypeId` opcional a `serviceCreateSchema` en `server/validators/service_orders.js`
- [ ] T047 [P] [US3] Crear `server/models/service_type.model.js` (`listar({ active })` con `usedInServices`, `listarActivos`, `buscarPorId`, `buscarPorNombre`, `crear`, `actualizar`; sin borrado)
- [ ] T048 [US3] Crear `server/services/service-types.service.js` (alta, edición y desactivación con validación de nombre único → `SERVICE_TYPE_NAME_TAKEN`, al menos un intervalo y `NOT_FOUND`) y añadir `serviceTypeNameTaken` (409) a `server/utils/errors.js`
- [ ] T049 [US3] Crear `server/controllers/service_types.controller.js` y `server/routes/service_types.routes.js` (`GET /` y `POST /` y `PATCH /:id` con `authorize("ADMIN")`; `GET /lookup` con `authorize("ADMIN","RECEPTIONIST","MECHANIC")`, declarada **antes** de las rutas con `:id`) y montar `rutas.use("/service-types", ...)` en `server/routes/index.js`
- [ ] T050 [US3] Modificar `server/models/order_service.model.js` (`insertar` guarda `service_type_id`; `listarPorOrden` devuelve `serviceTypeId` y `serviceTypeName` con `LEFT JOIN service_types`) y `server/services/service_orders.service.js` (`agregarServicio` valida que el tipo exista y esté activo cuando viene `serviceTypeId`)
- [ ] T051 [P] [US3] Crear `client/lib/models/service_type.dart` y `client/lib/providers/service_types_provider.dart` (`cargar`, `crear`, `actualizar`, `activar/desactivar`, `lookup`), registrar el proveedor en `client/lib/main.dart` y agregar los métodos de `/api/service-types` a `client/lib/services/api_client.dart`
- [ ] T052 [US3] Agregar la sección «Tipos de servicio» a `client/lib/screens/settings/settings_screen.dart` (lista con nombre, intervalos y estado, formulario de alta y edición con la confirmación de cambios sin guardar y confirmación al desactivar)
- [ ] T053 [US3] Modificar `client/lib/screens/orders/order_detail_screen.dart` y `client/lib/models/order_item.dart`: el formulario de servicio muestra un selector opcional de tipo (desde el `lookup`), y la lista de servicios muestra el nombre del tipo cuando existe
- [ ] T054 [US3] Ampliar `server/scripts/seed.js` (idempotente por nombre) con los tipos de servicio de ejemplo (Cambio de aceite 180 días y 5,000 km; Afinación 365 días y 10,000 km; Revisión de frenos 180 días) y enlazar a ellos algunas líneas de servicio de órdenes de ejemplo, dejando otras sin tipo (CA-12)

**Checkpoint**: US1 a US3 funcionales de forma independiente

---

## Fase 6: User Story 8 — Ticket con el próximo servicio (Prioridad: P4)

**Objetivo**: el próximo mantenimiento se propone a partir del intervalo del tipo de servicio y el ticket nuevo muestra «Próximo servicio» (FR-007, FR-008)

**Prueba independiente**: terminar una orden con un servicio de tipo «Cambio de aceite» (180 días y 5,000 km), abrir el formulario de mantenimiento del vehículo y emitir el ticket; el ticket muestra «Próximo servicio»; una orden sin tipo con intervalo no lo muestra

### Pruebas para US8 (primero, deben fallar)

- [ ] T055 [P] [US8] Escribir `server/tests/unit/next-service.test.js`: `calcularProximoServicio({ tipos, fechaBase, kilometrajeBase })` toma el intervalo en días más corto y el de kilómetros más corto entre los tipos con intervalo, devuelve `{ date, mileage }` con cualquiera `null`, devuelve todo `null` sin tipos con intervalo y es pura (P-5)
- [ ] T056 [P] [US8] Escribir `server/tests/integration/ticket-next-service.test.js`: el ticket de una orden con un tipo con intervalo guarda y devuelve `nextService` (fecha desde la emisión y kilometraje desde `entry_mileage`); con varios tipos usa el intervalo más corto; solo con intervalo en días o solo en kilómetros devuelve el otro campo en `null`; sin tipos con intervalo `nextService` es `null`; un tipo editado después **no** cambia un ticket ya emitido; los tickets anteriores al sprint devuelven `nextService: null` (CA-14)
- [ ] T057 [P] [US8] Escribir `server/tests/integration/maintenance-suggestion.test.js`: `GET /api/maintenances/suggestion?vehicleId=` devuelve la propuesta desde la última orden terminada o entregada del vehículo con tipos con intervalo (fecha desde su fecha de terminación y kilometraje desde `entry_mileage`); `{ "suggestion": null }` sin orden elegible o sin tipos con intervalo; `404 VEHICLE_NOT_FOUND` si el vehículo no existe; `400 VALIDATION_ERROR` sin `vehicleId` o no entero; permitido a ADMIN y MECHANIC y `403 FORBIDDEN` a RECEPTIONIST (CA-5)
- [ ] T058 [P] [US8] Escribir `server/tests/contract/ticket-next-service.contract.test.js` (campo `nextService` de `contracts/changes-to-existing.md`) y `client/test/ticket_next_service_test.dart` (la pantalla y el PDF del ticket muestran «Próximo servicio» con fecha y/o kilometraje solo cuando `nextService` no es `null`) más una prueba en `client/test/maintenance_form_test.dart` de que el formulario precarga la propuesta y permite corregirla

### Implementación de US8

- [ ] T059 [P] [US8] Crear `server/utils/next-service.js` con la función pura `calcularProximoServicio({ tipos, fechaBase, kilometrajeBase })` (intervalo en días más corto y en kilómetros más corto; fecha `YYYY-MM-DD` local) — hace pasar `next-service.test.js`
- [ ] T060 [US8] Modificar `server/models/ticket.model.js` (`crear` guarda `next_service_date` y `next_service_mileage`; `aTicket` los devuelve) y `server/services/tickets.service.js` (`generarTicket` consulta los tipos con intervalo de las líneas de servicio de la orden y calcula `nextService` con la fecha de emisión y `entry_mileage`; `armarTicket` devuelve `nextService`) — research P-5, contracts/changes-to-existing.md
- [ ] T061 [US8] Agregar `proponerMantenimiento(vehicleId)` a `server/services/maintenances.service.js` (última orden `FINISHED` o `DELIVERED` del vehículo con tipos con intervalo; usa `calcularProximoServicio` con `finished_at` y `entry_mileage`), una validación de `vehicleId` en `server/validators/maintenances.js`, y la ruta `GET /suggestion` (`authorize("ADMIN","MECHANIC")`) en `server/routes/maintenances.routes.js` y `server/controllers/maintenances.controller.js`
- [ ] T062 [P] [US8] Modificar `client/lib/models/ticket.dart` (`nextService` con fecha y kilometraje opcionales), `client/lib/screens/tickets/ticket_screen.dart` (línea «Próximo servicio» en pantalla y en el PDF solo cuando existe) y `client/lib/services/api_client.dart` (`proponerMantenimiento`)
- [ ] T063 [US8] Modificar `client/lib/screens/maintenances/maintenance_form_screen.dart` y `client/lib/providers/maintenances_provider.dart`: al elegir el vehículo se consulta la propuesta y se precargan fecha y kilometraje, siempre editables y con una nota «Propuesto desde el servicio X»

**Checkpoint**: US1 a US3 y US8 funcionales; flujo de configuración completo

---

## Fase 7: User Story 9 — Términos y condiciones y aviso de privacidad (Prioridad: P5)

**Objetivo**: todo usuario acepta la versión vigente de los términos y del aviso de privacidad antes de usar el sistema; el bloqueo se valida en el backend y el administrador publica versiones nuevas (FR-018 a FR-021 y FR-032)

**Prueba independiente**: iniciar sesión con un usuario que no ha aceptado, ver la pantalla, aceptar y comprobar que no se vuelve a pedir; publicar una versión nueva y comprobar que se pide de nuevo; rechazar y comprobar que no entra; llamar a la API sin aceptar y recibir `403 TERMS_NOT_ACCEPTED`

### Pruebas para US9 (primero, deben fallar)

- [ ] T064 [P] [US9] Escribir `server/tests/integration/terms.test.js`: `GET /api/terms/current` devuelve la versión vigente (1 tras la migración) y `accepted`; `POST /api/terms/accept` con la versión vigente da `201` la primera vez y `200` al repetir sin duplicar y guarda usuario, versión y fecha; versión distinta de la vigente → `400 VALIDATION_ERROR`; `POST /api/terms` (ADMIN) crea la versión `MAX + 1` sin modificar las anteriores ni las aceptaciones y deja `TERMS_PUBLISHED` en la bitácora; textos vacíos o idénticos → `400 TERMS_UNCHANGED`; RECEPTIONIST y MECHANIC reciben `403 FORBIDDEN` al publicar; `GET /api/terms/acceptances` lista aceptaciones y `pendingUsers` con paginación (máximo 200) solo para ADMIN; el texto de la versión 1 menciona los cuatro temas del CA-18 (uso permitido del sistema, confidencialidad de los datos de clientes y vehículos, responsabilidad de las cuentas personales y aviso de privacidad) (CA-17, CA-18)
- [ ] T065 [P] [US9] Escribir `server/tests/integration/terms-gate.test.js`: un usuario sin aceptación vigente recibe `403 TERMS_NOT_ACCEPTED` en una ruta de **cada uno de los 14 routers** (clients, users, vehicles, history, appointments, service-orders, maintenances, parts, payments, tickets, dashboard, notifications, client-notices y los nuevos del sprint) y **no** en `GET /api/terms/current`, `POST /api/terms/accept`, `GET /api/auth/me` y `POST /api/auth/logout`; tras aceptar recupera el acceso; al publicar una versión nueva queda bloqueado de nuevo hasta aceptarla; `login` y `me` devuelven `termsAccepted` verdadero o falso según corresponda; un usuario desactivado sigue recibiendo su error propio (CA-16, CA-19, SC-010)
- [ ] T066 [P] [US9] Escribir `server/tests/contract/terms.contract.test.js` con las formas de `contracts/terms.md` y `termsAccepted` de `contracts/changes-to-existing.md`
- [ ] T067 [P] [US9] Escribir `client/test/terms_gate_test.dart`: tras iniciar sesión con `termsAccepted` falso se muestra la pantalla de aceptación (términos y aviso de privacidad) antes del shell; aceptar la cierra y entra; rechazar cierra la sesión; si la versión cambió mientras se leía se recarga; si se publica una versión nueva con la sesión abierta, la siguiente llamada que responde `403 TERMS_NOT_ACCEPTED` muestra la pantalla de aceptación sin cerrar la sesión y, al aceptar, continúa; la sección de términos en Configuración publica una versión nueva con confirmación y lista aceptaciones y pendientes (ADMIN)

### Implementación de US9

- [ ] T068 [P] [US9] Crear `server/models/terms.model.js` (`versionVigente()`, `buscarVersion`, `aceptacion(userId, versionId)`, `registrarAceptacion` idempotente por `UNIQUE (user_id, terms_version_id)`, `publicar` con `MAX(version) + 1`, `listarAceptaciones({ version, page, pageSize })` y `usuariosPendientes(versionId)`) — data-model.md
- [ ] T069 [P] [US9] Crear `server/validators/terms.js` (`termsAcceptSchema` con `version` entero positivo; `termsPublishSchema` con `termsText` y `privacyText` de 1 a 20,000 caracteres; parámetros de paginación de aceptaciones) con mensajes en español
- [ ] T070 [US9] Crear `server/services/terms.service.js` (`obtenerVigente(usuario)`, `aceptar(version, usuario)` → 201 o 200, `publicar(datos, usuario)` con `TERMS_UNCHANGED` y registro `TERMS_PUBLISHED`, `aceptaciones(...)`) y añadir `termsNotAccepted` (403) y `termsUnchanged` (400) a `server/utils/errors.js`
- [ ] T071 [US9] Modificar `server/middlewares/authenticate.js`: tras cargar al usuario, verificar que tenga aceptación de la versión vigente y responder `403 TERMS_NOT_ACCEPTED` si no; exportar además `authenticateSinTerminos` (misma autenticación sin esa verificación) para las cuatro rutas exentas — research P-11
- [ ] T072 [US9] Crear `server/controllers/terms.controller.js` y `server/routes/terms.routes.js` (`GET /current` y `POST /accept` con `authenticateSinTerminos`; `POST /` y `GET /acceptances` con `authenticate` y `authorize("ADMIN")`), montar `rutas.use("/terms", ...)` en `server/routes/index.js` y cambiar `GET /me` y `POST /logout` de `server/routes/auth.routes.js` a `authenticateSinTerminos`
- [ ] T073 [US9] Modificar `server/services/auth.service.js` y `server/controllers/auth.controller.js`: `login` y `obtenerSesion` agregan `termsAccepted` (si el usuario aceptó la versión vigente) a la respuesta sin cambiar el resto
- [ ] T074 [P] [US9] Crear `client/lib/models/terms.dart` y `client/lib/providers/terms_provider.dart` (`cargarVigente`, `aceptar`, `rechazar` que cierra sesión, `publicar`, `aceptaciones`), registrar el proveedor en `client/lib/main.dart`, agregar los métodos de `/api/terms` a `client/lib/services/api_client.dart` y exponer `termsAccepted` en `client/lib/providers/session_provider.dart` y `client/lib/models/user.dart`; `session_provider.dart` (`procesarErrorSesion`) pone `termsAccepted = false` ante un `403 TERMS_NOT_ACCEPTED` en cualquier llamada para que `_Raiz` muestre la pantalla de aceptación sin cerrar la sesión (CA-19)
- [ ] T075 [US9] Crear `client/lib/screens/terms/terms_acceptance_screen.dart` (pantalla completa con los textos, «Acepto» y «No acepto» con confirmación, estados de carga y error) y conectar la puerta en `_Raiz` de `client/lib/main.dart`: si hay sesión y `termsAccepted` es falso, mostrar esta pantalla en lugar de `AppShell`
- [ ] T076 [US9] Agregar la sección «Términos y condiciones» a `client/lib/screens/settings/settings_screen.dart` (versión vigente, edición de ambos textos con la confirmación de cambios sin guardar, publicar con confirmación y lista de aceptaciones y pendientes con paginación)
- [ ] T077 [US9] Ejecutar la regresión completa del backend (`cd server && npm.cmd test`) con el bloqueo activo y corregir cualquier suite que cree usuarios por fuera del helper; confirmar que el conteo de pruebas existentes en verde no baja (R-01)

**Checkpoint**: US1 a US3, US8 y US9 funcionales; el bloqueo por términos protege toda la API

---

## Fase 8: User Story 10 — Seguridad de la información (Prioridad: P6)

**Objetivo**: bitácora de solo inserción con consulta filtrada, política de contraseñas con longitud máxima, cierre por inactividad validado en el backend, respuestas sin datos reservados y entradas sin inyección (FR-022 a FR-028)

**Prueba independiente**: cambiar un precio, un rol y la configuración y ver los registros en la bitácora sin datos sensibles; crear un usuario con una contraseña que incumple la política; dejar la sesión inactiva hasta que se cierre; revisar que ninguna respuesta expone hash, token ni precios reservados

### Pruebas para US10 (primero, deben fallar)

- [ ] T078 [P] [US10] Escribir `server/tests/integration/audit-log.test.js`: cada acción del catálogo queda registrada al ejecutar su operación real (`LOGIN_FAILED` y `ACCOUNT_LOCKED` con credenciales erróneas, `USER_CREATED`, `USER_UPDATED` en cambio de rol y en baja o reactivación, `SETTINGS_UPDATED`, `PART_PRICE_CHANGED` solo cuando cambia un precio, `ORDER_PART_PRICE_CORRECTED`, `PAYMENT_CANCELLED` y `TERMS_PUBLISHED`) con usuario, acción, entidad y fecha; `GET /api/audit-log` filtra por `from`, `to`, `userId` y `action`, ordena de más reciente a más antiguo y pagina (50 por omisión, máximo 200); validación de fechas, `action` fuera del catálogo y paginación → `400 VALIDATION_ERROR`; solo ADMIN (los otros roles `403`); un recorrido del router montado confirma que **ninguna** ruta crea, edita ni borra registros de la bitácora; ningún `detail` contiene contraseñas, hashes, tokens ni datos de tarjeta (CA-20, CA-21, SC-011)
- [ ] T079 [P] [US10] Escribir `server/tests/integration/password-policy.test.js`: alta de usuario y `POST /api/auth/change-password` rechazan con `400 WEAK_PASSWORD` y el requisito faltante en `details` una contraseña de menos de 8 caracteres, sin mayúscula, sin minúscula, sin número y de más de 64 caracteres («Debe tener 64 caracteres como máximo.»); una contraseña válida de 64 caracteres se acepta; dos contraseñas largas que difieren después del carácter 72 ya no pueden coexistir; `login` rechaza una contraseña de más de 128 caracteres con `400 VALIDATION_ERROR`; las contraseñas se siguen guardando solo con hash (CA-22, SC-012)
- [ ] T080 [P] [US10] Escribir `server/tests/integration/session-idle.test.js`: una petición autenticada con `last_activity_at` de más de 30 minutos responde `401 SESSION_IDLE`; con actividad reciente funciona y refresca `last_activity_at` como máximo una vez por minuto; `login` fija `last_activity_at`; un valor `NULL` se trata como activo; la expiración del token de 8 horas se sigue validando igual (CA-23)
- [ ] T081 [P] [US10] Escribir `server/tests/integration/data-exposure.test.js`: recorre los endpoints de usuarios, refacciones, órdenes, pagos y tickets con cada rol y verifica que ninguna respuesta contiene `password`, `passwordHash`, `password_hash` ni `token` (salvo el del login) y que `purchasePrice` y los costos solo llegan a ADMIN (CA-24, SC-013)
- [ ] T082 [P] [US10] Escribir `server/tests/integration/search-injection.test.js`: envía `' OR 1=1 --`, `%`, `_`, comillas y punto y coma a los campos de búsqueda de clientes, vehículos, citas, órdenes, refacciones y usuarios y comprueba respuesta normal (200), sin error 500 y sin devolver filas de más (CA-25)
- [ ] T083 [P] [US10] Escribir `server/tests/contract/audit-log.contract.test.js` (formas de `contracts/audit-log.md`) y `client/test/audit_log_test.dart` (pantalla Bitácora: filtros de fecha, usuario y acción, paginación, estados de carga, vacío y error, sin acciones de edición) y `client/test/inactivity_test.dart` (el detector cierra la sesión a los 30 minutos sin actividad y avisa; la actividad reinicia el reloj; un `401 SESSION_IDLE` cierra la sesión con mensaje)

### Implementación de US10

- [ ] T084 [P] [US10] Agregar `idleMinutes: 30` a `server/config/env.js`; modificar `server/validators/auth.js` (`requisitoFaltantePassword` agrega «Debe tener 64 caracteres como máximo.» y `loginSchema` acota `password` a 128 caracteres con mensaje en español)
- [ ] T085 [US10] Modificar `server/models/user.model.js` (`buscarUsuarioPorId` devuelve `lastActivityAt`; nueva `registrarActividad(id)` que actualiza `last_activity_at`), `server/middlewares/authenticate.js` (responde `401 SESSION_IDLE` si pasaron más de `idleMinutes`, refresca como máximo una vez por minuto y trata `NULL` como activo) y `server/services/auth.service.js` (`login` fija la actividad); añadir `sessionIdle` (401) a `server/utils/errors.js` — research P-12
- [ ] T086 [US10] Modificar `server/services/auth.service.js` para registrar `LOGIN_FAILED` (identificador recortado a 100 caracteres) y `ACCOUNT_LOCKED` (minutos) con `audit.service.registrar`, sin romper el comportamiento actual de bloqueo
- [ ] T087 [US10] Modificar `server/services/users.service.js` (`create` registra `USER_CREATED` con el rol; `update` registra `USER_UPDATED` con campo y valores anterior y nuevo cuando cambian `role` o `active`) y su controlador para pasar el usuario que actúa
- [ ] T088 [US10] Modificar `server/services/inventory.service.js` (`updatePart` recibe el usuario que actúa y registra `PART_PRICE_CHANGED` solo cuando cambia `purchase_price` o `sale_price`; `corregirPrecioRefaccionOrden` registra `ORDER_PART_PRICE_CORRECTED`) y `server/services/payments.service.js` (`cancelarPago` recibe el usuario y registra `PAYMENT_CANCELLED`); ajustar los controladores correspondientes (`parts`, `service_orders` y `payments`) para pasar `req.user`
- [ ] T089 [P] [US10] Crear `server/validators/audit.js` (`auditQuerySchema`: `from` y `to` como `YYYY-MM-DD` con `to` ≥ `from`, `userId` entero positivo, `action` dentro del catálogo, `page` y `pageSize` enteros con `pageSize` máximo 200) con mensajes en español
- [ ] T090 [US10] Crear `server/controllers/audit.controller.js` y `server/routes/audit.routes.js` (solo `GET /` con `authenticate` y `authorize("ADMIN")`) y montar `rutas.use("/audit-log", ...)` en `server/routes/index.js`
- [ ] T091 [P] [US10] Crear `client/lib/models/audit_entry.dart` y `client/lib/providers/audit_provider.dart` (filtros, paginación, estados), registrar el proveedor en `client/lib/main.dart` y agregar `listarBitacora` a `client/lib/services/api_client.dart`
- [ ] T092 [US10] Crear `client/lib/screens/audit/audit_log_screen.dart` (tabla con fecha, usuario, acción, entidad y detalle; filtros de fecha, usuario y acción; paginación; estados de `states_view.dart`) y agregar la sección «Bitácora» (`roles: {'ADMIN'}`) como **índice 13** de `client/lib/widgets/app_shell.dart` con su ruta en `client/lib/utils/app_route.dart`
- [ ] T093 [P] [US10] Crear `client/lib/widgets/inactivity_detector.dart` (escucha de puntero y teclado y temporizador de 30 minutos) y conectarlo en `_Raiz` de `client/lib/main.dart` para cerrar la sesión local con aviso; asegurar que `client/lib/providers/session_provider.dart` trata `401 SESSION_IDLE` con `procesarErrorSesion` y muestra «Tu sesión se cerró por inactividad»

**Checkpoint (bloque A)**: US1 a US3, US8, US9 y US10 funcionales. Antes de pasar al bloque B: ejecutar la regresión completa (`npm.cmd test`, `npm.cmd run lint`, `flutter test`, `flutter analyze`) y registrar el resultado en `docs/aseguramiento-calidad-sprint-7.md` (SC-014); si el tiempo no alcanza, los reportes (fases 9 a 12) son lo que se aplaza

---

## Fase 9: User Story 4 — Reporte de ingresos por periodo (Prioridad: P7)

**Objetivo**: el administrador consulta los ingresos por periodo, por día y por método de pago, con importes en centavos que coinciden con los pagos (FR-010 a FR-012, FR-015, FR-016)

**Prueba independiente**: con pagos sembrados en distintos días, elegir el mes y comprobar que el total coincide con la suma de los pagos `PAID` del periodo

### Pruebas para US4 (primero, deben fallar)

- [ ] T094 [P] [US4] Escribir `server/tests/integration/reports-income.test.js`: `GET /api/reports/income` cuenta solo pagos `PAID` por `DATE(updated_at)` (no cuenta `PENDING`, `REJECTED` ni `CANCELLED`); `rows` por fecha y método y `totals` con `byMethod` coinciden **al centavo** con una suma independiente calculada en la prueba a partir de `payments` (CA-7, SC-006); periodo sin pagos devuelve `rows: []` y totales en `"0.00"`; por omisión el mes en curso; `to` anterior a `from`, rango de más de 366 días, fecha inválida o `format` desconocido → `400 VALIDATION_ERROR`; solo ADMIN (los otros roles `403 FORBIDDEN`) (CA-6, CA-10)
- [ ] T095 [P] [US4] Escribir `server/tests/contract/reports.contract.test.js` (sección de ingresos de `contracts/reports.md`: `from`, `to`, `rows`, `totals`, `truncated` y los tipos de cada campo) y `client/test/reports_test.dart` (pantalla Reportes: selector de periodo con atajos hoy, semana y mes y rango libre, pestaña de ingresos con tabla y totales, estados de carga, vacío y error, y la sección solo para ADMIN)

### Implementación de US4

- [ ] T096 [P] [US4] Crear `server/validators/reports.js` (`reportQuerySchema`: `from` y `to` como `YYYY-MM-DD`, por omisión el primer día del mes en curso y hoy, `to` ≥ `from`, rango máximo 366 días, `format` `json` o `csv`) con mensajes en español
- [ ] T097 [US4] Crear `server/models/report.model.js` con `ingresosPorDiaYMetodo({ from, to })` (pagos `PAID` agrupados por `DATE(updated_at)` y `method`, importes como `DECIMAL` leídos para convertir a centavos)
- [ ] T098 [US4] Crear `server/services/reports.service.js` con `ingresos({ from, to })`: convierte a centavos enteros con `aCentavos`, suma y devuelve `{ from, to, rows, totals: { count, total, byMethod }, truncated }` con importes `aCadena` de 2 decimales y tope de 500 filas
- [ ] T099 [US4] Crear `server/controllers/reports.controller.js` y `server/routes/reports.routes.js` (`GET /income` con `authenticate`, `authorize("ADMIN")` y `validate` de la consulta) y montar `rutas.use("/reports", ...)` en `server/routes/index.js`
- [ ] T100 [P] [US4] Crear `client/lib/models/report_result.dart` (resultado genérico: `from`, `to`, filas, totales y `truncated`) y `client/lib/providers/reports_provider.dart` (periodo, `cargarIngresos`, estados), registrar el proveedor en `client/lib/main.dart` y agregar `obtenerReporte(nombre, from, to)` a `client/lib/services/api_client.dart`
- [ ] T101 [US4] Crear `client/lib/screens/reports/reports_screen.dart` con selector de periodo (hoy, semana, mes y rango libre con validación de 366 días) y la pestaña «Ingresos» (tabla por fecha y método y totales); agregar la sección «Reportes» (`roles: {'ADMIN'}`) como **índice 12** de `client/lib/widgets/app_shell.dart` con su ruta en `client/lib/utils/app_route.dart`
- [ ] T102 [US4] Ampliar `server/scripts/seed.js` (idempotente por `external_reference` propia) con pagos `PAID` de ejemplo repartidos entre el mes en curso y el anterior, sin tocar los pagos existentes, para que Ingresos muestre información (CA-12)

**Checkpoint**: el reporte de ingresos funciona y su selector de periodo queda listo para los demás

---

## Fase 10: User Story 5 — Servicios más frecuentes y productividad por mecánico (Prioridad: P8)

**Objetivo**: ranking de servicios frecuentes y productividad por mecánico (órdenes terminadas e importe de mano de obra) sobre la fecha de terminación que se escribe desde la Fase 2 (FR-010, D-07, D-19)

**Prueba independiente**: con órdenes terminadas de varios mecánicos en un periodo, el ranking de servicios y la tabla de productividad coinciden con las órdenes que los originan

### Pruebas para US5 (primero, deben fallar)

- [ ] T103 [P] [US5] Escribir `server/tests/integration/reports-services-productivity.test.js`: `GET /api/reports/services` agrupa las líneas de órdenes `FINISHED` o `DELIVERED` con `finished_at` en el rango por tipo de servicio, ordena de más a menos frecuentes y agrupa las líneas sin tipo en «Sin tipo de servicio»; `GET /api/reports/productivity` cuenta por mecánico las órdenes terminadas en el rango y suma su mano de obra con la **misma regla** de `server/services/order-total.service.js` (`horas × tarifa` redondeada a centavos), coincidiendo al centavo con una suma independiente; `approximateDates` cuenta las órdenes con fecha aproximada; solo ADMIN; validación de rango (CA-6, CA-7, SC-006)
- [ ] T104 [P] [US5] Ampliar `server/tests/contract/reports.contract.test.js` (secciones de servicios y productividad de `contracts/reports.md`) y `client/test/reports_test.dart` (pestañas «Servicios» y «Productividad» con su nota de fechas aproximadas)

### Implementación de US5

- [ ] T105 [US5] Ampliar `server/models/report.model.js` con `serviciosFrecuentes({ from, to })` (por tipo, con las líneas sin tipo agrupadas) y `productividad({ from, to })` (por mecánico, con las horas y tarifas de `order_labor` y el conteo `approximateDates` de órdenes con `finished_at_estimated = 1`)
- [ ] T106 [US5] Ampliar `server/services/reports.service.js` con `servicios(...)` y `productividad(...)` (centavos con `aCentavos`/`aCadena`; mano de obra con la regla de `order-total.service.js`; `approximateDates`) y las rutas `GET /services` y `GET /productivity` en `server/routes/reports.routes.js` y `server/controllers/reports.controller.js`
- [ ] T107 [US5] Ampliar `client/lib/providers/reports_provider.dart` (`cargarServicios`, `cargarProductividad`) y `client/lib/screens/reports/reports_screen.dart` (pestañas «Servicios» y «Productividad» con la nota de fechas aproximadas)
- [ ] T108 [US5] Ampliar `server/scripts/seed.js` (idempotente) para dejar `finished_at` coherente en las órdenes terminadas de ejemplo, repartidas entre el mes en curso y el anterior y entre los mecánicos sembrados, con servicios tipados y sin tipo (CA-12)

**Checkpoint**: servicios frecuentes y productividad funcionan

---

## Fase 11: User Story 6 — Costo, margen de refacciones y rotación de inventario (Prioridad: P9)

**Objetivo**: costo, precio y margen por refacción con el costo congelado por línea, líneas sin costo excluidas del margen y rotación de inventario (FR-010, FR-013; D-05, D-08)

**Prueba independiente**: con órdenes que usan refacciones con precio de compra y de venta, costo, precio y margen coinciden con las líneas de orden, y una línea sin costo se muestra aparte sin inflar el margen

### Pruebas para US6 (primero, deben fallar)

- [ ] T109 [P] [US6] Escribir `server/tests/unit/inventory-rotation.test.js`: la existencia al cierre es `stock_current − Σ movimientos posteriores al fin` y la de inicio es `existencia al cierre − Σ movimientos del periodo`, con el signo del movimiento (`IN` suma, `OUT` resta con `quantity` positivo, `ADJUSTMENT` con signo); `rotación = unidades OUT / ((inicio + cierre) / 2)`; existencia promedio 0 → rotación `null` (D-08, P-9)
- [ ] T110 [P] [US6] Escribir `server/tests/integration/order-part-unit-cost.test.js`: al agregar una refacción a una orden se guarda `unit_cost` con el `purchase_price` vigente, o `NULL` si es 0; un cambio posterior del precio de compra **no** altera `unit_cost` de líneas ya agregadas; las respuestas y la proyección por rol del Sprint 5 no cambian y `unit_cost` nunca llega a MECHANIC (P-8, CA-8)
- [ ] T111 [P] [US6] Escribir `server/tests/integration/reports-parts.test.js`: `GET /api/reports/parts-margin` por refacción con ventas (`quantity × unit_price`), costo (`quantity × unit_cost` solo en líneas con costo) y margen (ventas con costo − costo); las líneas sin costo se excluyen del margen y sus unidades y ventas salen en `unitsWithoutCost` y `salesWithoutCost`; se cumplen las relaciones `salesAmount` = ventas con costo + `salesWithoutCost` y `units` incluye `unitsWithoutCost`; coincide al centavo con una suma independiente; `GET /api/reports/inventory-rotation` con `unitsOut`, `averageStock` y `rotation` (`null` sin existencia); solo ADMIN (CA-6, CA-8, SC-006, D-05)
- [ ] T112 [P] [US6] Ampliar `server/tests/contract/reports.contract.test.js` (secciones de margen y rotación de `contracts/reports.md`) y `client/test/reports_test.dart` (pestañas «Margen de refacciones» y «Rotación» con la marca «sin costo registrado»)

### Implementación de US6

- [ ] T113 [US6] Modificar `server/models/order_part.model.js` (`crear` recibe y guarda `unitCost`) y `server/services/inventory.service.js` (`agregarRefaccionOrden` consulta también `purchase_price` y pasa `unitCost` = `purchase_price` si es mayor que 0 o `null` si es 0) sin cambiar la respuesta ni la proyección por rol
- [ ] T114 [P] [US6] Crear `server/utils/inventory-rotation.js` con la función pura `calcularRotacion({ stockActual, movimientosPeriodo, movimientosPosteriores })` que devuelve `{ unitsOut, averageStock, rotation }` — hace pasar `inventory-rotation.test.js`
- [ ] T115 [US6] Ampliar `server/models/report.model.js` con `margenRefacciones({ from, to })` (líneas de `order_parts` de órdenes con `finished_at` en el rango, con `unit_cost` nulo o no) y `movimientosPorRefaccion({ from, to })` (movimientos del periodo y posteriores al fin por refacción)
- [ ] T116 [US6] Ampliar `server/services/reports.service.js` con `margenRefacciones(...)` y `rotacionInventario(...)` (centavos; ventas, costo y margen según las relaciones del contrato; rotación con `calcularRotacion`) y las rutas `GET /parts-margin` y `GET /inventory-rotation` en `server/routes/reports.routes.js` y `server/controllers/reports.controller.js`
- [ ] T117 [US6] Ampliar `client/lib/providers/reports_provider.dart` y `client/lib/screens/reports/reports_screen.dart` con las pestañas «Margen de refacciones» (columnas de ventas, costo, margen y la marca «sin costo registrado» con las ventas aparte) y «Rotación» (rotación vacía como «sin existencia»)
- [ ] T118 [US6] Ampliar `server/scripts/seed.js` (idempotente) con líneas de refacción con `unit_cost` en órdenes terminadas del periodo, **una línea sin costo** (caso D-05) y movimientos de inventario del periodo para que Margen y Rotación muestren información (CA-12)

**Checkpoint**: los cinco reportes calculan y se muestran

---

## Fase 12: User Story 7 — Exportar cada reporte (Prioridad: P10)

**Objetivo**: cada reporte se exporta a CSV con el mismo contenido que la pantalla, sin dependencias nuevas (FR-014; D-01, P-10)

**Prueba independiente**: exportar cada reporte y comparar el contenido del archivo con la pantalla, fila por fila

### Pruebas para US7 (primero, deben fallar)

- [ ] T119 [P] [US7] Escribir `server/tests/unit/csv.test.js`: `filasACsv` produce BOM UTF-8, separador coma, punto decimal, comillas dobles escapadas y campos con comas o saltos de línea entre comillas; neutraliza con una comilla simple cualquier celda de texto que empiece con `=`, `+`, `-` o `@`; conserva acentos y eñes; sin filas devuelve solo los encabezados (P-10, R-07)
- [ ] T120 [P] [US7] Escribir `server/tests/integration/reports-export.test.js`: para cada uno de los cinco reportes `?format=csv` responde `200` con `Content-Type: text/csv; charset=utf-8` y `Content-Disposition: attachment; filename="reporte-<nombre>-<from>-<to>.csv"`; el contenido coincide fila por fila con las `rows` del JSON para los mismos filtros (CA-9, SC-007); los encabezados están en español según `contracts/reports.md`; sin datos solo hay encabezados; un nombre de cliente o de refacción que empieza con `=` sale neutralizado; solo ADMIN
- [ ] T121 [P] [US7] Ampliar `client/test/reports_test.dart` con la exportación: el botón «Exportar CSV» escribe el archivo en una carpeta inyectable (en producción `%USERPROFILE%\Documents\Motorix\reportes`), nombra el archivo con el reporte y el periodo y muestra la ruta resultante en un mensaje; un error de escritura muestra un mensaje claro

### Implementación de US7

- [ ] T122 [P] [US7] Crear `server/utils/csv.js` con `filasACsv({ encabezados, filas })` (BOM, separador coma, escape de comillas, neutralización de fórmulas) — hace pasar `csv.test.js`
- [ ] T123 [US7] Modificar `server/services/reports.service.js` para que cada reporte exponga una única estructura de filas y encabezados en español de la que salen el JSON y el CSV, y `server/controllers/reports.controller.js` para responder `text/csv; charset=utf-8` con `Content-Disposition` cuando `format=csv` (incluida la fila final `TOTAL` del reporte de ingresos)
- [ ] T124 [US7] Agregar a `client/lib/services/api_client.dart` la descarga del CSV de un reporte y a `client/lib/providers/reports_provider.dart` la acción `exportar` que escribe el archivo con `dart:io` en la carpeta de Documentos del usuario (`Motorix\reportes`), sin dependencias nuevas; agregar el botón «Exportar CSV» a `client/lib/screens/reports/reports_screen.dart` con mensaje de éxito y de error

**Checkpoint (bloque B)**: los cinco reportes y su exportación funcionan; regresión completa en verde

---

## Fase 13: Pulido y preocupaciones transversales

**Propósito**: rendimiento, regresión, documentación, evidencia y cierre

- [ ] T125 [P] Escribir `server/tests/integration/reports-performance.test.js`: cada reporte responde en menos de 3 segundos con los datos de ejemplo y con un rango de un año, y un rango de más de 366 días se rechaza con mensaje claro (CA-11, SC-008)
- [ ] T126 [P] Escribir o ampliar la prueba de idempotencia de seeds del sprint (`server/tests/integration/seed-sprint7.test.js`): el seed ampliado corrido dos veces no duplica tipos de servicio, configuración, pagos de ejemplo ni líneas, y la segunda corrida informa 0 registros nuevos (CA-12)
- [ ] T127 [P] Actualizar `docs/project-context.md` (sección «Sprint 7» con el comportamiento entregado, las reglas nuevas de configuración, términos, bitácora e inactividad, y la nota de que los datos del taller y los márgenes viven en la aplicación con valores de respaldo en código) y revisar `docs/design-system.md` (solo si se agregó algún token; no se espera) — FR-031, CA-15
- [ ] T128 [P] Actualizar `README.md` (módulos y pantallas del Sprint 7 y la lista de documentación) y `.env.example` solo si hace falta aclarar que los datos del taller y los márgenes ya no se configuran por variables de entorno (CA-15)
- [ ] T129 Ejecutar la regresión completa: `cd server && npm.cmd test` y `npm.cmd run lint`, y en `client/` `flutter test` y `flutter analyze`; confirmar que ninguna prueba de la línea base falla (SC-014) y anotar conteos en `docs/aseguramiento-calidad-sprint-7.md` (sección de regresión)
- [ ] T130 Verificar contra la API en ejecución los escenarios V1 a V13 de `specs/007-reportes-configuracion/quickstart.md` que se pueden comprobar sin interfaz (V1, V2, V3, V4, V5, V6, V7, V8 con la hora de última actividad ajustada, V9, V10, V11, V12 y V13), dejando limpios los datos de prueba, y registrar resultados en `docs/evidencias/sprint-7/`
- [ ] T131 Recorrido manual de extremo a extremo siguiendo `specs/007-reportes-configuracion/quickstart.md` (los escenarios con pantalla: V1, V3, V4, V5, V6, V9, V10 y V11, más V8 para el cierre por inactividad) y dejar las capturas en `docs/evidencias/sprint-7/` (**lo hace el usuario**; el agente lo guía y registra los resultados)
- [ ] T132 Completar `docs/aseguramiento-calidad-sprint-7.md`: trazabilidad de CA-1 a CA-26 con tareas y pruebas, decisiones D-01 a D-19, riesgos R-01 a R-08, hallazgos, línea base y regresión con conteos, anexo de evidencias y cierre con la aprobación del responsable y la fecha

---

## Dependencias y orden de ejecución

### Dependencias por fase

- **Preparación (Fase 1)**: sin dependencias
- **Fundacional (Fase 2)**: depende de la Fase 1; **bloquea todas las historias**
- **Historias (Fases 3 a 12)**: dependen de la Fase 2; el orden recomendado es el de prioridad (US1, US2, US3, US8, US9, US10, US4, US5, US6, US7)
- **Pulido (Fase 13)**: depende de las historias que vayan a entregarse

### Dependencias entre historias

- **US1 (P1)**: arranca tras la Fase 2; crea la pantalla de Configuración y la ruta `/api/settings` que reutilizan US2, US3 y US9
- **US2 (P2)**: depende de US1 (pantalla y servicio de configuración)
- **US3 (P3)**: depende de la Fase 2; su pantalla se agrega a la Configuración creada en US1
- **US8 (P4)**: depende de US3 (tipos de servicio), de US1 (instantánea del ticket) y de `finished_at` (Fase 2)
- **US9 (P5)**: depende de la Fase 2; la prueba del bloqueo exige que el helper ya acepte los términos (tarea de la Fase 2)
- **US10 (P6)**: depende de la Fase 2 (bitácora) y de US9 (`authenticate` se modifica una sola vez por orden); los registros de precios y pagos usan servicios del Sprint 4 y 5
- **US4 (P7)**: depende de la Fase 2; crea el router, el selector de periodo y la pantalla de Reportes que reutilizan US5, US6 y US7
- **US5 (P8)**: depende de US4 (router y pantalla) y usa `finished_at`, que se escribe desde la Fase 2
- **US6 (P9)**: depende de US4 y se apoya en `unit_cost` y en `finished_at` (Fase 2) para imputar las líneas a un periodo
- **US7 (P10)**: depende de que existan los cinco reportes (US4 a US6)

### Dentro de cada historia

- Pruebas primero (deben fallar) → validadores y modelos → servicios → controladores y rutas → frontend
- Cada llamada a la bitácora se agrega junto con la operación que audita y se prueba en US10
- Una historia debe quedar en verde antes de pasar a la siguiente

### Oportunidades de paralelismo

- En la Fase 2, las pruebas fundacionales y los modelos de `settings` y `audit` son archivos distintos
- Dentro de cada historia, las pruebas marcadas **[P]** (backend, contrato y Flutter) se escriben en paralelo
- Los modelos, validadores y proveedores marcados **[P]** son archivos independientes
- US3 y US9 pueden avanzar en paralelo tras US1 si hay más de una persona

## Ejemplo paralelo: User Story 9

```text
# Pruebas de US9 en paralelo (archivos distintos):
terms.test.js  |  terms-gate.test.js  |  terms.contract.test.js  |  terms_gate_test.dart

# Después, en paralelo:
terms.model.js  |  validators/terms.js  |  terms.dart + terms_provider.dart

# Luego, en secuencia (mismos archivos compartidos):
terms.service.js → authenticate.js → terms.routes.js + auth.routes.js → pantalla y puerta en main.dart
```

## Estrategia de implementación

### Bloque A primero (US1 a US3, US8, US9, US10)

1. Completar la Fase 1 (preparación) y la Fase 2 (esquema, configuración con respaldo, bitácora y helper de pruebas)
2. Completar US1 y **validar** (datos del taller y ticket con instantánea)
3. Seguir con US2, US3 y US8 (configuración completa), luego US9 y US10 (términos y seguridad)
4. Cerrar el bloque con la regresión completa en verde

### Bloque B (US4 a US7)

1. US4 crea el router y la pantalla de Reportes; US5 y US6 agregan los demás reportes; US7 agrega la exportación
2. Cerrar con la regresión completa y la fase de pulido

### Entrega incremental

1. Fase 1 + Fase 2 → fundación lista
2. US1 → demo: el ticket muestra los datos del taller editados (**MVP**)
3. US2 → US3 → US8 → demo: márgenes, catálogo y próximo servicio
4. US9 → US10 → demo: términos, bitácora, contraseñas e inactividad
5. US4 → US5 → US6 → US7 → demo: reportes y exportación
6. Pulido y cierre

### Estrategia con equipo paralelo

Con varias personas: una persona completa la Fase 2; después una toma US1 → US2 → US8 (configuración), otra US3 y US9, y una tercera US10; el bloque B se reparte por reporte tras US4.

## Notas

- Las tareas marcadas **[P]** tocan archivos distintos y no dependen de tareas incompletas.
- Cada historia es completable y verificable de forma independiente.
- Verificar que las pruebas fallen antes de implementar; hacer commit tras cada tarea o grupo lógico (Conventional Commits en español).
- Detenerse en cada checkpoint para validar la historia por separado.
- **No** modificar migraciones ya aplicadas; la 016 es la única nueva y es aditiva.
- **No** guardar contraseñas, hashes, tokens ni datos de tarjeta en la bitácora (CA-21); **no** agregar dependencias nuevas en ninguna capa.
- **Ajuste de pruebas existentes**: las pruebas del Sprint 3 que asumían 30 y 500 por omisión al guardar un mantenimiento se ajustan a `NULL` + valor efectivo (T de US2), y las que crean usuarios por fuera del helper se corrigen al activar el bloqueo por términos (T de US9).
- Antes de cerrar, el `quickstart.md` es la guía del recorrido: los escenarios sin interfaz los verifica el agente contra la API y los de pantalla los hace el usuario con capturas, como en el Sprint 6.
