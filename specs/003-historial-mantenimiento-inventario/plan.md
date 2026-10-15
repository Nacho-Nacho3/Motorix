# Plan de Implementación: Historial, mantenimiento e inventario (Sprint 3)

**Rama**: `003-historial-mantenimiento-inventario` | **Fecha**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de la funcionalidad en `specs/003-historial-mantenimiento-inventario/spec.md`

## Summary

Tercer sprint de Motorix: se construye el **historial de servicios por vehículo**
(lectura cronológica calculada de las órdenes TERMINADO/ENTREGADO), el
**mantenimiento preventivo** (registrar el próximo mantenimiento por fecha y/o
kilometraje con antelación configurable, y consultar próximos y vencidos) y el
**inventario de refacciones** (catálogo y stock con alertas de stock bajo; al
agregar una refacción a una orden se genera automáticamente una salida que nunca
deja el stock en negativo). Enfoque técnico: hereda el stack completo de los
Sprints 1–2 (Node.js LTS + Express en ES Modules con `mysql2` y `zod`; Flutter 3.47 +
Material 3 con Provider; Jest + supertest contra `motorix_test` y `flutter test`),
sumando 4 migraciones nuevas (008–011), lógica de inventario transaccional en
`services/` y nuevas secciones en el rail (Historial, Mantenimientos, Inventario).
Sin dependencias nuevas.

## Technical Context

**Language/Version**: Dart/Flutter 3.47 (frontend); JavaScript con ES Modules en
Node.js LTS (backend)

**Primary Dependencies**: Express, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`
(backend); Material Design 3, Provider, `google_fonts`, `data_table_2` 2.6.0
(frontend; **sin dependencias nuevas** en este sprint: `ListView`/`ListTile` y
widgets nativos como `FilterChip`)

**Storage**: MySQL local (InnoDB, `utf8mb4`), esquema de los Sprints 1–2 +
migraciones nuevas `008`–`011` (`maintenance`, `parts`, `inventory_movements`,
`order_parts`) con registro en `schema_migrations`; base de pruebas `motorix_test`

**Testing**: Jest + supertest en backend (unit de estados de mantenimiento y
reglas de stock, integración y contrato contra `motorix_test`); `flutter test` en
frontend (providers, visibilidad por rol y filtros de alertas)

**Target Platform**: escritorio Windows (prioridad escritorio del MVP); backend local
en la misma máquina del equipo

**Project Type**: aplicación monorepo frontend + backend + base de datos local

**Performance Goals**: respuestas API percibidas como instantáneas en local (<200 ms
p95); historial, listados de stock y mantenimientos con índices (`vehicle_id`,
`status`, `stock_current`, `part_id`); animaciones de interfaz de 150–250 ms según
`docs/design-system.md`

**Constraints**: ESM obligatorio; permisos por rol validados en backend (RN-15);
RN-6 (refacción usada ligada a la orden), RN-7 (uso genera salida de inventario),
RN-8 (stock nunca negativo: toda salida sin existencias se rechaza), RN-10
(historial calculado, sin duplicación), RN-11/RN-12 (mantenimiento por fecha y/o
kilometraje con antelación configurable, sin intervalos universales); solo
mecánico agrega refacciones a sus órdenes no ENTREGADAS (Q5); IN/ADJUSTMENT solo
administrador (Q2); sin secretos; español en interfaz, docs y pruebas

**Scale/Scope**: 4 tablas nuevas, ~10 endpoints nuevos, ~13 pantallas totales
(5 nuevas: historial, mantenimientos lista/formulario, inventario lista/formulario,
más la sección de refacciones en el detalle de orden), decenas de refacciones y
decenas de mantenimientos por instalación

## Constitution Check

*GATE: Debe pasar antes de la investigación de la Fase 0. Se re-verifica después del
diseño de la Fase 1.*

| Puerta (principio de la constitución) | Estado | Evidencia en este plan |
|---------------------------------------|--------|------------------------|
| I. Alcance, MVP y fuente de verdad | PASS | Spec limitado al Sprint 3 en orden (1→4); sin pagos, Mercado Pago, tickets, dashboard ni notificaciones; decisiones nuevas con trazabilidad en Clarificaciones/`research.md` y `docs/project-context.md` |
| II. Arquitectura separada | PASS | Nuevos modelos, servicios, controladores, rutas y validadores dentro de `server/` (sin `src/`); el cálculo de estados de mantenimiento y las reglas transaccionales de stock viven en `services/`, nunca en controladores ni widgets |
| III. Stack y base de datos local | PASS | ES Modules + `"type": "module"` ya declarado; migraciones nuevas 008–011 numeradas e inmutables; MySQL local con usuario dedicado `motorix_app` (nunca `root`); InnoDB/`utf8mb4` con llaves foráneas; `.env.example` sin secretos; seeds idempotentes con datos de ejemplo |
| IV. Seguridad | PASS | Permisos por rol en backend (matriz R-07/CA-7 del sprint); validación `zod` en todos los endpoints nuevos; mensajes en español sin trazas; sin secretos en el repositorio |
| V. Integridad de reglas de negocio | PASS | RN-6 (`order_parts.order_id` FK), RN-7 (salida `OUT` automática en la misma transacción), RN-8 (validación + `CHECK stock_current >= 0` + bloqueo de fila), RN-10 (historial sin tabla derivada), RN-11/RN-12 (fecha y/o kilometraje con antelación por registro), RN-15 (autorización por endpoint) |
| VI. API consistente y errores | PASS | Contratos en `contracts/` con sobre JSON único, códigos HTTP apropiados, códigos de negocio nuevos documentados y manejo de errores centralizado existente |
| VII. Pruebas | PASS | Pruebas obligatorias de estados de mantenimiento, stock e inventario (CA-8), permisos y aislamiento contra `motorix_test` nunca la base principal; `flutter test` para providers y widgets; nombres en español |
| VIII. UX/UI profesional | PASS | Pantallas nuevas dentro de `screens/` con tokens de `docs/design-system.md`, estados vacío/cargando/error/éxito en español, confirmaciones obligatorias, estados de mantenimiento con ámbar (Próximo) y rojo (Vencido); **sin librerías nuevas** |

**Resultado**: 8/8 puertas en PASS. Sin violaciones que justificar.

*Re-verificación post Fase 1*: PASS — `data-model.md` usa InnoDB `utf8mb4` con FK
`RESTRICT` y `CHECK` de stock, los contratos exigen token y definen rol por endpoint
(incluida la matriz RN-15), las reglas de stock y de estados de mantenimiento
quedan como reglas de `services/` con pruebas previstas en CA-8, y el quickstart no
contiene secretos ni comandos contra la base principal.

## Project Structure

### Documentación (esta funcionalidad)

```text
specs/003-historial-mantenimiento-inventario/
├── plan.md                 # Este archivo
├── research.md             # Fase 0
├── data-model.md           # Fase 1
├── quickstart.md           # Fase 1
├── contracts/              # Fase 1
│   ├── README.md
│   ├── vehicle-history.md
│   ├── maintenances.md
│   ├── inventory.md
│   └── order-parts.md
└── tasks.md                # Fase 2 (/speckit.tasks, no lo crea /speckit.plan)
```

### Código fuente (raíz del repositorio)

```text
motorix/
├── client/
│   ├── lib/
│   │   ├── models/         # + maintenance.dart, part.dart, inventory_movement.dart,
│   │   │                   #   history_entry.dart
│   │   ├── screens/
│   │   │   ├── history/        # + vehicle_history_screen.dart (selector de vehículo + historial)
│   │   │   ├── maintenance/    # + maintenance_list_screen.dart, maintenance_form_screen.dart
│   │   │   ├── inventory/      # + parts_list_screen.dart (con filtro de alertas), part_form_screen.dart
│   │   │   └── orders/         # order_detail_screen.dart ampliado con «Refacciones»
│   │   ├── providers/      # + vehicle_history_provider.dart, maintenances_provider.dart,
│   │   │                   #   parts_provider.dart
│   │   ├── services/       # api_client.dart ampliado con historial, mantenimientos e inventario
│   │   ├── widgets/        # reutiliza states_view, confirm_dialog, app_shell (rail + Historial/
│   │   │                   #   Mantenimientos/Inventario según rol)
│   │   └── utils/          # app_route.dart (rutas nuevas), app_theme.dart (sin cambios de tokens)
│   └── pubspec.yaml        # SIN dependencias nuevas
│
├── server/
│   ├── models/             # + maintenance.model.js, part.model.js,
│   │                       #   inventory_movement.model.js, order_part.model.js
│   ├── services/           # + maintenances.service.js (estado calculado), inventory.service.js
│   │                       #   (transacción de stock con bloqueo de fila), history.service.js
│   ├── controllers/        # + maintenances.controller.js, parts.controller.js,
│   │                       #   history.controller.js
│   ├── routes/             # + maintenances.routes.js, parts.routes.js, history.routes.js (+ index.js)
│   ├── validators/         # + maintenances.js, parts.js (zod)
│   ├── middlewares/        # reutiliza authenticate, authorize, validate, errorHandler
│   ├── scripts/seed.js     # ampliado: refacciones, movimientos IN, mantenimientos y una orden
│   │                       #   terminada para el historial (idempotentes)
│   └── tests/
│       ├── unit/           # + maintenance-state.test.js, inventory-stock.test.js
│       ├── integration/    # + vehicle-history.test.js, maintenances.test.js,
│       │                   #   parts-inventory.test.js, order-parts.test.js
│       └── contract/       # + vehicle-history.contract.test.js, maintenances.contract.test.js,
│                           #   inventory.contract.test.js
│
├── database/
│   ├── migrations/         # + 008_create_maintenance.sql, 009_create_parts.sql,
│   │                       #   010_create_inventory_movements.sql, 011_create_order_parts.sql
│   └── README.md           # actualizar con las nuevas migraciones
│
├── docs/
│   ├── project-context.md  # actualizar trazabilidad de decisiones nuevas (Principio I)
│   ├── design-system.md    # referencia obligatoria de las pantallas nuevas
│   └── reglas.md
│
├── specs/003-historial-mantenimiento-inventario/
└── .env.example            # sin cambios
```

**Decisión de estructura**: se conserva el monorepo de tres carpetas de primer nivel
(`client/`, `server/`, `database/`) y las capas del backend directamente en `server/`
(sin `src/`), tal como quedó resuelto en el Sprint 1. Las pantallas nuevas siguen el
patrón `screens/<recurso>/`, con dos detalles que se agregan a pantallas existentes:
la sección «Refacciones» dentro del detalle de orden y las entradas nuevas del
`NavigationRail` filtradas por rol.

## Complexity Tracking

> **Rellenar SOLO si el Constitution Check tiene violaciones que deban justificarse**

| Violación | Por qué se necesita | Alternativa más simple rechazada porque |
|-----------|---------------------|-----------------------------------------|
| Sin violaciones | — | — |
