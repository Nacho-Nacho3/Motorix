# Plan de Implementación: Pagos, tickets y dashboard (Sprint 4)

**Rama**: `004-pagos-tickets-dashboard` | **Fecha**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de la funcionalidad en `specs/004-pagos-tickets-dashboard/spec.md`

## Summary

Cuarto y último sprint del MVP de Motorix: se cierra el ciclo de atención con el
**cobro de órdenes** (registrar un único pago por el total de una orden terminada,
con efectivo, tarjeta, transferencia o Mercado Pago en sandbox), el **ticket de
servicio** (comprobante con folio único e imprimible) y el **panel de control**
(indicadores y detalle calculados sobre los módulos existentes, solo
administrador). Enfoque técnico: hereda el stack de los Sprints 1–3 (Node.js LTS +
Express en ES Modules con `mysql2` y `zod`; Flutter 3.47 + Material 3 con Provider;
Jest + supertest contra `motorix_test` y `flutter test`), con 2 migraciones
nuevas (012–013), el total de la orden **calculado** (servicios + mano de obra +
refacciones, sin tabla derivada), la integración de Mercado Pago aislada en su
propio servicio (preferencia sandbox + sincronización por consulta, sin webhook en
el MVP local) y 3 dependencias frontend nuevas justificadas (`pdf`, `printing`,
`url_launcher`) para imprimir el ticket y abrir el checkout del proveedor. El
backend no suma dependencias (usa el `fetch` global de Node).

## Technical Context

**Language/Version**: Dart/Flutter 3.47 (frontend); JavaScript con ES Modules en
Node.js LTS (backend)

**Primary Dependencies**: Express, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`
(backend, **sin dependencias nuevas**: `fetch` global de Node para la API de
Mercado Pago); Material Design 3, Provider, `google_fonts`, `data_table_2` y las
nuevas `pdf`, `printing`, `url_launcher` (frontend; justificadas en `research.md`
D-6/D-9: imprimir el ticket y abrir el link de pago no se resuelven con <50 líneas
ni con el SDK de Flutter)

**Storage**: MySQL local (InnoDB, `utf8mb4`), esquema de los Sprints 1–3 +
migraciones nuevas `012_create_payments.sql` y `013_create_tickets.sql` con
registro en `schema_migrations`; el total de la orden y el contenido del ticket
NO se almacenan (se calculan, RN-10); base de pruebas `motorix_test`

**Testing**: Jest + supertest en backend (unit de máquina de estados de pago y
reglas del total; integración y contrato contra `motorix_test` con el cliente de
Mercado Pago **simulado**, sin red); `flutter test` en frontend (formulario de
pago, ticket, visibilidad del panel por rol)

**Target Platform**: escritorio Windows (prioridad escritorio del MVP); backend
local en la misma máquina del equipo

**Project Type**: aplicación monorepo frontend + backend + base de datos local

**Performance Goals**: respuestas API percibidas como instantáneas en local
(<200 ms p95); el panel con conteos e índices (`payments.order_id`,
`payments.status`, `tickets.order_id` único, índices existentes de órdenes,
citas, mantenimientos y stock) < 3 s con datos de demostración (SC-003);
animaciones de interfaz de 150–250 ms según `docs/design-system.md`

**Constraints**: ESM obligatorio; permisos por rol validados en backend (RN-15,
matriz R-08); RN-13 (todo pago ligado a una orden), RN-14 (cero datos de
tarjeta: la captura vive en Mercado Pago), RN-9 (el pago/ticket no modifican la
orden entregada); importe = total de la orden, sin pagos parciales (Q1);
un solo pago «pagado» por orden y un solo pago «pendiente» activo; sin secretos
(repositorio sin credenciales de MP); español en interfaz, docs y pruebas

**Scale/Scope**: 2 tablas nuevas, 8 endpoints nuevos
(`GET /api/service-orders/:id/total`, `GET/POST .../:id/payments`,
`POST .../:id/payments/:paymentId/sync`, `.../cancel`, `POST/GET .../:id/ticket`,
`GET /api/dashboard`), ~4 superficies de interfaz nuevas (formulario de pago,
pantalla de ticket, panel de control y sección «Pago» en el detalle de orden),
decenas de pagos y decenas de tickets por instalación

## Constitution Check

*GATE: Debe pasar antes de la investigación de la Fase 0. Se re-verifica después del
diseño de la Fase 1.*

| Puerta (principio de la constitución) | Estado | Evidencia en este plan |
|---------------------------------------|--------|------------------------|
| I. Alcance, MVP y fuente de verdad | PASS | Sprint 4 es el sprint final del orden 1→4 (no se adelantan futuros); alcance limitado a pagos/tickets/dashboard con trazabilidad FR/US/CA del spec; `docs/project-context.md` se actualizará al implementar |
| II. Arquitectura separada | PASS | Nuevos modelos, servicios, controladores, rutas y validadores dentro de `server/`; la lógica de Mercado Pago vive **aislada** en `services/mercadopago.service.js` + `config/mercadopago.js` (requisito explícito de la constitución); toda regla de negocio en `services/`, nunca en controladores ni widgets |
| III. Stack y base de datos local | PASS | ES Modules intacto; 2 migraciones nuevas numeradas 012–013 e inmutables; MySQL local InnoDB/`utf8mb4` con FKs; usuario dedicado `motorix_app`; `.env.example` con placeholders de MP sin secretos; backend sin dependencias nuevas; las 3 dependencias frontend son pequeñas y justificadas (Principio III «sin dependencias grandes sin justificar») |
| IV. Seguridad | PASS | RN-14: la aplicación nunca ve ni almacena datos de tarjeta (captura en el proveedor); `MP_ACCESS_TOKEN` solo en `.env` (CA-7); permisos por rol en backend (matriz R-08); validación `zod` en todos los endpoints nuevos; mensajes en español sin trazas |
| V. Integridad de reglas de negocio | PASS | RN-13 (FK `order_id NOT NULL` + validación); importe = total exacto sin parciales (Q1); máquina de estados de pago con transiciones válidas y un solo «pagado» por orden; RN-9 (pago y ticket no alteran la orden); ticket idempotente sin folios duplicados; dashboard sin tablas derivadas (RN-10) |
| VI. API consistente y errores | PASS | Contratos en `contracts/` con sobre JSON `{ok, data}`, códigos HTTP apropiados, códigos de negocio nuevos documentados (`ORDER_NOT_PAYABLE`, `PAYMENT_AMOUNT_MISMATCH`, `ORDER_ALREADY_PAID`, `PENDING_PAYMENT_EXISTS`, `PAYMENT_NOT_FOUND`, `INVALID_PAYMENT_TRANSITION`, `MERCADO_PAGO_NOT_CONFIGURED`, `MERCADO_PAGO_ERROR`, `ORDER_NOT_FINISHED`) y manejo de errores centralizado existente |
| VII. Pruebas | PASS | Pruebas obligatorias (CA-8) de máquina de estados de pagos, cálculo del total, generación/idempotencia de tickets y permisos del dashboard; integración contra `motorix_test` nunca la base principal; cliente MP simulado (sin red en CI); `flutter test` para formulario, ticket y panel; nombres en español |
| VIII. UX/UI profesional | PASS | Pantallas nuevas dentro de `screens/` con tokens de `docs/design-system.md`, estados vacío/cargando/error/éxito en español, confirmación antes de cancelar un pago, estados de pago con colores consistentes (pendiente ámbar, pagado verde, rechazado rojo, cancelado gris) y ticket de ancho fijo tipo comprobante; dependencias nuevas mínimas |

**Resultado**: 8/8 puertas en PASS. Sin violaciones que justificar.

*Re-verificación post Fase 1*: PASS — `data-model.md` usa InnoDB `utf8mb4` con FK
`RESTRICT` y `CHECK (amount > 0)`; los contratos exigen token, definen la matriz
RN-15 completa (R-08) y documentan cada código de error nuevo; la lógica de MP
queda aislada tras una interfaz simulable en pruebas; el total y el ticket se
calculan sin duplicar información; el quickstart no contiene secretos ni comandos
contra la base principal.

## Project Structure

### Documentación (esta funcionalidad)

```text
specs/004-pagos-tickets-dashboard/
├── plan.md                 # Este archivo
├── research.md             # Fase 0
├── data-model.md           # Fase 1
├── quickstart.md           # Fase 1
├── contracts/              # Fase 1
│   ├── README.md
│   ├── payments.md         # pagos + total de la orden
│   ├── tickets.md
│   └── dashboard.md
└── tasks.md                # Fase 2 (/speckit.tasks, no lo crea /speckit.plan)
```

### Código fuente (raíz del repositorio)

```text
motorix/
├── client/
│   ├── lib/
│   │   ├── models/         # + payment.dart, ticket.dart, dashboard_data.dart
│   │   ├── screens/
│   │   │   ├── payments/       # + payment_form_screen.dart (importe, método, cobro MP)
│   │   │   ├── tickets/        # + ticket_screen.dart (comprobante imprimible)
│   │   │   ├── dashboard/      # + dashboard_screen.dart (indicadores + detalle)
│   │   │   └── orders/         # order_detail_screen.dart ampliado con sección «Pago»
│   │   ├── providers/      # + payments_provider.dart, dashboard_provider.dart
│   │   ├── services/       # api_client.dart ampliado con total, pagos, ticket y dashboard
│   │   ├── widgets/        # reutiliza states_view, confirm_dialog, app_shell
│   │   │                   #   (rail + entrada «Dashboard» solo ADMIN)
│   │   └── utils/          # app_route.dart (rutas nuevas), app_theme.dart (sin cambios)
│   └── pubspec.yaml        # + pdf, printing, url_launcher (justificadas en research.md)
│
├── server/
│   ├── config/             # + mercadopago.js (lee env, sin secretos)
│   ├── models/             # + payment.model.js, ticket.model.js
│   ├── services/           # + payments.service.js (reglas y máquina de estados),
│   │                       #   tickets.service.js, dashboard.service.js (conteos),
│   │                       #   mercadopago.service.js (integración aislada, fetch global)
│   ├── controllers/        # + payments.controller.js, tickets.controller.js,
│   │                       #   dashboard.controller.js
│   ├── routes/             # + payments.routes.js, tickets.routes.js, dashboard.routes.js
│   │                       #   (registrados en index.js)
│   ├── validators/         # + payments.js (zod)
│   ├── middlewares/        # reutiliza authenticate, authorize, validate, errorHandler
│   ├── scripts/seed.js     # ampliado: pago efectivo + ticket sobre la orden terminada
│   │                       #   del seed (idempotente por orden)
│   └── tests/
│       ├── unit/           # + payment-rules.test.js, order-total.test.js
│       ├── integration/    # + payments.test.js, tickets.test.js, dashboard.test.js
│       └── contract/       # + payments.contract.test.js, tickets.contract.test.js,
│                           #   dashboard.contract.test.js
│
├── database/
│   ├── migrations/         # + 012_create_payments.sql, 013_create_tickets.sql
│   └── README.md           # actualizar con las nuevas migraciones
│
├── docs/
│   ├── project-context.md  # actualizar trazabilidad de decisiones nuevas (Principio I)
│   ├── design-system.md    # referencia obligatoria de las pantallas nuevas
│   └── reglas.md
│
├── specs/004-pagos-tickets-dashboard/
└── .env.example            # + placeholders MP_ACCESS_TOKEN, MP_PUBLIC_KEY (sin secretos)
```

**Decisión de estructura**: se conserva el monorepo de tres carpetas de primer
nivel (`client/`, `server/`, `database/`) y las capas del backend directamente en
`server/` (sin `src/`), tal como quedó resuelto en el Sprint 1. Los pagos y el
ticket se montan como subrecursos de la orden
(`/api/service-orders/:id/payments`, `/api/service-orders/:id/ticket`) siguiendo
el patrón existente de `/api/vehicles/:id/history`; el panel es el primer
endpoint de nivel superior nuevo (`/api/dashboard`).

## Complexity Tracking

> **Rellenar SOLO si el Constitution Check tiene violaciones que deban justificarse**

| Violación | Por qué se necesita | Alternativa más simple rechazada porque |
|-----------|---------------------|-----------------------------------------|
| Sin violaciones | — | — |
