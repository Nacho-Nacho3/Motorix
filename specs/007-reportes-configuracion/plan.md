# Plan de Implementación: Reportes, configuración, términos y seguridad (Sprint 7)

**Rama**: `007-reportes-configuracion` | **Fecha**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de la funcionalidad en `specs/007-reportes-configuracion/spec.md`

## Resumen

Último sprint posterior al MVP. Cubre cuatro deudas: **configuración** (datos del taller y márgenes de «Próximo» editables, con catálogo de tipos de servicio y «Próximo servicio» en el ticket), **términos y seguridad** (aceptación de términos con bloqueo en el backend, bitácora de solo inserción, política de contraseñas con longitud máxima y cierre por inactividad), **reportes** (ingresos, servicios frecuentes, productividad, margen de refacciones y rotación) y **exportación CSV**.

El alcance concreto es: una migración única `016_settings_reports_security.sql` con 5 tablas nuevas (`settings`, `service_types`, `terms_versions`, `terms_acceptances`, `audit_log`) y 12 columnas nuevas o modificadas en 6 tablas existentes (P-1 a P-8 de [research.md](research.md)); 17 endpoints nuevos más cambios aditivos a los existentes ([contracts/](contracts/)); 3 secciones nuevas del menú de ADMIN (Configuración, Reportes y Bitácora), una pantalla de aceptación de términos y un detector de inactividad; **sin dependencias nuevas** en ninguna capa. Los reportes se calculan en cada consulta con importes en centavos (RN-10, CA-7) y el CSV sale de la misma estructura de filas que el JSON.

La verificación del código el 2026-11-24 corrigió tres afirmaciones del insumo (los datos del taller no están en `.env`, los márgenes no son globales y la política de contraseñas ya existe) y dejó **cuatro decisiones de diseño con impacto en datos existentes**: márgenes `NULL` = «usar el del taller» (P-3), instantánea de encabezado en el ticket (P-6), `finished_at` en la orden (P-7) y `unit_cost` por línea de refacción (P-8).

## Contexto técnico

**Lenguaje/Versión**: Dart/Flutter 3.47 (frontend); JavaScript con ES Modules en Node.js LTS (backend)

**Dependencias principales**: Express, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod` (backend, **sin dependencias nuevas**); Material Design 3, Provider, `google_fonts`, `data_table_2` y las del Sprint 4 (`pdf`, `printing`, `url_launcher`) (frontend, **sin dependencias nuevas**; el CSV se escribe con `dart:io`)

**Persistencia**: MySQL local (InnoDB, `utf8mb4`), esquema de los Sprints 1–6 + migración nueva `016_settings_reports_security.sql` con registro en `schema_migrations`; los reportes **no se almacenan**: se calculan de `payments`, `service_orders`, `order_services`, `order_labor`, `order_parts`, `parts` e `inventory_movements` (RN-10); solo se persisten la configuración, el catálogo, las versiones y aceptaciones de términos, la bitácora y las instantáneas (`unit_cost`, `finished_at` y el encabezado del ticket); base de pruebas `motorix_test`

**Pruebas**: Jest + supertest en backend (unit de `calcularProximoServicio`, resolución de márgenes, rotación, armado del CSV y neutralización de fórmulas, saneado de la bitácora; integración de configuración, catálogo, ticket con instantánea, términos y bloqueo, bitácora, política de contraseñas, inactividad, cinco reportes con cálculo independiente en centavos, exportación, permisos por rol, no exposición de datos, inyección, idempotencia de seeds y rendimiento; contrato de los 17 endpoints nuevos y de los cambios a los existentes); `flutter test` en frontend (Configuración, catálogo, Reportes, Bitácora, pantalla de términos, detector de inactividad y selector de tipo de servicio)

**Plataforma objetivo**: escritorio Windows (prioridad escritorio del MVP); backend local en la misma máquina del equipo

**Tipo de proyecto**: aplicación monorepo frontend + backend + base de datos local

**Metas de rendimiento**: respuestas API percibidas como instantáneas en local (<200 ms p95) para configuración, catálogo, términos y bitácora; cada reporte en menos de 3 segundos con los datos de ejemplo y con un rango de un año (SC-008); animaciones de interfaz de 150–250 ms según `docs/design-system.md`

**Restricciones**: ESM obligatorio; migraciones numeradas aditivas e inmutables (la 016 es la siguiente a la 015; el `007_...sql` del insumo es un número obsoleto); reportes derivados, nunca copiados (RN-10); importes en centavos enteros y `DECIMAL(10,2)` (Sprints 4 y 5); permisos validados en backend (RN-5, RN-15); contraseñas solo con hash (RN-14, principio IV); la bitácora no guarda datos reservados (CA-21) y no se edita ni se borra desde la aplicación; el precio de compra y los costos solo llegan a ADMIN; español en todo texto visible

**Alcance/Escala**: 1 migración nueva (016, 5 tablas y 12 columnas); 17 endpoints nuevos (`/api/settings` ×2, `/api/service-types` ×4, `/api/reports/*` ×5, `/api/terms` ×4, `/api/audit-log` ×1 y `GET /api/maintenances/suggestion`; ver los contratos); ~28 archivos backend nuevos (5 modelos, 5 servicios, 3 utilidades, 5 controladores, 5 rutas y 5 validadores) + `authenticate.js`, `auth.service.js`, `users.service.js`, `tickets.service.js`, `maintenances.service.js`, `order_part.model.js`, `service_orders.service.js`, `payments.service.js`, `validators/auth.js`, `routes/index.js` y `seed.js` tocados; ~14 archivos del frontend (modelos, 5 proveedores, 5 pantallas, `app_shell.dart`, `main.dart`, `api_client.dart`, `app_route.dart`, formularios de servicio y mantenimiento); ~8 suites de pruebas nuevas de backend y ~8 de Flutter

**Aclaraciones**: no queda ningún `NEEDS CLARIFICATION`: todos los valores anteriores se verificaron contra el repositorio el 2026-11-24 (ver el encabezado de [research.md](research.md)). Las decisiones D-01 a D-19 de la spec están resueltas o con valor por omisión confirmado en la investigación.

## Verificación de la constitución

*GATE: Debe pasar antes de la investigación de la Fase 0. Se re-verifica después del diseño de la Fase 1.*

| Puerta (principio de la constitución) | Estado | Evidencia en este plan |
|---------------------------------------|--------|------------------------|
| I. Alcance, MVP y fuente de verdad | **PASS** | La enmienda **1.2.0** (2026-11-18) ya amplía el alcance a siete sprints e incluye este sprint, definido en `docs/sprints/propuesta-sprints-post-mvp.md` y `docs/project-context.md` (sección «Sprint 7»); no requiere enmienda nueva. El sprint 7 sigue al cierre del Sprint 6 (aprobado el 2026-11-24). La trazabilidad FR → US → CA queda en la spec; `docs/project-context.md` se actualiza en el mismo sprint (FR-031) |
| II. Arquitectura separada | PASS | Cambios dentro de `server/{models,services,controllers,routes,validators,middlewares,utils}` y `client/lib`; toda la lógica nueva (cálculo de reportes, CSV, resolución de márgenes, próximo servicio, bloqueo por términos, saneado de la bitácora) vive en `services/` y `utils/`, nunca en controladores ni widgets; el frontend nunca toca MySQL; no se toca Mercado Pago |
| III. Stack y base de datos local | PASS | ES Modules intacto; **una** migración nueva `016`, aditiva e inmutables las anteriores; MySQL local InnoDB/`utf8mb4` con llaves foráneas; **sin dependencias nuevas** en ninguna capa (CSV con código propio y `dart:io`); seeds idempotentes en `server/scripts/seed.js`, ampliados y no reescritos |
| IV. Seguridad | PASS | Contraseñas solo con hash y política reforzada con longitud máxima (P-14); términos y reportes protegidos por `authenticate` + `authorize("ADMIN")` en el backend (RN-15); `403 TERMS_NOT_ACCEPTED` y `401 SESSION_IDLE` validados en el backend, no solo en pantalla; la bitácora excluye contraseñas, hashes, tokens y datos de tarjeta (CA-21); CSV con neutralización de fórmulas; entradas validadas con zod y consultas parametrizadas (CA-25); sin secretos nuevos ni trazas de pila |
| V. Integridad de reglas de negocio | PASS | Reportes derivados sin duplicar información (RN-10); las **cuatro instantáneas** (`unit_cost`, `finished_at`, encabezado del ticket y próximo servicio) guardan hechos de un momento, no resultados derivados, y siguen el precedente del precio por línea del Sprint 5 (justificación en P-6 a P-8); intervalos configurables (RN-12); los próximos mantenimientos siguen basándose en fecha, kilometraje o ambos (RN-11) con la misma función pura; una orden entregada se conserva (RN-9) y los tipos de servicio nunca se borran; no se alteran RN-5, RN-8 ni RN-15 |
| VI. API consistente y errores | PASS | Contratos en `contracts/` con sobre `{ok, data}` / `{ok, error}`, códigos HTTP apropiados y **códigos existentes reutilizados** (`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`, `WEAK_PASSWORD`); solo cuatro códigos nuevos y documentados (`TERMS_NOT_ACCEPTED`, `SESSION_IDLE`, `SERVICE_TYPE_NAME_TAKEN`, `TERMS_UNCHANGED`); la aceptación de términos es idempotente (201/200) y los cambios a endpoints existentes son aditivos |
| VII. Pruebas | PASS | Pruebas de las reglas nuevas (márgenes, próximo servicio, rotación, CSV, bitácora), del bloqueo por términos y por inactividad, de los cinco reportes contra un cálculo independiente en centavos, de permisos por rol, de no exposición de datos e inyección, de idempotencia de seeds y de rendimiento (FR-030, CA-13, CA-26); integración y contrato contra `motorix_test`; `flutter test` para las pantallas nuevas; nombres y mensajes en español |
| VIII. UX/UI profesional | PASS | Todas las pantallas nuevas usan los estados de carga, vacío y error de `states_view.dart`, tokens del tema y mensajes claros en español, y sus formularios piden confirmar antes de salir con cambios sin guardar, como los existentes (FR-017); las secciones de ADMIN se agregan al final del menú sin recorrer los índices existentes; confirmación previa al publicar una versión de términos; sin dependencias nuevas |

**Resultado**: 8/8 puertas en PASS. No hay violaciones que justificar.

*Re-verificación post Fase 1*: PASS en las ocho puertas — `data-model.md` conserva InnoDB `utf8mb4` con llaves foráneas y claves únicas (`terms_acceptances`, `service_types.name`); todos los cambios a tablas existentes admiten `NULL` o tienen valor por omisión, así que el código del Sprint 6 sigue funcionando contra el esquema nuevo; los contratos exigen token y rol en cada endpoint, y los de ADMIN responden 403 al resto; los reportes siguen calculándose en cada consulta desde los datos de origen; el CSV y el JSON comparten la misma estructura de filas.

## Ajustes a la especificación

La investigación dejó un ajuste de redacción en la spec, aplicado en el mismo commit que este plan para que no haya contradicciones:

- **FR-008 y escenarios 2 y 3 de la historia 8**: el CA-14 pide que el ticket muestre el próximo servicio «cuando la orden tiene un tipo de servicio con intervalo». La spec decía «cuando la orden tiene un próximo mantenimiento derivado de un tipo con intervalo», lo que habría exigido registrar antes un mantenimiento. Se alinea con el CA-14 (P-5): el ticket lo deriva de los tipos de las líneas de la orden.

## Riesgos y mitigaciones

| # | Riesgo | Mitigación |
|---|--------|------------|
| R-01 | El bloqueo por términos devuelve 403 a **todas** las suites autenticadas | El helper `tests/helpers/usuarios.js` registra la aceptación de la versión vigente al crear usuarios de prueba; solo dos suites crean usuarios por fuera y prueban el login (exento). Se corre la regresión completa tras el cambio de `authenticate` y antes de seguir |
| R-02 | El relleno de márgenes trata como «por omisión» un 30 o 500 capturado a propósito | Efecto nulo mientras el valor del taller no cambie; documentado en P-3 y en la nota del quickstart |
| R-03 | Las fechas de terminación de las órdenes anteriores son aproximadas (`updated_at`) | El reporte de productividad devuelve `approximateDates` (órdenes con `finished_at_estimated = 1`) y la pantalla lo avisa (D-19) |
| R-04 | Los `ALTER` sobre tablas con datos (`maintenance`, `order_parts`, `tickets`, `users`) pueden fallar a mitad de migración | Todos son aditivos o relajan una restricción; el script se prueba contra una copia con los seeds antes de aplicarlo a `motorix` y se registra en `schema_migrations` solo al terminar |
| R-05 | Escribir `last_activity_at` en cada petición castiga el rendimiento | Se refresca como máximo una vez por minuto (P-12) |
| R-06 | Un registro de bitácora con datos reservados | `detail` se arma con lista blanca por acción y una prueba recorre cada acción (P-13, CA-21) |
| R-07 | Un CSV con celdas que empiezan con `=` ejecuta fórmulas al abrirse | Neutralización con comilla simple y prueba específica (P-10) |
| R-08 | El bloque B (reportes) no alcanza el tiempo | El orden de entrega ya los pospone: el bloque A cierra primero con su regresión en verde (P-18); la migración única se aplica completa en el bloque A y los reportes solo agregan código |

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/007-reportes-configuracion/
├── plan.md                    # Este archivo
├── research.md                # Fase 0
├── data-model.md              # Fase 1
├── quickstart.md              # Fase 1
├── contracts/                 # Fase 1
│   ├── README.md
│   ├── settings.md            # configuración del taller y márgenes
│   ├── service-types.md       # catálogo de tipos de servicio
│   ├── reports.md             # cinco reportes y exportación CSV
│   ├── terms.md               # versiones, aceptación y bloqueo
│   ├── audit-log.md           # bitácora de solo lectura
│   └── changes-to-existing.md # cambios aditivos a mantenimientos, servicios, tickets y auth
├── checklists/requirements.md
└── tasks.md                   # Fase 2 (/speckit.tasks, no lo crea /speckit.plan)
```

### Código fuente (raíz del repositorio)

```text
motorix/
├── client/
│   ├── lib/
│   │   ├── models/             # app_settings, service_type, report_*, terms,
│   │   │                      #   audit_entry (NUEVOS)
│   │   ├── providers/          # settings_provider, service_types_provider,
│   │   │                      #   reports_provider, terms_provider, audit_provider
│   │   │                      #   (NUEVOS); session_provider.dart (termsAccepted)
│   │   ├── screens/
│   │   │   ├── settings/       # settings_screen.dart: taller, márgenes, tipos de
│   │   │   │                  #   servicio y términos (NUEVOS)
│   │   │   ├── reports/        # reports_screen.dart: 5 reportes, periodo, exportar
│   │   │   ├── audit/          # audit_log_screen.dart: bitácora con filtros
│   │   │   ├── terms/          # terms_acceptance_screen.dart: puerta tras el login
│   │   │   ├── orders/         # order_detail_screen.dart: selector de tipo de servicio
│   │   │   ├── maintenances/   # maintenance_form_screen.dart: propuesta y «usar el
│   │   │   │                  #   valor del taller»
│   │   │   └── tickets/        # ticket_screen.dart: «Próximo servicio»
│   │   ├── widgets/            # app_shell.dart: secciones 11 a 13 (solo ADMIN);
│   │   │                      #   inactivity_detector.dart (NUEVO)
│   │   ├── services/           # api_client.dart: rutas nuevas; descarga de CSV con dart:io
│   │   └── utils/              # app_route.dart: rutas nuevas; main.dart: puerta de
│   │                          #   términos y detector de inactividad
│   └── test/                   # settings_test, service_types_test, reports_test,
│                              #   audit_log_test, terms_gate_test, inactivity_test,
│                              #   order_service_type_test, ticket_next_service_test
│                              #   (NUEVOS)
│
├── server/
│   ├── config/
│   │   └── env.js                          # + idleMinutes = 30
│   ├── middlewares/
│   │   └── authenticate.js                 # + bloqueo por términos y por inactividad;
│   │                                       #   exporta authenticateSinTerminos
│   ├── models/
│   │   ├── settings.model.js               # NUEVO
│   │   ├── service_type.model.js           # NUEVO
│   │   ├── terms.model.js                  # NUEVO: versiones y aceptaciones
│   │   ├── audit.model.js                  # NUEVO: solo insertar() y listar()
│   │   ├── report.model.js                 # NUEVO: consultas de agregación
│   │   └── (maintenance, order_part, ticket, user: columnas nuevas)
│   ├── services/
│   │   ├── settings.service.js             # NUEVO: valores con respaldo, resolverMargenes()
│   │   ├── service-types.service.js        # NUEVO
│   │   ├── terms.service.js                # NUEVO
│   │   ├── audit.service.js                # NUEVO: registrar() con lista blanca
│   │   ├── reports.service.js              # NUEVO: 5 reportes en centavos
│   │   └── (tickets, maintenances, auth, users, payments, inventory, service_orders:
│   │         instantáneas, resolución de márgenes y llamadas a registrar())
│   ├── utils/
│   │   ├── next-service.js                 # NUEVO: calcularProximoServicio()
│   │   ├── csv.js                          # NUEVO: filasACsv() con BOM y neutralización
│   │   └── audit-detail.js                 # NUEVO: saneado de `detail`
│   ├── controllers/                        # settings, service_types, terms, audit,
│   │                                       #   reports (NUEVOS)
│   ├── routes/                             # settings.routes.js, service_types.routes.js,
│   │                                       #   terms.routes.js, audit.routes.js,
│   │                                       #   reports.routes.js (NUEVOS); index.js +5
│   │                                       #   rutas; auth.routes.js usa la variante exenta
│   ├── validators/                         # settings.js, service_types.js, terms.js,
│   │                                       #   reports.js, audit.js (NUEVOS); auth.js
│   │                                       #   (máximo de contraseña)
│   ├── scripts/seed.js                     # ampliado (idempotente): tipos, órdenes con
│   │                                       #   fecha de terminación y costo, pagos del periodo
│   └── tests/
│       ├── helpers/usuarios.js             # acepta los términos al crear usuarios
│       ├── unit/                           # + next-service, csv, settings-resolution,
│       │                                   #   audit-detail, inventory-rotation
│       ├── integration/                    # + settings, service-types, ticket-snapshot,
│       │                                   #   terms, audit-log, password-policy,
│       │                                   #   session-idle, reports, reports-export,
│       │                                   #   data-exposure, search-injection,
│       │                                   #   maintenance-margins
│       └── contract/                       # + settings, service-types, reports, terms,
│                                           #   audit-log, changes-to-existing
│
├── database/
│   ├── migrations/             # + 016_settings_reports_security.sql
│   └── README.md               # actualizar con la 016
│
├── docs/
│   ├── project-context.md      # actualizar la sección Sprint 7 y las reglas nuevas
│   └── design-system.md        # solo si cambia un token (no se espera)
│
├── .env.example                # sin cambios: los datos del taller y los márgenes nunca
│                              #   estuvieron ahí; queda documentado como valor de respaldo
└── specs/007-reportes-configuracion/
```

**Decisión de estructura**: se conserva el monorepo de tres carpetas de primer nivel y las capas del backend directamente en `server/` (sin `src/`), como en los sprints anteriores. Los reportes se montan como un recurso propio (`/api/reports/*`, un router) en lugar de colgar de `/api/dashboard`, para mantener el panel de control (Sprint 4) intacto y exclusivo de ADMIN. El bloqueo por términos y por inactividad se implementa **una sola vez en `authenticate`** (con una variante exenta para cuatro rutas) en lugar de repartirlo en cada uno de los 14 routers, para que ninguna ruta nueva pueda olvidarlo. Los puntos de la bitácora son llamadas a `audit.service.registrar()` dentro de los servicios, sin tocar controladores ni rutas.

## Estrategia de entrega

| Bloque | Historias de la spec | Contenido | Cierre |
|--------|----------------------|-----------|--------|
| **A** | P1 a P6 (US1, US2, US3, US8, US9, US10) | migración 016 completa, configuración, márgenes, catálogo, ticket con instantánea y próximo servicio, términos, bitácora, política de contraseñas, inactividad, no exposición e inyección, ajuste del helper de pruebas | regresión completa en verde (línea base 56 suites y 479 pruebas de backend; 145 de Flutter) y flujos V1 a V8, V11 y V12 del quickstart |
| **B** | P7 a P10 (US4, US5, US6, US7) | los cinco reportes, la exportación CSV y la pantalla de Reportes | regresión completa en verde y flujos V9, V10 y V13 |

Si el tiempo no alcanza, el bloque B es lo que se aplaza (propuesta de sprints, decisión D-02/D-15). `docs/project-context.md` y `docs/aseguramiento-calidad-sprint-7.md` se completan al cierre de cada bloque.

## Seguimiento de complejidad

> **Rellenar SOLO si la Verificación de la constitución tiene violaciones que deban justificarse**

No hay violaciones: las 8 puertas pasan. El sprint toca varios módulos de los Sprints 1 a 6, pero lo hace con cambios aditivos y sin cambiar sus contratos, y cada uno está cubierto por una prueba de regresión (`changes-to-existing.md`); no se agregan proyectos, capas ni dependencias.
