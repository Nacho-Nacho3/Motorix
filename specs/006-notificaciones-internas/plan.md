# Plan de Implementación: Notificaciones internas (Sprint 6)

**Rama**: `006-notificaciones-internas` | **Fecha**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de la funcionalidad en `specs/006-notificaciones-internas/spec.md`

## Resumen

Sprint posterior al MVP que reúne en un solo lugar los avisos hoy dispersos (insignia de stock en Inventario, alertas de la pantalla de inicio y contadores del panel, todos solo para ADMIN) y agrega el criterio que falta: **órdenes detenidas**. El alcance concreto es: migración única `015_notifications.sql` con las dos tablas nuevas (`notification_reads`: lectura por usuario con la clave resuelta en D-04; `client_notices`: aviso a cliente con quién, cuándo y nota opcional, D-07); servicio nuevo `notifications.service.js` que **calcula los avisos en cada consulta reutilizando los módulos existentes** (`listarMantenimientos()` con su estado UPCOMING/OVERDUE, `part.listar({low:true})`, citas por fecha y órdenes detenidas con el criterio D-01 sobre `service_orders.updated_at`, ya que la tabla `order_status_history` que supone el insumo **no existe**) — sin tablas derivadas de avisos (RN-10, CA-2, CA-5); matriz de rol aplicada en el backend (CA-4: ADMIN todo; recepción sin stock; mecánico solo órdenes asignadas, D-08); endpoints nuevos `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/client-notices` y `POST /api/client-notices`; campana con contador en el encabezado (`app_shell.dart`), panel agrupado con estados de carga/vacío/error (`states_view.dart`, CA-9) y pantalla «Clientes por avisar» (CA-10/CA-11) solo para ADMIN y recepción; actualización del contador sin polling (D-03: login, apertura del panel y navegación); seeds ampliados con un caso por tipo de aviso (CA-12) e idempotentes. Enfoque técnico: hereda el stack de los Sprints 1–5 (Node.js LTS + Express en ES Modules con `mysql2` y `zod`; Flutter 3.47 + Material 3 con Provider; Jest + supertest contra `motorix_test` y `flutter test`), **sin dependencias nuevas** y con una sola migración aditiva e inmutable.

## Contexto técnico

**Lenguaje/Versión**: Dart/Flutter 3.47 (frontend); JavaScript con ES Modules en Node.js LTS (backend)

**Dependencias principales**: Express, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod` (backend, **sin dependencias nuevas**); Material Design 3, Provider, `google_fonts`, `data_table_2` y las del Sprint 4 (`pdf`, `printing`, `url_launcher`) (frontend, **sin dependencias nuevas**)

**Persistencia**: MySQL local (InnoDB, `utf8mb4`), esquema de los Sprints 1–5 + migración nueva `015_notifications.sql` con registro en `schema_migrations`; los avisos **no se almacenan**: se calculan en cada consulta desde `maintenance`, `appointments`, `parts`, `service_orders` y `clients` (RN-10); solo se persisten la lectura por usuario (`notification_reads`) y el aviso a cliente (`client_notices`); base de pruebas `motorix_test`

**Pruebas**: Jest + supertest en backend (unit de la clave de aviso y del criterio de orden detenida; integración de cálculo por tipo, matriz de rol, lectura por usuario, idempotencia de seeds y rendimiento de la consulta; contrato de los 4 endpoints); `flutter test` en frontend (campana, panel y lista de clientes por avisar)

**Plataforma objetivo**: escritorio Windows (prioridad escritorio del MVP); backend local en la misma máquina del equipo

**Tipo de proyecto**: aplicación monorepo frontend + backend + base de datos local

**Metas de rendimiento**: respuestas API percibidas como instantáneas en local (<200 ms p95); el centro muestra sus avisos en menos de 2 segundos con los datos de ejemplo (SC-006); sin consulta automática en segundo plano (D-03); animaciones de interfaz de 150–250 ms según `docs/design-system.md`

**Restricciones**: ESM obligatorio; migraciones numeradas aditivas e inmutables (la 015 es la siguiente a la 014; el `006_...sql` del insumo es un número obsoleto); avisos derivados, nunca copiados (RN-10); permisos por rol validados en backend (RN-15, CA-4); stock negativo intacto (RN-8, la alerta reutiliza el filtro existente); teléfono del cliente solo para ADMIN y recepción, roles que ya lo consultan; español en interfaz, mensajes y pruebas

**Alcance/Escala**: 1 migración nueva (015, con 2 tablas); 4 endpoints nuevos (`GET /api/notifications`, `POST /api/notifications/read`, `GET /api/client-notices`, `POST /api/client-notices`); ~6 archivos backend nuevos (modelo, servicio, controlador, rutas, validador) + `index.js` y `seed.js` tocados; ~5 archivos del frontend (2 modelos, 2 proveedores, 2 pantallas, campana en `app_shell.dart`, `api_client.dart`, `app_route.dart`); ~7 archivos de prueba nuevos; una decena de registros de ejemplo por instalación

**Aclaraciones**: no queda ningún `NEEDS CLARIFICATION`: todos los valores anteriores se verificaron contra el repositorio el 2026-11-05 (migraciones 001–014, `dashboard.service.js`, `maintenances.service.js`, `part.model.js` (`listar({low:true})`), `service_orders` con `updated_at`, ausencia de `order_status_history` y de tablas de notificaciones, rutas y `authorize(...)`, `app_shell.dart` y `states_view.dart`). Las 6 decisiones de clarify resueltas (D-01…D-05, D-08) y las 2 diferidas con default (D-06, D-07) están en el spec.

## Verificación de la constitución

*GATE: Debe pasar antes de la investigación de la Fase 0. Se re-verifica después del diseño de la Fase 1.*

| Puerta (principio de la constitución) | Estado | Evidencia en este plan |
|---------------------------------------|--------|------------------------|
| I. Alcance, MVP y fuente de verdad | **ENMIENDA PENDIENTE** | La constitución 1.1.0 cubre **cinco sprints** (`.specify/memory/constitution.md`); este Sprint 6 es posterior y está definido en `docs/sprints/propuesta-sprints-post-mvp.md` y en `docs/project-context.md` 6.12 (fuente de verdad del alcance). La enmienda aprobada es **criterio de entrada** a la implementación, igual que el hallazgo H-01 del Sprint 5; hasta entonces no se inicia. Trazabilidad completa FR/US/CA en el spec |
| II. Arquitectura separada | PASS | Cambios dentro de `server/{models,services,controllers,routes,validators}` y `client/lib`; toda la lógica nueva (cálculo de avisos, matriz de rol, lectura, lista por avisar) vive en `services/`, nunca en controladores ni widgets; no se toca Mercado Pago ni integración alguna |
| III. Stack y base de datos local | PASS | ES Modules intacto; **una** migración nueva `015_notifications.sql`, aditiva e inmutables las anteriores; MySQL local InnoDB/`utf8mb4` con FKs; sin dependencias nuevas en ninguna capa; seeds idempotentes en `server/scripts/seed.js` ampliados, no reescritos |
| IV. Seguridad | PASS | Matriz de rol en backend: `GET /api/notifications` filtra por rol (CA-4), `GET/POST /api/client-notices` son solo ADMIN/RECEPTIONIST con `authorize(...)` (403 a MECHANIC, CA-10); validación zod con mensajes en español; sin secretos; el teléfono solo se devuelve a los roles que ya lo tienen (clients); sin trazas |
| V. Integridad de reglas de negocio | PASS | Avisos derivados sin duplicar información (RN-10, CA-2); la lectura es lo único que se guarda del centro; `client_notices` solo registra que una persona avisó (no envía nada); el stock sigue con su filtro `stock_current <= stock_min` sin negativos (RN-8); no se alteran reglas heredadas (RN-5, RN-11, RN-15) |
| VI. API consistente y errores | PASS | Contratos en `contracts/` con sobre `{ok, data}` / `{ok, error}`, códigos HTTP apropiados y **códigos existentes reutilizados** (`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`): sin catálogo de errores nuevo; la lectura es idempotente y documentada como tal |
| VII. Pruebas | PASS | Pruebas de la clave de lectura (D-04), del criterio de orden detenida (D-01), del cálculo de cada tipo de aviso, de la matriz por rol, de la lectura por usuario, de la idempotencia de seeds, de la lista por avisar y de rendimiento de la consulta (FR-013, CA-13); integración y contrato contra `motorix_test`; `flutter test` para campana, panel y lista; nombres y mensajes en español |
| VIII. UX/UI profesional | PASS | Panel con estados de carga, vacío y error según `docs/design-system.md` (CA-9, reutiliza `states_view.dart`); campana y colores desde tokens; marcar leído y abrir el módulo con confirmación implícita y mensajes en español; sin dependencias nuevas |

**Resultado**: 7/8 puertas en PASS y **1 pendiente de enmienda** (puerta I). La implementación no comienza hasta que la enmienda de la constitución (sprints 6 y 7) esté aprobada y registrada; no se justifica avanzar sin ella.

*Re-verificación post Fase 1*: PASS en las puertas II a VIII — `data-model.md` conserva InnoDB `utf8mb4` con FK `RESTRICT` y las claves únicas de lectura y de aviso a cliente; los contratos exigen token y matriz de rol completa, y documentan la idempotencia de la lectura y del registro de aviso; los avisos siguen calculados en cada consulta desde los módulos existentes (CA-2/CA-5, sin duplicación RN-10); el quickstart no usa la base principal ni contiene secretos. La puerta I sigue pendiente de la enmienda.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/006-notificaciones-internas/
├── plan.md                 # Este archivo
├── research.md             # Fase 0
├── data-model.md           # Fase 1
├── quickstart.md           # Fase 1
├── contracts/              # Fase 1
│   ├── README.md
│   ├── notifications.md    # campana, centro agrupado y lectura por usuario
│   └── client-notices.md   # lista de clientes por avisar y registro del aviso
└── tasks.md                # Fase 2 (/speckit.tasks, no lo crea /speckit.plan)
```

### Código fuente (raíz del repositorio)

```text
motorix/
├── client/
│   ├── lib/
│   │   ├── models/            # notification.dart + client_notice.dart (NUEVOS)
│   │   ├── providers/         # notifications_provider.dart (campana/panel, D-03)
│   │   │                     #   + client_notices_provider.dart (NUEVOS)
│   │   ├── screens/
│   │   │   ├── notifications/ # notifications_panel.dart: panel agrupado con
│   │   │   │                 #   estados de carga/vacío/error (CA-9)
│   │   │   └── clients/       # client_notice_screen.dart: «Clientes por avisar»
│   │   │                     #   con teléfono, motivo y marcar avisado (CA-10/CA-11)
│   │   ├── widgets/           # app_shell.dart: campana con contador en el
│   │   │                     #   encabezado + entrada de menú por rol (CA-1, CA-4)
│   │   ├── services/          # api_client.dart + rutas de avisos y avisos a cliente
│   │   └── utils/             # app_route.dart: ruta de la lista por avisar
│   └── test/                  # notifications_test, client_notices_test,
│                              #   app_shell bell test (NUEVOS)
│
├── server/
│   ├── models/
│   │   ├── notification_read.model.js   # NUEVO: marcarLeido(), leidasDe(userId)
│   │   └── client_notice.model.js       # NUEVO: pendientes(), registrar() con
│   │                                     #   clave única (client, type, source)
│   ├── services/
│   │   ├── notifications.service.js     # NUEVO: construirAvisos(usuario) reutiliza
│   │   │                                 #   listarMantenimientos, listar({low:true}),
│   │   │                                 #   citas de hoy y órdenes detenidas (D-01)
│   │   └── client-notices.service.js    # NUEVO: lista por avisar (LEFT JOIN de
│   │                                     #   lecturas de hechos) y registrar aviso
│   ├── controllers/                      # notifications.controller (NUEVO),
│   │                                     #   client_notices.controller (NUEVO)
│   ├── routes/                           # notifications.routes.js y
│   │                                     #   client_notices.routes.js (NUEVOS);
│   │                                     #   index.js +2 rutas montadas
│   ├── validators/notifications.js       # NUEVO: notificationKeySchema (D-04),
│   │                                     #   clientNoticeSchema (zod, mensajes ES)
│   ├── scripts/seed.js                   # ampliado: un caso por tipo de aviso,
│   │                                     #   cita de hoy y orden detenida (idempotente)
│   └── tests/
│       ├── unit/                # + notification-rules.test.js (clave D-04,
│       │                        #   criterio D-01, motivos de la lista)
│       ├── integration/         # + notifications.test.js, client-notices.test.js
│       └── contract/            # + notifications.contract.test.js,
│                                #   client-notices.contract.test.js
│
├── database/
│   ├── migrations/               # + 015_notifications.sql (aditiva: 2 tablas)
│   └── README.md                 # actualizar con la 015
│
├── docs/
│   ├── project-context.md        # actualizar 6.12 con el comportamiento entregado
│   └── design-system.md          # solo si cambia un token (no se espera)
│
├── specs/006-notificaciones-internas/
└── (sin cambios en .env ni dependencias)
```

**Decisión de estructura**: se conserva el monorepo de tres carpetas de primer nivel y las capas del backend directamente en `server/` (sin `src/`), como quedó resuelto en el Sprint 1. Los avisos a cliente se montan como recurso propio (`/api/client-notices`, router dedicado en `index.js`) en lugar de colgando de `/api/clients/notices`, para no competir con el patrón existente `GET /clients/:id` (el `/notices` fijado después de `/:id` nunca coincidiría); la campana vive en el encabezado compartido `app_shell.dart`, que ya contiene la navegación y el control de secciones por rol.

## Seguimiento de complejidad

> **Rellenar SOLO si la Verificación de la constitución tiene violaciones que deban justificarse**

| Violación | Por qué se necesita | Alternativa más simple rechazada porque |
|-----------|---------------------|-----------------------------------------|
| Principio I: la constitución 1.1.0 cubre cinco sprints y este es el sexto (posterior al MVP) | El programa del curso define los sprints 6 y 7 en `docs/sprints/propuesta-sprints-post-mvp.md`; la sección 6.12 del contexto maestro pide estos avisos internos y el alcance del sprint está acotado a ellos (spec con trazabilidad FR/US/CA) | Cancelar el sprint descarta el entregable; absorberlo en los sprints 1–5 obligaría a reabrir sprints ya cerrados y a mezclar alcances entregados |
| (enmienda) | Se registra como enmienda **MINOR** (nueva sección/alcance de sprints) con reporte de impacto en el encabezado de la constitución, según la gobernanza: aprobación del equipo coordinada por el director del proyecto | No aplica: la constitución obliga a aprobarla antes de implementar (mismo criterio de entrada que H-01 en el Sprint 5) |
