# Plan de Implementación: Precios de refacciones y cobro completo (Sprint 5)

**Rama**: `005-precios-refacciones-cobro` (se crea al iniciar la implementación) | **Fecha**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de la funcionalidad en `specs/005-precios-refacciones-cobro/spec.md`

## Resumen

Sprint posterior al MVP que cierra la deuda real detectada en la G-01: **guardar el precio de venta en cada línea de refacción** (instantánea), de modo que el total, el pago y el ticket dejen de depender del precio vigente del catálogo y el historial quede protegido. El catálogo ya tiene categoría, marca y precios desde el Sprint 3 y el total ya suma refacciones (H-02, H-03, H-06), así que el alcance concreto es: migración única `014_order_parts_price.sql` (columna `unit_price` + backfill con el precio vigente, D-01/D-03; límite máximo $99,999.99, D-08; columnas de corrección con motivo, D-05); cambio de fuente de precio en `order-total.service.js` y `tickets.service.js` (de `p.sale_price` a `op.unit_price`); guardado del precio al agregar la refacción (`inventory.service.js`); corrección administrativa de la línea con motivo obligatorio; cancelación automática del pago pendiente desfasado (D-04) al consultar total/pagos y dentro del alta de cobro; catálogo con tope validado en zod y en MySQL; proyección sin precios para el mecánico (D-10, FR-010) mediante el endpoint nuevo `GET /api/parts/lookup`, que además repara el selector vacío del diálogo «agregar refacción» del mecánico (hallazgo H-10); seeds ampliados con una orden cobrable con refacciones (FR-012) y la prueba de cobros simultáneos que hoy no existe (H-09, CA-8). Enfoque técnico: hereda el stack de los Sprints 1–4 (Node.js LTS + Express en ES Modules con `mysql2` y `zod`; Flutter 3.47 + Material 3 con Provider; Jest + supertest contra `motorix_test` y `flutter test`), **sin dependencias nuevas** y con una sola migración aditiva e inmutable.

## Contexto técnico

**Lenguaje/Versión**: Dart/Flutter 3.47 (frontend); JavaScript con ES Modules en Node.js LTS (backend)

**Dependencias principales**: Express, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod` (backend, **sin dependencias nuevas**); Material Design 3, Provider, `google_fonts`, `data_table_2` y las ya agregadas en el Sprint 4 (`pdf`, `printing`, `url_launcher`) (frontend, **sin dependencias nuevas**)

**Persistencia**: MySQL local (InnoDB, `utf8mb4`), esquema de los Sprints 1–4 + migración nueva `014_order_parts_price.sql` con registro en `schema_migrations`; el total de la orden y el contenido del ticket siguen **calculados** (RN-10, sin columna de total); la instantánea vive en `order_parts.unit_price`; base de pruebas `motorix_test`

**Pruebas**: Jest + supertest en backend (unit de reglas puras; integración y contrato contra `motorix_test`, con la primera prueba de cobros simultáneos del proyecto: `Promise.all` sobre `registrarPago`); `flutter test` en frontend (formulario de refacción, detalle de orden con precio y corrección, lookup del mecánico)

**Plataforma objetivo**: escritorio Windows (prioridad escritorio del MVP); backend local en la misma máquina del equipo

**Tipo de proyecto**: aplicación monorepo frontend + backend + base de datos local

**Metas de rendimiento**: respuestas API percibidas como instantáneas en local (<200 ms p95); el tope de precio se valida en memoria (zod) sin viajes extra a la base; animaciones de interfaz de 150–250 ms según `docs/design-system.md`

**Restricciones**: ESM obligatorio; migraciones numeradas aditivas e inmutables (la 014 es la siguiente a la 013); instantánea de precio inmutable en la práctica (sin DELETE, R-06; la única mutación permitida es la corrección de precio con motivo, autorizada por D-05); precios con tope de $99,999.99 y hasta 2 decimales (D-08, FR-002); importes calculados en centavos y presentados con 2 decimales (FR-004); permisos por rol validados en backend (RN-15); el mecánico no recibe ningún precio en sus consultas (D-10, FR-010); sin datos de tarjeta (RN-14); español en interfaz, documentos, mensajes y pruebas

**Alcance/Escala**: 1 migración nueva (014); 2 endpoints nuevos (`GET /api/parts/lookup`, `PATCH /api/service-orders/:id/parts/:partRowId/price`); 4 endpoints existentes con comportamiento nuevo (`POST .../:id/parts` guarda el precio, `GET .../:id/total` y `GET .../:id/payments` cancelan el pendiente desfasado, `POST .../:id/payments` cancela el desfasado antes de validar); ~5 pantallas/widgets del frontend tocados; ~12 archivos de prueba nuevos o ampliados; una decena de órdenes con refacciones por instalación

**Aclaraciones**: no queda ningún `NEEDS CLARIFICATION`: todos los valores anteriores se verificaron contra el repositorio el 2026-11-03 (migraciones 001–013, `order-total.service.js`, `payments.service.js`, `tickets.service.js`, `inventory.service.js`, rutas y pruebas existentes).

## Verificación de la constitución

*GATE: Debe pasar antes de la investigación de la Fase 0. Se re-verifica después del diseño de la Fase 1.*

| Puerta (principio de la constitución) | Estado | Evidencia en este plan |
|---------------------------------------|--------|------------------------|
| I. Alcance, MVP y fuente de verdad | **ENMIENDA PENDIENTE (H-01)** | La constitución limita el proyecto a **cuatro sprints** (`.specify/memory/constitution.md`, líneas 36, 48 y 84) y este Sprint 5 es posterior al MVP; el alcance se mantiene acotado a la deuda verificada en la G-01 y el spec tiene trazabilidad FR/US/CA completa. La enmienda aprobada es **criterio de entrada** a la implementación (sección 2 de `docs/aseguramiento-calidad-sprint-5.md`); hasta entonces no se inicia |
| II. Arquitectura separada | PASS | Cambios dentro de `server/{models,services,controllers,routes,validators}` y `client/lib`; toda regla de negocio nueva (instantánea, corrección, cancelación por desfase, proyección por rol) vive en `services/`, nunca en controladores ni widgets; la integración de Mercado Pago no se toca (la cancelación del desfase es local, sin llamadas al proveedor) |
| III. Stack y base de datos local | PASS | ES Modules intacto; **una** migración nueva `014_order_parts_price.sql`, aditiva e inmutables las anteriores; MySQL local InnoDB/`utf8mb4` con FKs y CHECK; sin dependencias nuevas en ninguna capa; seeds idempotentes en `server/scripts/seed.js` ampliados, no reescritos |
| IV. Seguridad | PASS | `GET /api/parts` sigue solo ADMIN (SC-008 intacto); el lookup del mecánico no expone ningún campo de precio; la corrección de línea exige `authorize("ADMIN")`; validación zod en todos los payloads con mensajes en español; sin datos de tarjeta; sin secretos ni trazas |
| V. Integridad de reglas de negocio | PASS | La instantánea congelada evita reescribir importes históricos (SC-001, SC-002); sin DELETE en `order_parts` (R-06): la corrección actualiza precio con motivo y guardas (no entregada, no pagada); todo pago sigue ligado a su orden (RN-13) y el stock no se toca; el total sigue calculado, nunca almacenado (RN-10) |
| VI. API consistente y errores | PASS | Contratos en `contracts/` con sobre `{ok, data}`, códigos HTTP apropiados y **códigos existentes reutilizados** (`VALIDATION_ERROR`, `FORBIDDEN`, `ORDER_ITEM_NOT_FOUND`, `ORDER_DELIVERED`, `ORDER_ALREADY_PAID`, `PART_NOT_FOUND`): sin catálogo de errores nuevo salvo los que ya existían; efecto secundario del GET documentado en el contrato |
| VII. Pruebas | PASS | Pruebas para total con instantánea, guardado de precio, tope, proyección por rol, corrección con motivo, cobros simultáneos (H-09, primera prueba de concurrencia del proyecto) y compatibilidad de pagos/tickets anteriores (FR-013); integración y contrato contra `motorix_test`, nunca la base principal; `flutter test` para las superficies tocadas; nombres y mensajes en español |
| VIII. UX/UI profesional | PASS | El precio se muestra solo donde el rol lo recibe; la corrección pide confirmación con motivo obligatorio; la advertencia de venta menor a compra usa el color ámbar de `docs/design-system.md`; confirmaciones y mensajes de éxito/error en español; sin dependencias nuevas |

**Resultado**: 7/8 puertas en PASS y **1 pendiente de enmienda** (puerta I, hallazgo H-01). La implementación no comienza hasta que la enmienda de la constitución esté aprobada y registrada; no se justifica avanzar sin ella.

*Re-verificación post Fase 1*: PASS en las puertas II a VIII — `data-model.md` conserva InnoDB `utf8mb4` con FK `RESTRICT` y CHECK de límites; los contratos exigen token y matriz de rol completa, y documentan el efecto del GET y cada código reutilizado; la cancelación del pago desfasado es una actualización atómica idempotente dentro de las reglas existentes (la máquina R-04 ya permite `PENDING → CANCELLED`); el total y el ticket se calculan desde la misma fuente (la línea), sin duplicar información; el quickstart no usa la base principal ni contiene secretos. La puerta I sigue pendiente de la enmienda (H-01).

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/005-precios-refacciones-cobro/
├── plan.md                 # Este archivo
├── research.md             # Fase 0
├── data-model.md           # Fase 1
├── quickstart.md           # Fase 1
├── contracts/              # Fase 1
│   ├── README.md
│   ├── order-parts.md      # instantánea en la línea + corrección de precio
│   ├── parts-catalog.md    # tope de precio + lookup del mecánico
│   └── payments.md         # pago pendiente desfasado (D-04)
└── tasks.md                # Fase 2 (/speckit.tasks, no lo crea /speckit.plan)
```

### Código fuente (raíz del repositorio)

```text
motorix/
├── client/
│   ├── lib/
│   │   ├── models/            # order_part.dart + unitPrice (nullable) y corrección
│   │   ├── providers/         # parts_provider.dart + cargarLookup() para el selector
│   │   ├── screens/
│   │   │   ├── inventory/     # part_form_screen.dart: tope $99,999.99 y advertencia ámbar
│   │   │   └── orders/        # order_detail_screen.dart: precio por línea (roles que lo
│   │   │                      #   reciben) + acción «Corregir precio» (solo ADMIN, con motivo)
│   │   ├── services/          # api_client.dart + rutas del lookup y de la corrección
│   │   └── utils/             # app_theme.dart y app_route.dart sin cambios
│   └── test/                  # parts_form_test, order_detail_test, order_parts_test ampliados
│
├── server/
│   ├── models/
│   │   ├── order_part.model.js   # CAMPOS + unitPrice; crear() guarda el precio vigente;
│   │   │                         #   corregirPrecio() con motivo/autor/fecha
│   │   └── part.model.js         # proyección del lookup (sin campos de precio)
│   ├── services/
│   │   ├── inventory.service.js  # agregarRefaccionOrden guarda el precio; lookup();
│   │   │                         #   corregirPrecioRefaccionOrden() con guardas
│   │   ├── order-total.service.js # refacciones leen op.unit_price (alias salePrice)
│   │   ├── tickets.service.js    # ídem en seccionesDeTrabajo()
│   │   └── payments.service.js   # cancelarPendienteDesfasado() en total, listado y alta
│   ├── controllers/              # parts.controller (lookup), service_orders.controller
│   │                             #   (corregirPrecio), payments.controller (sin cambios de forma)
│   ├── routes/                   # parts.routes (+GET /lookup), service_orders.routes
│   │                             #   (+PATCH /:id/parts/:partRowId/price)
│   ├── validators/
│   │   ├── parts.js              # tope $99,999.99 en purchasePrice/salePrice (zod refine)
│   │   └── service_orders.js     # orderPartPricePatchSchema (unitPrice + reason ≥ 10)
│   ├── scripts/seed.js           # ampliado: orden abierta con refacción y pago pendiente
│   │                             #   desfasado de demostración (idempotente)
│   └── tests/
│       ├── integration/          # + payment-concurrency.test.js (H-09); ampliados
│       │                         #   order-parts, parts-catalog, payments, tickets
│       ├── contract/             # ampliados order-parts, inventory, payments, tickets
│       └── unit/                 # order-total.test.js sin cambios de interfaz
│
├── database/
│   ├── migrations/               # + 014_order_parts_price.sql (aditiva)
│   └── README.md                 # actualizar con la 014
│
├── docs/
│   ├── project-context.md        # H-08 (campo `active` inexistente) + reglas del sprint
│   ├── design-system.md          # solo si cambia un token (no se espera)
│   └── aseguramiento-calidad-sprint-5.md  # registro del proceso (G-05, H-10)
│
├── specs/005-precios-refacciones-cobro/
└── (sin cambios en .env ni dependencias)
```

**Decisión de estructura**: se conserva el monorepo de tres carpetas de primer nivel (`client/`, `server/`, `database/`) y las capas del backend directamente en `server/` (sin `src/`), como quedó resuelto en el Sprint 1. La corrección de precio se monta como subrecurso de la línea de la orden (`/api/service-orders/:id/parts/:partRowId/price`) siguiendo el patrón existente de `/:id/services/:serviceId` y `/:id/labor/:laborId`; el lookup del mecánico vive en `/api/parts/lookup`, junto al catálogo que sigue siendo solo de administrador.

## Seguimiento de complejidad

> **Rellenar SOLO si la Verificación de la constitución tiene violaciones que deban justificarse**

| Violación | Por qué se necesita | Alternativa más simple rechazada porque |
|-----------|---------------------|-----------------------------------------|
| Principio I: el proyecto está definido para cuatro sprints y este es el quinto (post-MVP) | El programa del curso exige este sprint de precios y cobro completo; la G-01 acotó la deuda real a lo verificable en el código (instantánea e integridad), sin ampliar alcance | Cancelar el sprint descarta el entregable; absorberlo en los sprints 1–4 obligaría a reabrir sprints ya cerrados y a mezclar alcances entregados |
| (enmienda) | Se registra como enmienda **MINOR** (nueva sección/alcance de sprint) con reporte de impacto en el encabezado de la constitución, según la gobernanza: aprobación del equipo coordinada por el director del proyecto | No aplica: la constitución obliga a aprobarla antes de implementar (H-01, criterio de entrada) |
