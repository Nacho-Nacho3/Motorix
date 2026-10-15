# Investigación — Sprint 1: Base del sistema, clientes y vehículos

**Fecha**: 2026-10-13
**Rama**: `001-base-clientes-vehiculos`

Fuentes consultadas: `.specify/memory/constitution.md`, `docs/project-context.md`
(secciones 5, 10, 11, 12, 16, 24–27), `docs/design-system.md`,
`docs/sprints/sprint-1-base-clientes-vehiculos.md` y las aclaraciones del spec
(sesión 2026-10-13).

Todas las incógnitas del Contexto Técnico quedan resueltas en esta fase: **0
`NEEDS CLARIFICATION` pendientes**.

## Decisiones

### R-01. Backend en Node.js LTS + Express con ES Modules

- **Decisión**: JavaScript con `import`/`export`, `package.json` con `"type": "module"`,
  Express como framework HTTP.
- **Justificación**: lo fija la constitución (Principio III) y la sección 10 de
  `docs/project-context.md`; sin esto los sprints 2–4 no pueden construirse.
- **Alternativas consideradas**: CommonJS (rechazado por la constitución), TypeScript
  (fuera del stack acordado; añade compilación sin beneficio para un MVP académico).

### R-02. Acceso a datos con `mysql2` directo, sin ORM

- **Decisión**: driver `mysql2` con pool de conexiones en `server/config/db.js`;
  consultas en `server/models/`, sin query builder.
- **Justificación**: decisión resuelta en el Sprint 1; la capa queda aislada para poder
  cambiarse sin tocar servicios ni controladores.
- **Alternativas consideradas**: Sequelize/Knex/Prisma (rechazados: complejidad y
  curva de aprendizaje innecesarias para 3 tablas).

### R-03. Autenticación: JWT de 8 horas + `bcryptjs` (costo 10)

- **Decisión**: token JWT con vencimiento de 8 horas; el rol y el estado activo del
  usuario se consultan en cada petición protegida; hash con `bcryptjs` costo 10.
  Tras 5 intentos de login fallidos consecutivos la cuenta se bloquea 15 minutos.
- **Justificación**: JWT y bcrypt los fija la constitución; `bcryptjs` evita compilar
  módulos nativos en Windows (sección 27 de `docs/project-context.md`); consultar rol y
  estado por petición evita que un usuario desactivado conserve acceso hasta expirar el
  token; el bloqueo limita fuerza bruta.
- **Alternativas consideradas**: `bcrypt` nativo (rechazado: compila en Windows),
  sesiones de servidor (rechazado: el stack fija JWT), refresh tokens (rechazados:
  complejidad injustificada para un MVP local de 8 horas).
- **Resuelve lo diferido en `/speckit.clarify`**: duración de la sesión → 8 horas.

### R-04. MySQL local nativo (no Docker) con usuario dedicado `motorix_app`

- **Decisión**: instalación nativa de MySQL en cada máquina; entorno creado con
  `database/scripts/crear-entorno.ps1`; migraciones con
  `database/scripts/aplicar-migraciones.ps1`.
- **Justificación**: decisión resuelta del Sprint 1 (R-04 del contexto) y constitución
  (sin nube ni Docker dentro del MVP).
- **Alternativas consideradas**: Docker (rechazado por decisión del equipo), MySQL en
  la nube (rechazado por la constitución).

### R-05. Migraciones: SQL numerados e inmutables + `schema_migrations`

- **Decisión**: scripts en `database/migrations/` numerados e inmutables, ejecutados
  por scripts idempotentes PowerShell con registro en `schema_migrations`; los cambios
  de esquema son scripts NUEVOS, nunca editar los ya aplicados.
- **Justificación**: la base debe recrearse desde cero (CA-6) sin duplicar aplicaciones.
- **Alternativas consideradas**: migraciones del ORM (rechazado: no hay ORM), un único
  `schema.sql` sin control de versiones (rechazado: no registra qué aplicó cada entorno).

### R-06. Validación de entradas con `zod` en `server/validators/`

- **Decisión**: esquemas `zod` por recurso, mensajes de error en español, ejecutados
  como middleware antes del controlador.
- **Justificación**: decisión resuelta del Sprint 1; cumplimiento de RN-15 y del
  Principio IV (validar también en backend).
- **Alternativas consideradas**: `express-validator`/`joi` (rechazados: decisión ya
  tomada; `zod` además comparte filosofía de esquemas estrictos).

### R-07. Frontend Flutter 3.47 + Material 3 con tema propio + Provider

- **Decisión**: Flutter 3.47 con `useMaterial3: true` y `ThemeData` en
  `client/lib/utils/app_theme.dart`; estado con Provider; dependencias de apoyo
  `google_fonts` y `data_table_2` 2.6.0 (la 3.x no es compatible con Flutter 3.47);
  **sin** librería complementaria de componentes.
- **Justificación**: stack fijado; la aclaración Q3 (2026-10-13) resolvió "ninguna
  librería de componentes"; se siguen los tokens de `docs/design-system.md`.
- **Alternativas consideradas**: React (rechazado en el Sprint 1), Riverpod
  (rechazado: Provider ya está decidido), `shadcn_ui` u otra librería de componentes
  (rechazada en `/speckit.clarify` Q3).

### R-08. Set de íconos: los nativos del sistema de diseño actual

- **Decisión**: usar los iconos incluidos con el sistema de diseño ya fijado; sin
  dependencia nueva de íconos.
- **Justificación**: aclaración Q5 (2026-10-13), confirmada por el equipo.
- **Alternativas consideradas**: `lucide_icons_flutter` (apuntado en la sección 27 de
  `docs/project-context.md` como "pendiente de confirmación del equipo"; queda descartado
  por la confirmación del 2026-10-13).
- **Seguimiento**: actualizar la sección 27 de `docs/project-context.md` para reflejar
  que el set de íconos es el nativo (quita el "pendiente de confirmación").

### R-09. Estructura del backend sin carpeta `src/`

- **Decisión**: `config/`, `controllers/`, `models/`, `routes/`, `services/`,
  `middlewares/`, `validators/` y `utils/` directamente en `server/`.
- **Justificación**: decisión resuelta del Sprint 1; la sección 11 de
  `docs/project-context.md` muestra `server/src/`, pero la decisión posterior la
  reemplaza manteniendo la misma separación de responsabilidades.
- **Alternativas consideradas**: `server/src/` (documentado en el contexto maestro,
  superseded por la decisión del Sprint 1).

### R-10. Pruebas: Jest + supertest contra `motorix_test`; `flutter test`

- **Decisión**: backend con Jest (unit), Jest + supertest (integración y contrato)
  siempre contra `motorix_test`; frontend con `flutter test` (providers y widgets).
  Tests en `server/tests/{unit,integration,contract}`.
- **Justificación**: lo fija la constitución (Principio VII) y el insumo del sprint;
  aislar la base de pruebas protege los datos de desarrollo.
- **Alternativas consideradas**: probar contra la base principal (prohibido),
  Cypress/Playwright para E2E (fuera del alcance definido; la validación E2E del
  quickstart es manual en este sprint).

### R-11. Permisos por rol en el Sprint 1

- **Decisión**: ADMIN gestiona usuarios y tiene acceso completo; RECEPTIONIST registra,
  consulta y edita clientes y vehículos; MECHANIC **solo consulta** clientes y vehículos
  (solo lectura). La autorización se evalúa en backend en cada endpoint.
- **Justificación**: "Reglas funcionales del Sprint 1" de `docs/project-context.md` y
  RN-5/RN-15.
- **Alternativas consideradas**: permisos granulares por permiso individual (rechazado:
  innecesario con 3 roles fijos).

### R-12. Unicidad y avisos de duplicados

- **Decisión**: `username` y `email` de usuarios únicos; `license_plate` de vehículos
  único; `vin` opcional pero único si se captura; el teléfono de un cliente **no** es
  único: si se repite, el backend responde con un aviso y la interfaz pide confirmación
  antes de guardar. El correo del cliente puede repetirse (aclaración Q2).
- **Justificación**: decisiones del Sprint 1 + aclaración Q2 del spec; evita rechazos
  injustificados entre clientes de la misma familia.
- **Alternativas consideradas**: correo de cliente único (rechazado en Q2), sin
  restricción de placas (rechazado: identidad del automóvil).

### R-13. Semántica de cierre de sesión con JWT

- **Decisión**: `POST /api/auth/logout` confirma el cierre y la interfaz descarta el
  token; el servidor no mantiene lista de negros.
- **Justificación**: con JWT de vida corta (8 h) y rol revalidado por petición, una
  lista de negros añade almacenamiento y complejidad sin riesgo real en el MVP.
- **Alternativas consideradas**: blacklist de tokens en la base (rechazada: complejidad
  para un MVP local), cookies de sesión (rechazado: el stack fija JWT).

### R-14. Formato de respuesta de la API

- **Decisión**: JSON con sobre único: `{"ok": true, "data": ...}` en éxito y
  `{"ok": false, "error": {"code", "message", "details?"}}` en error; códigos HTTP
  200/201, 400 (validación), 401 (sin credenciales), 403 (sin permiso o cuenta
  inactiva), 404 (no existe), 409 (conflicto de unicidad o teléfono duplicado sin
  confirmar), 423 (cuenta bloqueada), 500 (genérico sin trazas).
- **Justificación**: Principio VI (respuestas JSON consistentes y códigos apropiados);
  mensajes en español y sin stack traces (Principio IV).
- **Alternativas consideradas**: sobre propio por módulo (rechazado: inconsistencia),
  HTTP status sin cuerpo de error (rechazado: la interfaz necesita mensaje y código
  para mostrar estados en español).

### R-15. Plataforma objetivo: escritorio Windows

- **Decisión**: ejecutar el frontend como aplicación de escritorio Windows durante el
  MVP; backend local en la misma máquina.
- **Justificación**: la constitución da prioridad al escritorio y el equipo trabaja en
  Windows (los scripts del entorno son `.ps1`).
- **Alternativas consideradas**: web (Flutter Web) o móvil (APK); quedan abiertos para
  fases posteriores fuera de este sprint, sin impacto en el alcance.

### R-16. Navegación del Sprint 1

- **Decisión**: sidebar fijo colapsable (`NavigationRail` extendido, ~260 px expandido
  / ~72 px colapsado) con Inicio, Clientes, Vehículos y Usuarios (esta última solo
  visible para ADMIN); tras el login se entra a Inicio.
- **Justificación**: aclaración Q1 del spec y guía de layout de
  `docs/design-system.md` (sección 16 de `docs/project-context.md`).
- **Alternativas consideradas**: navegación por pestañas superiores o secciones dentro
  de Configuración (descartadas en Q1).

## Pendientes fuera de esta fase

- Actualizar `docs/project-context.md` (sección 27) por el cambio de set de íconos
  (R-08) — trazabilidad del Principio I.
- Duración del bloqueo por intentos fallidos (15 min) y política de contraseña ya
  definidas; no requieren más investigación.
