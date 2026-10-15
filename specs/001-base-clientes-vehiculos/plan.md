# Plan de Implementación: Base del sistema, clientes y vehículos (Sprint 1)

**Rama**: `001-base-clientes-vehiculos` | **Fecha**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de la funcionalidad en `specs/001-base-clientes-vehiculos/spec.md`

## Summary

Primer sprint de Motorix: se crea la estructura del repositorio (`client/`, `server/`,
`database/`), la conexión a MySQL local con esquema versionado, autenticación con JWT
(usuario o correo), autorización por roles (ADMIN, RECEPTIONIST, MECHANIC) y los módulos
de clientes y vehículos con su relación obligatoria (vehículo siempre con propietario).
Enfrentamiento técnico: backend Node.js LTS + Express en ES Modules con `mysql2` y
validación `zod`; frontend Flutter + Material 3 con tema propio y Provider; pruebas con
Jest + supertest contra `motorix_test` y `flutter test`.

## Technical Context

**Language/Version**: Dart/Flutter 3.47 (frontend); JavaScript con ES Modules en
Node.js LTS (backend)

**Primary Dependencies**: Express, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`
(backend); Material Design 3, Provider, `google_fonts`, `data_table_2` 2.6.0
(frontend; sin librería complementaria de componentes)

**Storage**: MySQL local (InnoDB, `utf8mb4`), esquema en `database/migrations/` con
registro en `schema_migrations`; base de pruebas `motorix_test`

**Testing**: Jest + supertest en backend (unit, integración y contrato contra
`motorix_test`); `flutter test` en frontend (providers y widgets)

**Target Platform**: escritorio Windows (prioridad escritorio del MVP); backend local
en la misma máquina del equipo

**Project Type**: aplicación monorepo frontend + backend + base de datos local

**Performance Goals**: respuestas API percibidas como instantáneas en local (<200 ms
p95); animaciones de interfaz de 150–250 ms según `docs/design-system.md`

**Constraints**: ESM obligatorio; sin secretos en el repositorio; permisos validados en
el backend; MySQL local sin nube ni Docker; máximo una librería de componentes (elegida:
ninguna); español en interfaz, docs y pruebas; login por usuario o correo

**Scale/Scope**: 3 roles, ~7 pantallas en el Sprint 1, cientos de registros
(clientes/vehículos), equipo pequeño trabajando en paralelo sobre una instancia local

## Constitution Check

*GATE: Debe pasar antes de la investigación de la Fase 0. Se re-verifica después del
diseño de la Fase 1.*

| Puerta (principio de la constitución) | Estado | Evidencia en este plan |
|---------------------------------------|--------|------------------------|
| I. Alcance, MVP y fuente de verdad | PASS | Spec limitado al Sprint 1 en orden (1→4); sin Mercado Pago, dashboard ni tickets; `docs/project-context.md` como fuente |
| II. Arquitectura separada | PASS | `client/`, `server/`, `database/`; capas del backend directamente en `server/` (sin `src/`); lógica de negocio en `services/` |
| III. Stack y base de datos local | PASS | ES Modules + `"type": "module"`; MySQL local con usuario dedicado (nunca `root`); JWT + `bcryptjs`; `.env.example`; InnoDB/`utf8mb4`; scripts SQL en `database/` |
| IV. Seguridad | PASS | Contraseñas con hash (costo 10); `.env` ignorado y sin secretos; permisos por rol en backend; validación con `zod` en backend; errores centralizados sin trazas |
| V. Integridad de reglas de negocio | PASS | RN-1 (sin vehículo sin propietario), RN-5/RN-15 (permisos en backend), RN-16 (login usuario o correo), RN-17 (política de contraseña) |
| VI. API consistente y errores | PASS | Contrato REST en `contracts/` con sobre JSON único, códigos HTTP y manejo de errores centralizado |
| VII. Pruebas | PASS | Jest + supertest contra `motorix_test` (nunca la base principal); `flutter test`; lógica de negocio (login, bloqueo, unicidad, permisos) cubierta |
| VIII. UX/UI profesional | PASS | Toda pantalla sigue `docs/design-system.md`; tokens del tema; confirmaciones obligatorias; sin librería de componentes adicional |

**Resultado**: 8/8 puertas en PASS. Sin violaciones que justificar.

*Re-verificación post Fase 1*: PASS — el modelo de datos usa llaves foráneas InnoDB
`utf8mb4`, los contratos exigen token y rol por endpoint, y el quickstart no contiene
secretos ni comandos contra la base principal.

## Project Structure

### Documentación (esta funcionalidad)

```text
specs/001-base-clientes-vehiculos/
├── plan.md                 # Este archivo
├── research.md             # Fase 0
├── data-model.md           # Fase 1
├── quickstart.md           # Fase 1
├── contracts/              # Fase 1
│   ├── README.md
│   ├── auth.md
│   ├── users.md
│   ├── clients.md
│   └── vehicles.md
├── checklists/
│   └── requirements.md
└── tasks.md                # Fase 2 (/speckit.tasks, no lo crea /speckit.plan)
```

### Código fuente (raíz del repositorio)

```text
motorix/
├── client/
│   ├── lib/
│   │   ├── main.dart
│   │   ├── models/
│   │   ├── screens/
│   │   │   ├── login/
│   │   │   ├── home/
│   │   │   ├── clients/
│   │   │   ├── vehicles/
│   │   │   └── users/
│   │   ├── widgets/          # sidebar, header, tablas, diálogos, estados
│   │   ├── services/         # cliente HTTP y consumos de la API
│   │   ├── providers/        # sesión, catálogos, preferencias de UI
│   │   └── utils/            # app_theme.dart (tokens), constantes, validadores
│   ├── assets/
│   └── pubspec.yaml
│
├── server/
│   ├── config/               # db.js, env.js, jwt.js
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/             # lógica de negocio (auth, users, clients, vehicles)
│   ├── middlewares/          # authenticate, authorize, errorHandler
│   ├── validators/           # esquemas zod
│   ├── utils/
│   ├── scripts/              # create-admin.js, script de seeds
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── contract/
│   └── package.json          # "type": "module"
│
├── database/
│   ├── migrations/           # SQL numerados e inmutables
│   ├── seeds/
│   ├── scripts/              # crear-entorno.ps1, aplicar-migraciones.ps1
│   ├── data/                 # ignorada por Git
│   └── README.md
│
├── docs/
│   ├── project-context.md
│   ├── design-system.md
│   └── reglas.md
│
├── specs/001-base-clientes-vehiculos/
├── .env.example              # DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
├── .gitignore                # incluye .env y database/data/
└── README.md
```

**Decisión de estructura**: monorepo con tres carpetas de primer nivel (`client/`,
`server/`, `database/`) conforme a la constitución. El backend NO lleva carpeta `src/`
intermedia (decisión resuelta del Sprint 1; la sección 11 de `docs/project-context.md`
muestra `server/src/`, decisión posterior que la reemplaza). Los tests del backend viven
en `server/tests/{unit,integration,contract}`.

## Complexity Tracking

> **Rellenar SOLO si el Constitution Check tiene violaciones que deban justificarse**

| Violación | Por qué se necesita | Alternativa más simple rechazada porque |
|-----------|---------------------|-----------------------------------------|
| Sin violaciones | — | — |
