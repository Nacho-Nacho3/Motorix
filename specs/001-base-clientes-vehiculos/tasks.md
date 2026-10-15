---

description: "Lista de tareas para la implementación del Sprint 1"
---

# Tareas: Base del sistema, clientes y vehículos (Sprint 1)

**Input**: Documentos de diseño en `/specs/001-base-clientes-vehiculos/`

**Prerequisitos**: plan.md (obligatorio), spec.md (historias de usuario), research.md,
data-model.md, contracts/, quickstart.md

**Tests**: Se incluyen tareas de prueba porque la constitución (Principio VII) exige
Jest + supertest contra `motorix_test` y `flutter test` para toda la lógica de negocio.

**Organización**: Las tareas están agrupadas por historia de usuario para permitir
implementación y prueba independientes.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: Historia a la que pertenece la tarea (US1…US5)
- Todas las tareas incluyen la ruta exacta del archivo

## Convenciones de rutas

- Frontend: `client/lib/...` (Flutter)
- Backend: `server/` con capas directas (`config/`, `models/`, `services/`,
  `controllers/`, `routes/`, `middlewares/`, `validators/`, `utils/`, `scripts/`,
  `tests/`) — sin carpeta `src/`
- Base de datos: `database/migrations/`, `database/seeds/`, `database/scripts/`

## Phase 1: Setup (Infraestructura Compartida)

**Propósito**: Inicialización del proyecto y estructura básica

- [X] T001 Crear la estructura de directorios del repositorio (`client/lib/{models,screens,widgets,services,providers,utils}`, `server/{config,models,services,controllers,routes,middlewares,validators,utils,scripts,tests/{unit,integration,contract}}`, `database/{migrations,seeds,scripts}`) según `plan.md`
- [X] T002 Inicializar `server/package.json` con `"type": "module"` y dependencias: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `dotenv`; dev: `jest`, `supertest`; scripts `dev`, `start`, `test`, `seed`
- [X] T003 [P] Crear `.gitignore` (incluye `.env` y `database/data/`) y `.env.example` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `JWT_SECRET` sin valores sensibles
- [X] T004 [P] Inicializar proyecto Flutter en `client/` (`client/pubspec.yaml`) con `provider`, `google_fonts` y `data_table_2` 2.6.0, `useMaterial3: true`
- [X] T005 [P] Crear `database/README.md` documentando migraciones (numeradas e inmutables), seeds idempotentes y scripts `crear-entorno.ps1` / `aplicar-migraciones.ps1`
- [X] T006 [P] Configurar lint y formato: `server/eslint.config.js` para el backend y `client/analysis_options.yaml` para Flutter

---

## Phase 2: Foundational (Prerrequisitos Bloqueantes)

**Propósito**: Infraestructura central que DEBE estar completa antes de CUALQUIER historia

**⚠️ CRÍTICO**: Ninguna historia puede comenzar hasta completar esta fase

- [X] T007 Implementar `server/config/env.js`: cargar `.env`, validar que existan `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `JWT_SECRET`, y fallar con mensaje claro en español si faltan
- [X] T008 [P] Implementar pool de conexiones MySQL en `server/config/db.js` con `charset: utf8mb4` y usuario dedicado (nunca `root`)
- [X] T009 Implementar el ejecutor de migraciones en `database/scripts/aplicar-migraciones.ps1`: aplica scripts numerados de `database/migrations/` de forma idempotente con registro en `schema_migrations` (columnas `version`, `applied_at`, `checksum`), y `database/scripts/crear-entorno.ps1` para crear el usuario `motorix_app` (no `root`)
- [X] T010 [P] Implementar `server/utils/response.js` con el sobre único (`{"ok":true,"data"}` / `{"ok":false,"error":{code,message,details?}}`) y `server/middlewares/errorHandler.js`: errores centralizados en español y 500 sin trazas de pila (FR-012)
- [X] T011 [P] Implementar `server/middlewares/validate.js`: ejecuta esquemas `zod` de `server/validators/` y responde 400 `VALIDATION_ERROR` con `details` por campo
- [X] T012 [P] Implementar `server/config/jwt.js` (firmar/verificar token con vencimiento de 8 horas), `server/middlewares/authenticate.js` (verifica token y consulta rol y estado activo del usuario en CADA petición, R-03) y `server/middlewares/authorize.js` (restringe por rol)
- [X] T013 Crear `server/app.js` y `server/routes/index.js`: app Express, montaje de `/api`, manejo de 404 y registro global de `errorHandler`
- [X] T014 [P] Crear `client/lib/utils/app_theme.dart` con los tokens de `docs/design-system.md`: primario `#9B4F55`, sidebar `#2B2325`, fondo `#F5F2F1`, tipografía IBM Plex Sans (12, 14, 18, 28), espaciado (4, 8, 12, 16, 24, 32), radios (6, 8, 12) y duraciones (150/200/250 ms con `Curves.easeInOut`)
- [X] T015 [P] Crear `client/lib/services/api_client.dart`: HTTP base con sobre ok/error, encabezado `Authorization: Bearer`, manejo de 401/403/423 y mensajes en español
- [X] T016 [P] Crear `client/lib/widgets/` comunes: estados vacío/cargando/error/éxito, diálogo de confirmación ("Confirmar"/"Cancelar") y tabla densa con tokens del tema
- [X] T017 Configurar la base de pruebas: `server/tests/helpers/db.js` que aplica las migraciones contra `motorix_test` (nunca la base principal) y limpia tablas entre pruebas

**Checkpoint**: Base lista — las historias pueden empezar en paralelo

---

## Phase 3: User Story 1 - Inicio de sesión y acceso según el rol (Prioridad: P1) ⭐ MVP

**Goal**: Un usuario autorizado inicia sesión con usuario o correo y accede solo a las funciones de su rol; base `users` con cuentas iniciales

**Independent Test**: Login con `admin` y con el correo del usuario, rechazo de credenciales inválidas, bloqueo tras 5 fallos, y sidebar que oculta Usuarios a roles distintos de ADMIN (V1, V2, V8 del quickstart)

### Tests para User Story 1

- [X] T018 [P] [US1] Prueba de contrato de `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` y `POST /api/auth/change-password` en `server/tests/contract/auth.contract.test.js` (201, 400, 401 `INVALID_CREDENTIALS` con mensaje genérico, 403 `ACCOUNT_DISABLED`, 423 `ACCOUNT_LOCKED`)
- [X] T019 [P] [US1] Prueba de integración de bloqueo por intentos fallidos (5 fallos → 423 con `retryAfterMinutes`; login correcto reinicia el contador) en `server/tests/integration/auth-lockout.test.js`
- [X] T020 [P] [US1] Pruebas unitarias de la política de contraseña ("8 caracteres como mínimo y al menos una mayúscula, una minúscula y un número") y de la detección usuario/correo (si contiene `@` busca por correo) en `server/tests/unit/auth-validation.test.js`

### Implementation para User Story 1

- [X] T021 [P] [US1] Crear migración `database/migrations/001_create_users.sql`: `id` PK, `username` VARCHAR(50) NOT NULL UNIQUE, `name` VARCHAR(100) NOT NULL, `email` VARCHAR(120) NOT NULL UNIQUE, `password_hash` VARCHAR(100) NOT NULL, `role` ENUM('ADMIN','RECEPTIONIST','MECHANIC') NOT NULL, `active` TINYINT(1) NOT NULL DEFAULT 1, `failed_login_attempts` INT UNSIGNED NOT NULL DEFAULT 0, `locked_until` DATETIME NULL, `created_at`, `updated_at`; InnoDB `utf8mb4`
- [X] T022 [P] [US1] Crear `server/validators/auth.js` con esquemas `zod`: `identifier` (obligatorio, no vacío), `password` (obligatorio) y `newPassword` con la política literal: 8 caracteres mínimo, mayúscula, minúscula y número
- [X] T023 [US1] Implementar `server/services/auth.service.js`: `login` (detecta `@`, compara con `bcryptjs` costo 10, consulta `active`, bloquea 15 min tras 5 fallos y responde 423), `me`, `logout` y `changePassword` (valida contraseña actual y política) — depende de T021, T022
- [X] T024 [P] [US1] Crear `server/controllers/auth.controller.js` y `server/routes/auth.routes.js` según `contracts/auth.md`
- [X] T025 [US1] Crear `server/scripts/create-admin.js`: crea las cuentas iniciales `admin`, `recepcion` y `mecanico` con las contraseñas del estándar del MVP hasheadas con `bcryptjs` (costo 10), idempotente (no duplica ni sobreescribe existentes); conectarlo al script `npm run seed` de `server/package.json`
- [X] T026 [P] [US1] Crear `client/lib/models/user.dart` y `client/lib/providers/session_provider.dart` (token, usuario, rol, expiración de 8 horas, cierre de sesión)
- [X] T027 [US1] Crear `client/lib/screens/login/login_screen.dart`: un solo campo para usuario o correo, estados de error en español, sin revelar si falló el usuario o la contraseña
- [X] T028 [US1] Crear `client/lib/widgets/app_shell.dart` y `client/lib/screens/home/home_screen.dart`: sidebar colapsable (`NavigationRail` extendido, ~260 px expandido / ~72 px colapsado) con Inicio, Clientes, Vehículos y Usuarios; Usuarios SOLO visible para ADMIN (FR-019)
- [X] T029 [US1] Integrar la sesión en `client/lib/main.dart`: rutas protegidas (sin token → login), guard de expiración y confirmación obligatoria al cerrar sesión
- [X] T030 [US1] Crear pruebas de Flutter para el login y la sesión en `client/test/session_provider_test.dart` y `client/test/login_screen_test.dart`

**Checkpoint**: User Story 1 funcional y testeable de forma independiente (V1, V2, V8)

---

## Phase 4: User Story 2 - Registrar y consultar clientes (Prioridad: P2)

**Goal**: El recepcionista registra, consulta y encuentra clientes con sus vehículos asociados

**Independent Test**: Registrar "Juan Pérez", verlo en la lista con fecha, abrir su ficha (V3 del quickstart); usa las cuentas creadas en US1

### Tests para User Story 2

- [X] T031 [P] [US2] Pruebas de contrato de `/api/clients` (GET lista con `q`/paginación, GET `:id` con `vehicles[]`, POST 201, POST 400 `VALIDATION_ERROR`, POST 409 `DUPLICATE_PHONE` y 201 al reenviar con `confirmDuplicatePhone: true`) en `server/tests/contract/clients.contract.test.js`
- [X] T032 [P] [US2] Prueba de integración registro → consulta de cliente con permisos por rol (MECHANIC 403 en POST, RECEPTIONIST 200/201) en `server/tests/integration/clients.test.js`

### Implementation para User Story 2

- [X] T033 [P] [US2] Crear migración `database/migrations/002_create_clients.sql`: `id` PK, `name` VARCHAR(100) NOT NULL, `phone` VARCHAR(20) NOT NULL (NO único), `email` VARCHAR(120) NOT NULL (NO único), `active` TINYINT(1) NOT NULL DEFAULT 1 (solo informativo), `created_at`, `updated_at`; índice en `name` y `phone`; InnoDB `utf8mb4`
- [X] T034 [P] [US2] Crear `server/validators/clients.js`: `name` hasta 100 caracteres obligatorio, `phone` hasta 20 caracteres obligatorio (no único), `email` con formato válido obligatorio (no único), `confirmDuplicatePhone` booleano opcional
- [X] T035 [US2] Implementar `server/services/clients.service.js`: `list` (búsqueda `q` por nombre/teléfono/correo, paginación, `vehicleCount`), `getById` (cliente con `vehicles[]`) y `create` (409 `DUPLICATE_PHONE` salvo `confirmDuplicatePhone: true`) — depende de T033, T034
- [X] T036 [US2] Crear `server/controllers/clients.controller.js` y `server/routes/clients.routes.js`: GET para ADMIN/RECEPTIONIST/MECHANIC y POST solo ADMIN/RECEPTIONIST con `authorize`, según `contracts/clients.md`
- [X] T037 [P] [US2] Crear `client/lib/models/client.dart`, `client/lib/providers/clients_provider.dart` y `client/lib/screens/clients/client_list_screen.dart` (búsqueda, estados vacío/cargando/error/éxito)
- [X] T038 [US2] Crear `client/lib/screens/clients/client_form_screen.dart` para alta de clientes con aviso de teléfono repetido y diálogo de confirmación antes de guardar
- [X] T039 [US2] Crear `client/lib/screens/clients/client_detail_screen.dart`: ficha del cliente con la lista de sus vehículos (vacío cuando no tiene) — depende de T035
- [X] T040 [P] [US2] Extender `server/scripts/seed.js` con clientes de ejemplo idempotentes (re-ejecutar no duplica registros)
- [X] T041 [US2] Crear pruebas de Flutter del listado y del alta de clientes en `client/test/clients_test.dart`

**Checkpoint**: User Story 2 funcional de forma independiente (V3)

---

## Phase 5: User Story 3 - Registrar vehículos y asociarlos con su propietario (Prioridad: P3)

**Goal**: Registrar vehículos siempre con un cliente propietario y verlos en la ficha del cliente

**Independent Test**: Rechazar vehículo sin propietario (400 `CLIENT_REQUIRED`), crear uno con placas únicas y verlo en la ficha del cliente; rechazar placas duplicadas (V4 del quickstart, usa clientes de los seeds)

### Tests para User Story 3

- [X] T042 [P] [US3] Pruebas de contrato de `/api/vehicles` (POST 201 con propietario, 400 `CLIENT_REQUIRED` sin `clientId`, 404 `CLIENT_NOT_FOUND`, 409 `DUPLICATE_PLATE`, 409 `DUPLICATE_VIN`, 400 por `year` fuera de rango o `currentMileage` negativo) en `server/tests/contract/vehicles.contract.test.js`
- [X] T043 [P] [US3] Prueba de integración: el vehículo creado aparece en `GET /api/clients/:id` y ningún vehículo queda sin propietario (SC-005) en `server/tests/integration/vehicles.test.js`

### Implementation para User Story 3

- [X] T044 [P] [US3] Crear migración `database/migrations/003_create_vehicles.sql`: `id` PK, `client_id` INT UNSIGNED NOT NULL con FK a `clients.id` `ON DELETE RESTRICT`, `brand` VARCHAR(50) NOT NULL, `model` VARCHAR(50) NOT NULL, `year` SMALLINT NOT NULL, `license_plate` VARCHAR(20) NOT NULL UNIQUE, `vin` VARCHAR(20) NULL UNIQUE, `current_mileage` INT UNSIGNED NOT NULL DEFAULT 0, `created_at`, `updated_at`; índice en `client_id`; InnoDB `utf8mb4`
- [X] T045 [P] [US3] Crear `server/validators/vehicles.js`: `clientId` obligatorio, `brand`/`model` hasta 50 caracteres, `year` entre 1900 y el año actual + 1, `licensePlate` obligatorio y único, `vin` opcional y único si se captura, `currentMileage` entero ≥ 0
- [X] T046 [US3] Implementar `server/services/vehicles.service.js`: `create` con RN-1 (sin `clientId` → 400 `CLIENT_REQUIRED`; cliente inexistente → 404; placas repetidas → 409 `DUPLICATE_PLATE`; VIN repetido → 409 `DUPLICATE_VIN`), `list` (filtro `?clientId`, búsqueda `q`) y `getById` — depende de T044, T045
- [X] T047 [US3] Crear `server/controllers/vehicles.controller.js` y `server/routes/vehicles.routes.js`: GET para los 3 roles y POST solo ADMIN/RECEPTIONIST, según `contracts/vehicles.md`
- [X] T048 [P] [US3] Crear `client/lib/models/vehicle.dart` y `client/lib/providers/vehicles_provider.dart`
- [X] T049 [US3] Crear `client/lib/screens/vehicles/vehicle_form_screen.dart` con selector de propietario obligatorio (el guardado se rechaza sin propietario) y manejo de 409 de placas
- [X] T050 [US3] Crear `client/lib/screens/vehicles/vehicle_list_screen.dart` con filtro por cliente y estados vacío/cargando/error
- [X] T051 [P] [US3] Extender `server/scripts/seed.js` con vehículos de ejemplo idempotentes siempre asociados a clientes existentes
- [X] T052 [US3] Crear pruebas de Flutter del registro de vehículos (sin propietario rechazado) en `client/test/vehicles_test.dart`

**Checkpoint**: User Story 3 funcional de forma independiente (V4)

---

## Phase 6: User Story 4 - Editar información de clientes (Prioridad: P4)

**Goal**: Corregir o actualizar datos de un cliente sin perder sus vehículos asociados

**Independent Test**: Cambiar el teléfono de un cliente, reabrir la ficha y verificar el valor nuevo y los vehículos intactos (V5 del quickstart)

### Tests para User Story 4

- [X] T053 [P] [US4] Pruebas de contrato de `PATCH /api/clients/:id` (200 y persistencia, 404 `CLIENT_NOT_FOUND`, 400 por datos inválidos sin aplicar cambios, 409 `DUPLICATE_PHONE` de OTRO cliente, vehículos conservados) en `server/tests/contract/clients-update.contract.test.js`

### Implementation para User Story 4

- [X] T054 [P] [US4] Crear `server/validators/clients-update.js`: todos los campos opcionales pero al menos uno obligatorio; mismas reglas de `name` (100), `phone` (20) y `email` (formato) que el alta
- [X] T055 [US4] Ampliar `server/services/clients.service.js` con `update`: 404 si no existe, no aplica cambios si la validación falla, aplica la misma regla de teléfono duplicado con confirmación, conserva la relación con los vehículos — depende de T054
- [X] T056 [US4] Ampliar `server/routes/clients.routes.js` con `PATCH /api/clients/:id` protegido con `authorize('ADMIN','RECEPTIONIST')` según `contracts/clients.md`
- [X] T057 [US4] Ampliar `client/lib/screens/clients/client_form_screen.dart` con modo edición: precarga de datos, guardado con resultado visible y confirmación al salir con cambios sin guardar
- [X] T058 [US4] Crear pruebas de Flutter de la edición de clientes en `client/test/client_edit_test.dart`

**Checkpoint**: User Story 4 funcional de forma independiente (V5)

---

## Phase 7: User Story 5 - Gestionar usuarios y roles (Prioridad: P5)

**Goal**: El administrador crea, modifica, activa y desactiva usuarios con sus roles

**Independent Test**: Crear usuaria `ana` RECEPTIONIST, iniciar sesión con su usuario y correo, desactivarla y ver 403; roles no ADMIN reciben 403 en `/api/users` (V6 y V7 del quickstart)

### Tests para User Story 5

- [X] T059 [P] [US5] Pruebas de contrato de `/api/users` (POST 201, 409 `DUPLICATE_USERNAME`/`DUPLICATE_EMAIL`, 400 `WEAK_PASSWORD`, 403 para RECEPTIONIST y MECHANIC, PATCH `active:false` y login posterior 403) en `server/tests/contract/users.contract.test.js`

### Implementation para User Story 5

- [X] T060 [P] [US5] Crear `server/validators/users.js`: `username` único hasta 50 caracteres, `email` único con formato, `name` hasta 100, `password` con la política (8, mayúscula, minúscula, número), `role` ENUM `ADMIN|RECEPTIONIST|MECHANIC`, `active` booleano
- [X] T061 [US5] Implementar `server/services/users.service.js`: `list` (filtros `role`, `active`, `q`), `getById`, `create` (409 por username/correo), `update` (nombre, correo, rol, `active`, `password` opcional con política) — depende de T060
- [X] T062 [US5] Crear `server/controllers/users.controller.js` y `server/routes/users.routes.js` con `authorize('ADMIN')` en todas las rutas, según `contracts/users.md`
- [X] T063 [P] [US5] Crear `client/lib/providers/users_provider.dart` reutilizando `client/lib/models/user.dart`
- [X] T064 [US5] Crear `client/lib/screens/users/user_list_screen.dart` y `client/lib/screens/users/user_form_screen.dart` (crear, editar rol, activar/desactivar con confirmación)
- [X] T065 [US5] Conectar la sección Usuarios de `client/lib/widgets/app_shell.dart` al CRUD (visible y navegable solo para ADMIN)
- [X] T066 [US5] Crear pruebas de Flutter de gestión de usuarios (ocultamiento de la sección para roles no ADMIN) en `client/test/users_test.dart`

**Checkpoint**: Las 5 historias funcionan de forma independiente (V6, V7)

---

## Phase 8: Polish y Temas Transversales

**Propósito**: Mejores que afectan a varias historias

- [X] T067 [P] Ejecutar los seeds dos veces seguidas y verificar idempotencia (sin duplicados) y que la base nunca queda vacía tras la instalación (SC-004) revisando `server/scripts/seed.js` y `server/scripts/create-admin.js`
- [X] T068 Ejecutar la guía completa `specs/001-base-clientes-vehiculos/quickstart.md` (escenarios V1–V10) y registrar resultados
- [X] T069 Auditoría de seguridad: sin secretos en el repositorio (`.env` ignorado, `.env.example` limpio), permisos validados en backend en cada endpoint (RN-15), respuestas 500 sin trazas y contraseñas solo con hash (Principio IV)
- [X] T070 [P] Revisión de cumplimiento del sistema de diseño en todas las pantallas contra `docs/design-system.md`: tokens sin valores sueltos, estados vacío/cargando/error/éxito en español, confirmaciones obligatorias y transiciones de 150/200/250 ms (FR-018)
- [X] T071 [P] Actualizar documentación: `README.md` raíz, `database/README.md` y `docs/project-context.md` (sección 27: el set de íconos es el nativo, ya no "pendiente de confirmación" — ver R-08 de `research.md`)
- [X] T072 Ejecutar todas las suites antes de cerrar: `npm test` en `server/` (unit, integración y contrato contra `motorix_test`), `flutter test` y `flutter analyze`; verificar el flujo demostrable completo en menos de 5 minutos (SC-001)

---

## Dependencies & Execution Order

### Dependencias por fase

- **Setup (Fase 1)**: Sin dependencias — puede empezar de inmediato
- **Foundational (Fase 2)**: Depende de Setup — BLOQUEA todas las historias
- **User Stories (Fases 3–7)**: Todas dependen de Foundational
  - Tras Foundational, las historias pueden avanzar en paralelo si hay capacidad
  - O en orden de prioridad: US1 → US2 → US3 → US4 → US5
- **Polish (Fase final)**: Depende de las historias que se decidan implementar

### Dependencias entre historias

- **US1 (P1)**: Tras Foundational; sin dependencias de otras historias (crea `users`)
- **US2 (P2)**: Tras Foundational; usa el login de US1 para probarse, crea `clients`
- **US3 (P3)**: Tras Foundational; requiere la tabla `clients` de US2 (o sus seeds) para el propietario — ver nota abajo
- **US4 (P4)**: Depende de US2 (edita clientes creados por ella)
- **US5 (P5)**: Depende de US1 (tabla `users` y sesión ADMIN); independiente de US2–US4

> **Nota de independencia de US3**: su prueba usa clientes de los seeds (T040), por lo
> que puede validarse sin ejecutar toda US2; en secuencia estricta, ejecutar US2 antes.

### Dentro de cada historia

- Tests primero (deben fallar antes de la implementación)
- Migración/modelo → validadores → servicios → rutas → integración → UI → pruebas Flutter

### Oportunidades de paralelismo

- Todas las tareas `[P]` de Setup y Foundational (archivos distintos)
- Tras Foundational: historias en paralelo (equipo con capacidad)
- Dentro de cada historia: migración `[P]` + validadores `[P]` + tests `[P]` en paralelo
- Frontend y backend de una misma historia pueden trabajar en paralelo

---

## Parallel Example: User Story 3

```text
# Lanzar juntas (sin dependencias entre sí):
Task: "T042 Pruebas de contrato de /api/vehicles en server/tests/contract/vehicles.contract.test.js"
Task: "T043 Prueba de integración de asociación cliente↔vehículo en server/tests/integration/vehicles.test.js"
Task: "T044 Migración 003_create_vehicles.sql en database/migrations/003_create_vehicles.sql"
Task: "T045 Validadores de vehículos en server/validators/vehicles.js"
Task: "T048 Modelo y provider de vehículos en client/lib/models/vehicle.dart y client/lib/providers/vehicles_provider.dart"
```

---

## Implementation Strategy

### MVP Primero (solo User Story 1)

1. Completar Fase 1: Setup
2. Completar Fase 2: Foundational (CRÍTICO — bloquea todo)
3. Completar Fase 3: User Story 1
4. **PARAR Y VALIDAR**: probar US1 de forma independiente (V1, V2, V8)
5. Demostrar si está listo

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 → probar → demostrar (MVP)
3. US2 → probar → demostrar
4. US3 → probar → demostrar
5. US4 → probar → demostrar
6. US5 → probar → demostrar
7. Polish → cierre del sprint con seeds y documentación

### Estrategia de equipo en paralelo

1. Todo el equipo completa Setup + Foundational
2. Cuando termine Foundational:
   - Desarrollador A: US1 (auth + shell)
   - Desarrollador B: US2 (clientes) — tras US1 para pruebas E2E
   - Desarrollador C: US3 (vehículos) — tras los seeds de US2
3. US4 y US5 pueden avanzar en paralelo con capacidad restante

---

## Notes

- Las tareas `[P]` tocan archivos distintos y no dependen de tareas incompletas
- La etiqueta `[Story]` rastrea cada tarea hasta su historia (US1…US5)
- Cada historia es comprobable de forma independiente antes de pasar a la siguiente
- Commits pequeños y en español con Conventional Commits; nunca subir secretos
- Pausar en cualquier checkpoint para validar la historia por separado
- Evitar: tareas vagas, conflictos en el mismo archivo y dependencias entre historias
