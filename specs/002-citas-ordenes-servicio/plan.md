# Plan de Implementación: Citas y órdenes de servicio (Sprint 2)

**Rama**: `002-citas-ordenes-servicio` | **Fecha**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de la funcionalidad en `specs/002-citas-ordenes-servicio/spec.md`

## Summary

Segundo sprint de Motorix: se agregan las **citas** (registrar, consultar, editar y
cancelar con confirmación) y las **órdenes de servicio** (crear con cliente, vehículo,
kilometraje de entrada y mecánico asignado; el mecánico consulta solo las suyas,
registra diagnóstico, servicios, mano de obra y recomendaciones, y avanza la orden
por la secuencia RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO con
ESPERANDO_REFACCION reversible). Enfoque técnico: hereda el stack completo del
Sprint 1 (Node.js LTS + Express en ES Modules con `mysql2` y `zod`; Flutter 3.47 +
Material 3 con Provider; Jest + supertest contra `motorix_test` y `flutter test`),
sumando 4 migraciones nuevas (004–007), una máquina de estados en `services/` y
nuevas secciones en el rail (Citas, Órdenes). Sin dependencias nuevas.

## Technical Context

**Language/Version**: Dart/Flutter 3.47 (frontend); JavaScript con ES Modules en
Node.js LTS (backend)

**Primary Dependencies**: Express, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`
(backend); Material Design 3, Provider, `google_fonts`, `data_table_2` 2.6.0
(frontend; **sin dependencias nuevas** en este sprint: date/time pickers nativos)

**Storage**: MySQL local (InnoDB, `utf8mb4`), esquema del Sprint 1 + migraciones
nuevas `004`–`007` (`appointments`, `service_orders`, `order_services`,
`order_labor`) con registro en `schema_migrations`; base de pruebas `motorix_test`

**Testing**: Jest + supertest en backend (unit de transiciones/kilometraje,
integración y contrato contra `motorix_test`); `flutter test` en frontend (providers,
visibilidad por rol y formularios)

**Target Platform**: escritorio Windows (prioridad escritorio del MVP); backend local
en la misma máquina del equipo

**Project Type**: aplicación monorepo frontend + backend + base de datos local

**Performance Goals**: respuestas API percibidas como instantáneas en local (<200 ms
p95); la agenda y los listados usan índices (`appointment_date`, `status`,
`mechanic_id`); animaciones de interfaz de 150–250 ms según `docs/design-system.md`

**Constraints**: ESM obligatorio; permisos por rol validados en backend (CA-7/RN-15);
RN-2 (sin orden para vehículo inexistente), RN-3/RN-4 (kilometraje de entrada y
corrección solo ADMIN), RN-9 (sin borrado de órdenes); sin vínculo cita↔orden (Q3);
asignación manual de mecánico (Q2); avance lineal de estados (Q1); sin secretos;
español en interfaz, docs y pruebas

**Scale/Scope**: 5 tablas nuevas/modificadas, ~10 endpoints nuevos, ~11 pantallas
totales (5 nuevas: citas lista/formulario, órdenes lista/formulario/detalle),
cientos de órdenes y decenas de citas por instalación

## Constitution Check

*GATE: Debe pasar antes de la investigación de la Fase 0. Se re-verifica después del
diseño de la Fase 1.*

| Puerta (principio de la constitución) | Estado | Evidencia en este plan |
|---------------------------------------|--------|------------------------|
| I. Alcance, MVP y fuente de verdad | PASS | Spec limitado al Sprint 2 en orden (1→4); sin inventario, pagos, Mercado Pago, tickets ni dashboard; decisiones nuevas con trazabilidad en Clarificaciones/`research.md` |
| II. Arquitectura separada | PASS | Nuevos modelos, servicios, controladores, rutas y validadores dentro de `server/` (sin `src/`); la máquina de estados y la validación de kilometraje viven en `services/`, nunca en controladores ni widgets |
| III. Stack y base de datos local | PASS | ES Modules + `"type": "module"` ya declarado; migraciones nuevas 004–007 numeradas e inmutables; MySQL local con usuario dedicado `motorix_app` (nunca `root`); InnoDB/`utf8mb4` con llaves foráneas; `.env.example` sin secretos; seeds idempotentes con datos de ejemplo |
| IV. Seguridad | PASS | Permisos por rol en backend (matriz R-06/CA-7); validación `zod` en todos los endpoints nuevos; mensajes en español sin trazas; sin secretos en el repositorio |
| V. Integridad de reglas de negocio | PASS | RN-2 (FK + validación `VEHICLE_NOT_FOUND`), RN-3/RN-4 (`entry_mileage` + `MILEAGE_LOWER_THAN_PREVIOUS` con corrección solo ADMIN), RN-5/RN-15 (autorización por endpoint), RN-9 (sin `DELETE` de órdenes, `DELIVERED` sin salidas) |
| VI. API consistente y errores | PASS | Contratos en `contracts/` con sobre JSON único, códigos HTTP apropiados, códigos de negocio nuevos documentados y manejo de errores centralizado existente |
| VII. Pruebas | PASS | Pruebas obligatorias de transiciones (CA-8), kilometraje, permisos y aislamiento CA-3, contra `motorix_test` nunca la base principal; `flutter test` para providers y widgets; nombres en español |
| VIII. UX/UI profesional | PASS | Pantallas nuevas dentro de `screens/` con tokens de `docs/design-system.md`, estados vacío/cargando/error/éxito en español, confirmaciones obligatorias (cancelar, borrar fila), transiciones existentes; **sin librerías nuevas** |

**Resultado**: 8/8 puertas en PASS. Sin violaciones que justificar.

*Re-verificación post Fase 1*: PASS — `data-model.md` usa InnoDB `utf8mb4` con FK
`RESTRICT`, los contratos exigen token y definen rol por endpoint (incluida la matriz
CA-7), la máquina de estados y el kilometraje quedan como reglas de `services/` con
pruebas previstas en CA-8, y el quickstart no contiene secretos ni comandos contra la
base principal.

## Project Structure

### Documentación (esta funcionalidad)

```text
specs/002-citas-ordenes-servicio/
├── plan.md                 # Este archivo
├── research.md             # Fase 0
├── data-model.md           # Fase 1
├── quickstart.md           # Fase 1
├── contracts/              # Fase 1
│   ├── README.md
│   ├── appointments.md
│   └── service-orders.md
├── checklists/
│   └── requirements.md     # Validado 16/16
└── tasks.md                # Fase 2 (/speckit.tasks, no lo crea /speckit.plan)
```

### Código fuente (raíz del repositorio)

```text
motorix/
├── client/
│   ├── lib/
│   │   ├── models/         # + appointment.dart, service_order.dart, order_item.dart
│   │   ├── screens/
│   │   │   ├── appointments/   # + appointment_list_screen.dart, appointment_form_screen.dart
│   │   │   └── orders/         # + order_list_screen.dart, order_form_screen.dart, order_detail_screen.dart
│   │   ├── providers/      # + appointments_provider.dart, service_orders_provider.dart
│   │   ├── services/       # api_client.dart ampliado con citas y órdenes
│   │   ├── widgets/        # reutiliza states_view, confirm_dialog, app_shell (rail + Citas/Órdenes)
│   │   └── utils/          # app_route.dart (rutas nuevas), app_theme.dart (sin cambios de tokens)
│   └── pubspec.yaml        # SIN dependencias nuevas
│
├── server/
│   ├── models/             # + appointment.model.js, service_order.model.js,
│   │                       #   order_service.model.js, order_labor.model.js
│   ├── services/           # + appointments.service.js, service_orders.service.js
│   │                       #   (máquina de estados, kilometraje, permisos de negocio)
│   ├── controllers/        # + appointments.controller.js, service_orders.controller.js
│   ├── routes/             # + appointments.routes.js, service_orders.routes.js (+ index.js)
│   ├── validators/         # + appointments.js, service_orders.js (zod)
│   ├── middlewares/        # reutiliza authenticate, authorize, validate, errorHandler
│   ├── scripts/seed.js     # ampliado: citas y órdenes idempotentes
│   └── tests/
│       ├── unit/           # + order-transitions, appointment-transitions, mileage-validation
│       ├── integration/    # + appointments.test.js, service-orders.test.js
│       └── contract/       # + appointments.contract.test.js, service-orders.contract.test.js
│
├── database/
│   ├── migrations/         # + 004_create_appointments.sql, 005_create_service_orders.sql,
│   │                       #   006_create_order_services.sql, 007_create_order_labor.sql
│   └── README.md           # actualizar con las nuevas migraciones
│
├── docs/
│   ├── project-context.md  # actualizar trazabilidad de decisiones nuevas (Principio I)
│   ├── design-system.md    # referencia obligatoria de las pantallas nuevas
│   └── reglas.md
│
├── specs/002-citas-ordenes-servicio/
└── .env.example            # sin cambios
```

**Decisión de estructura**: se conserva el monorepo de tres carpetas de primer nivel
(`client/`, `server/`, `database/`) y las capas del backend directamente en `server/`
(sin `src/`), tal como quedó resuelto en el Sprint 1. Las pantallas nuevas siguen el
patrón `screens/<recurso>/` con lista + formulario, más un detalle para las órdenes
(donde ocurre todo el trabajo del mecánico).

## Complexity Tracking

> **Rellenar SOLO si el Constitution Check tiene violaciones que deban justificarse**

| Violación | Por qué se necesita | Alternativa más simple rechazada porque |
|-----------|---------------------|-----------------------------------------|
| Sin violaciones | — | — |
