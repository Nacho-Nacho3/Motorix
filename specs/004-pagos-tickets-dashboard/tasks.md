---
description: "Lista de tareas del Sprint 4: pagos, tickets y dashboard"
---

# Tasks: Pagos, tickets y dashboard (Sprint 4)

**Input**: Documentos de diseño en `/specs/004-pagos-tickets-dashboard/`

**Prerequisites**: plan.md (requerido), spec.md (historias con prioridades), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Solicitados explícitamente por el spec (SC-008 «las pruebas automatizadas de la lógica de pagos y de la generación de tickets existen y pasan», CA-8) y exigidos por la constitución (Principio VII). Se incluyen pruebas unitarias, de integración, de contrato y de Flutter.

**Organization**: Las tareas están agrupadas por historia de usuario para poder implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: Historia a la que pertenece la tarea (US1, US2, …)
- Cada tarea indica la ruta exacta del archivo

## Convenciones de rutas

- Backend: `server/` (capas directas, sin `src/`), pruebas en `server/tests/{unit,integration,contract}`
- Frontend: `client/lib/` (models, providers, services, screens, widgets, utils), pruebas en `client/test/`
- Base de datos: `database/migrations/` (SQL numerado e inmutable)
- Contratos del feature: `specs/004-pagos-tickets-dashboard/contracts/`

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: Línea base verificada y utilidades de error compartidas por todo el sprint

- [X] T001 Verificar la línea base verde del Sprint 3 antes de tocar código: `npm test` y `npm run lint` en `server/`, y `flutter analyze` y `flutter test` en `client/` (deben pasar las 308 pruebas de backend y las 98 de frontend)
- [X] T002 [P] Extender `server/utils/errors.js` con fábricas de los códigos nuevos del sprint, con mensajes en español: `PAYMENT_NOT_FOUND`, `PAYMENT_AMOUNT_MISMATCH`, `ORDER_ALREADY_PAID`, `PENDING_PAYMENT_EXISTS`, `ORDER_NOT_PAYABLE`, `INVALID_PAYMENT_TRANSITION`, `MERCADO_PAGO_NOT_CONFIGURED`, `MERCADO_PAGO_ERROR`, `TICKET_NOT_FOUND` y `ORDER_NOT_FINISHED` (`SERVICE_ORDER_NOT_FOUND`, `VALIDATION_ERROR` y `FORBIDDEN` ya existen; tabla de códigos en `specs/004-pagos-tickets-dashboard/contracts/README.md`)

---

## Fase 2: Fundacional (prerrequisitos bloqueantes)

**Propósito**: Esquema del Sprint 4 (tablas `payments` y `tickets`); bloquea a TODAS las historias de usuario

**⚠ CRITICAL**: Ninguna historia puede comenzar hasta completar esta fase

- [X] T003 [P] Crear `database/migrations/012_create_payments.sql` con la tabla `payments` según `specs/004-pagos-tickets-dashboard/data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT; `order_id` INT UNSIGNED NOT NULL FK → `service_orders.id` RESTRICT (RN-13: todo pago con orden, sin pagos huérfanos); `amount` DECIMAL(10,2) NOT NULL con CHECK `> 0`; `method` ENUM('CASH','CARD','TRANSFER','MERCADO_PAGO') NOT NULL (CA-2); `status` ENUM('PENDING','PAID','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING' (FR-003); `external_reference` VARCHAR(100) NULL (referencia MP, índice); `created_by` INT UNSIGNED NOT NULL FK → `users.id` RESTRICT; `created_at`/`updated_at`; índices en `order_id`, `status` y `external_reference`; **sin columnas de tarjeta ni datos sensibles** (RN-14, FR-017) y **sin `DELETE`** (libro de auditoría); InnoDB `utf8mb4`
- [X] T004 [P] Crear `database/migrations/013_create_tickets.sql` con la tabla `tickets` según `data-model.md`: `id` INT UNSIGNED PK AUTO_INCREMENT (base del folio `TCK-{id:06d}`, R-05); `order_id` INT UNSIGNED NOT NULL **UNIQUE** (`uk_tickets_order_id`) FK → `service_orders.id` RESTRICT (un ticket por orden, FR-011); `issued_by` INT UNSIGNED NOT NULL FK → `users.id` RESTRICT; `created_at`; **sin columna de folio y sin desglose almacenado** (se calcula, RN-10) y **sin `DELETE`**; InnoDB `utf8mb4`
- [X] T005 Ejecutar `database/scripts/aplicar-migraciones.ps1` y comprobar en `schema_migrations` los registros `012_create_payments` y `013_create_tickets`; volver a ejecutarlo para confirmar que es idempotente (0 aplicadas la segunda vez)

**Checkpoint**: Esquema listo; las historias de usuario pueden empezar

---

## Fase 3: Historia de usuario 1 - Registrar el pago de una orden (Prioridad: P1) 🎯 MVP

**Objetivo**: La recepción registra el cobro de una orden terminada o entregada con efectivo, tarjeta o transferencia: el importe es exactamente el total calculado (servicios + mano de obra + refacciones), el pago queda `PAID` y se persiste; la orden solo acepta un pago pagado

**Prueba independiente**: Sobre una orden `FINISHED` sin pago, registrar un pago en efectivo desde el formulario (total precargado) → el pago aparece `Pagado` con el importe = total y persiste al reabrir; un segundo pago, un importe distinto, una orden en curso o el rol mecánico se rechazan (CA-1, SC-001, SC-004)

### Pruebas de la historia de usuario 1

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T006 [P] [US1] Prueba unitaria del total en `server/tests/unit/order-total.test.js`: `servicesSubtotal = Σ unit_price`; `laborSubtotal = Σ (hours × hourly_rate)`; `partsSubtotal = Σ (quantity × sale_price vigente de la refacción)`; `total` = suma de los tres; orden sin filas en ninguna tabla → `"0.00"`; importes como cadenas con 2 decimales (R-03, CA-4); nombres y mensajes en español, prueba que debe fallar al inicio
- [X] T007 [P] [US1] Prueba unitaria de las reglas de pago en `server/tests/unit/payment-rules.test.js`: método manual (`CASH`/`CARD`/`TRANSFER`) → estado `PAID`; `amount` ≠ total → error `PAYMENT_AMOUNT_MISMATCH` (Q1: sin pagos parciales); segundo pago `PAID` sobre la misma orden → `ORDER_ALREADY_PAID`; un `PENDING` activo bloquea (`PENDING_PAYMENT_EXISTS`) pero los estados terminales no bloquean un reintento; orden en `RECEIVED`/`DIAGNOSIS`/`IN_REPAIR`/`WAITING_PART` → `ORDER_NOT_PAYABLE`; método no soportado → `VALIDATION_ERROR`; los estados terminales no tienen transiciones de salida; nombres y mensajes en español, prueba que debe fallar al inicio
- [X] T008 [P] [US1] Prueba de integración en `server/tests/integration/payments.test.js` contra `motorix_test`: `GET /api/service-orders/{id}/total` → 200 con subtotales y total correctos; `POST .../payments` con `CASH` → 201 `PAID` con `amount` = total; sin `amount` usa el total; segundo pago → 400 `ORDER_ALREADY_PAID`; `amount` distinto → 400 `PAYMENT_AMOUNT_MISMATCH`; orden no terminada → 400 `ORDER_NOT_PAYABLE`; orden inexistente → 404 `SERVICE_ORDER_NOT_FOUND`; método `BITCOIN` → 400 `VALIDATION_ERROR`; `GET .../payments` lista los pagos más recientes primero con `totalPaid`; MECHANIC → 403 `FORBIDDEN` en total, listar y registrar (RN-15, R-07); el pago persiste tras reconsultar (SC-004); pruebas que deben fallar al inicio
- [X] T009 [P] [US1] Prueba de contrato en `server/tests/contract/payments.contract.test.js` contra `specs/004-pagos-tickets-dashboard/contracts/payments.md`: sobre `{ok,data}` en total y pagos; `amount` como cadena con 2 decimales (`"3150.00"`); `initPoint` `null` en métodos manuales; método/estado en enums `CASH|CARD|TRANSFER|MERCADO_PAGO` y `PENDING|PAID|REJECTED|CANCELLED`; códigos `PAYMENT_AMOUNT_MISMATCH`/`ORDER_ALREADY_PAID`/`ORDER_NOT_PAYABLE`/`VALIDATION_ERROR`/`FORBIDDEN`/`SERVICE_ORDER_NOT_FOUND`; pruebas que deben fallar al inicio
- [X] T010 [P] [US1] Prueba de widget en `client/test/payment_form_test.dart`: el formulario muestra el total calculado, el importe precargado igual al total, los métodos disponibles, el botón «Registrar pago» y los estados vacío/cargando/error; registrar un pago en efectivo refleja el estado «Pagado» (CA-1, US1); pruebas que deben fallar al inicio

### Implementación de la historia de usuario 1

- [X] T011 [P] [US1] Crear `server/models/payment.model.js` con `buscarPorId`, `listarPorOrden` (más recientes primero), `contarPagadaPorOrden`, `contarPendientePorOrden` y `crear` (registra `created_by`); sin `DELETE` y sin `PATCH` (auditoría; el estado solo cambia por `sync`/`cancel` en US4)
- [X] T012 [US1] Crear `server/services/order-total.service.js` con `calcularTotalOrden(orderId)`: fórmula única de R-03 (`Σ unit_price`, `Σ hours × hourly_rate`, `Σ quantity × sale_price` vigente) que devuelve `servicesSubtotal`, `laborSubtotal`, `partsSubtotal` y `total` como cadenas de 2 decimales; reutilizada por pagos y tickets (RN-10, sin totales almacenados)
- [X] T013 [US1] Crear `server/services/payments.service.js` con `registrarPago` (transacción con `SELECT … FOR UPDATE` sobre la orden: VN-01 orden existe → 404, VN-02 estado `FINISHED`/`DELIVERED` → 400 `ORDER_NOT_PAYABLE`, VN-03 `amount` = total → 400 `PAYMENT_AMOUNT_MISMATCH`, VN-04 un solo `PAID` → 400 `ORDER_ALREADY_PAID`, VN-05 un solo `PENDING` → 409 `PENDING_PAYMENT_EXISTS`; métodos manuales crean el pago directamente `PAID`) y `listarPagos` con `totalPaid` (depende de T011, T012)
- [X] T014 [US1] Crear `server/validators/payments.js` con zod y mensajes en español: `paymentCreateSchema` con `method` obligatorio en `CASH|CARD|TRANSFER` (estado interino: `MERCADO_PAGO` se suma en US2) y `amount` opcional decimal ≥ 0.01 con hasta 2 decimales; el cuerpo **no** admite `status` ni `orderId` (el estado lo determina el servicio y la orden viene de la ruta)
- [X] T015 [US1] Crear `server/controllers/payments.controller.js` con `getOrderTotal`, `listPayments` y `createPayment` según `contracts/payments.md` (depende de T013)
- [X] T016 [US1] Crear `server/routes/payments.routes.js` con `GET /api/service-orders/:id/total`, `GET /api/service-orders/:id/payments` y `POST /api/service-orders/:id/payments` (`authenticate` + `authorize(["ADMIN","RECEPTIONIST"])` + `validate`) y registrarlo en `server/routes/index.js`
- [X] T017 [P] [US1] Crear `client/lib/models/payment.dart` con `fromJson` y las etiquetas en español de métodos (Efectivo, Tarjeta, Transferencia, Mercado Pago) y estados (Pendiente, Pagado, Rechazado, Cancelado)
- [X] T018 [US1] Crear `client/lib/providers/payments_provider.dart` con `cargarTotal(orderId)`, `registrarPago(orderId, method, amount)`, `listarPagos(orderId)` y estados vacío/cargando/error (patrón del proyecto: el provider llama directo a `api.get`/`api.post` de `ApiClient`)
- [X] T019 [US1] Crear `client/lib/screens/payments/payment_form_screen.dart` con total visible, importe precargado igual al total, selector de métodos (3 chips: Efectivo, Tarjeta, Transferencia), botón «Registrar pago», confirmación y estados con `states_view.dart` (tokens de `docs/design-system.md`)
- [X] T020 [US1] Ampliar `client/lib/screens/orders/order_detail_screen.dart` con la sección «Pago»: estado de cobro actual (píldora de estado), acción «Registrar pago» (solo si la orden es `FINISHED`/`DELIVERED` y no tiene pago `PAID`), historial de pagos previos y estado vacío «Sin pago»
- [X] T021 [US1] Registrar la ruta del formulario de pago en `client/lib/utils/app_route.dart` y el provider en `client/lib/main.dart`

**Checkpoint**: Historia de usuario 1 completa y verificable por sí sola (CA-1): cobro manual de extremo a extremo

---

## Fase 4: Historia de usuario 2 - Seleccionar el método de pago (Prioridad: P2)

**Objetivo**: Se completan los 4 métodos del negocio (FR-002): efectivo, tarjeta y transferencia crean el pago `PAID`; Mercado Pago crea el pago `PENDING` y su preferencia cuando está configurado (sin credenciales responde «no disponible» en español y los métodos manuales siguen operando); un método no soportado se rechaza

**Prueba independiente**: Registrar pagos con cada método disponible y ver cada uno guardado junto a importe y estado; con Mercado Pago sin credenciales → 409 `MERCADO_PAGO_NOT_CONFIGURED` sin afectar a los manuales; método desconocido → 400 con mensaje en español (CA-2, US2 escenarios 1–3)

### Pruebas de la historia de usuario 2

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T022 [P] [US2] Ampliar `server/tests/integration/payments.test.js`: `POST .../payments` con `MERCADO_PAGO` sin credenciales → 409 `MERCADO_PAGO_NOT_CONFIGURED` con mensaje en español y sin pago persistido (los manuales siguen funcionando); los 3 métodos manuales quedan registrados con su `method` visible en `GET .../payments` (CA-2); el cuerpo con `status` propio → 400 `VALIDATION_ERROR`; pruebas que deben fallar al inicio
- [X] T023 [P] [US2] Ampliar `client/test/payment_form_test.dart`: los 4 métodos aparecen como opciones (Mercado Pago incluido); elegir Mercado Pago sin configurar muestra el aviso «no disponible» y no rompe el formulario; el método elegido se muestra en el resumen del pago (CA-2, FR-002); pruebas que deben fallar al inicio

### Implementación de la historia de usuario 2

- [X] T024 [P] [US2] Ampliar `server/validators/payments.js`: `method` acepta también `MERCADO_PAGO` en `paymentCreateSchema` (mensaje en español para valores fuera del enum)
- [X] T025 [US2] Crear `server/config/mercadopago.js` que lee `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY` del entorno y expone `{ configurado }` (false si el token está vacío); **sin secretos en el repositorio** (CA-7)
- [X] T026 [US2] Crear `server/services/mercadopago.service.js` con `crearPreferenciaPago` que lanza 409 `MERCADO_PAGO_NOT_CONFIGURED` cuando `configurado` es false (la implementación real de preferencia, `sync` y `cancel` llega en US4; R-04 aísla toda llamada al proveedor en este módulo)
- [X] T027 [US2] Ampliar `server/services/payments.service.js`: rama `MERCADO_PAGO` de `registrarPago` — en la misma transacción crea el pago `PENDING` y llama a `crearPreferenciaPago` (si lanza `MERCADO_PAGO_NOT_CONFIGURED` se revierte la transacción y el error se propaga sin pago persistido); devuelve `initPoint` junto al pago (depende de T025, T026)
- [X] T028 [US2] Ampliar `client/lib/screens/payments/payment_form_screen.dart` con el cuarto chip «Mercado Pago» y el manejo del aviso «no disponible» (409) sin perder el formulario; el importe y el método quedan visibles en la confirmación del pago

**Checkpoint**: Historia de usuario 2 completa: los 4 métodos del negocio se soportan de extremo a extremo (CA-2)

---

## Fase 5: Historia de usuario 3 - Generar el ticket de servicio (Prioridad: P3)

**Objetivo**: La recepción genera el comprobante de una orden terminada o entregada: folio único derivado del id, contenido calculado (taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotales, total, método y estado de pago, fecha), imprimible y sin duplicados

**Prueba independiente**: Generar el ticket de una orden terminada y ver todo el desglose; reabrirlo da el mismo folio; imprimirlo abre el diálogo del sistema; una orden en curso lo rechaza (CA-4, CA-5, FR-011, SC-002)

### Pruebas de la historia de usuario 3

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T029 [P] [US3] Prueba unitaria del folio en `server/tests/unit/ticket-folio.test.js`: el folio se deriva del id con 6 dígitos (`TCK-000001`, `TCK-000123`); sin contador ni columna propia (R-05); nombres y mensajes en español, prueba que debe fallar al inicio
- [X] T030 [P] [US3] Prueba de integración en `server/tests/integration/tickets.test.js` contra `motorix_test`: `POST .../ticket` sobre orden `FINISHED` → 201 con ticket; segundo `POST` → 200 con el **mismo** ticket y folio, 0 duplicados (SC-004 del ticket, FR-011); `GET .../ticket` devuelve el contenido completo de CA-4 (folio, taller, cliente, vehículo, placas, kilometraje de entrada, servicios, refacciones con cantidad y precio vigente, mano de obra con horas × tarifa, subtotales, total, `payment` del pago `PAID` o `null`, `createdAt`); orden en curso → 400 `ORDER_NOT_FINISHED`; orden inexistente → 404 `SERVICE_ORDER_NOT_FOUND`; sin ticket → 404 `TICKET_NOT_FOUND`; MECHANIC → 403 `FORBIDDEN` (RN-15); pruebas que deben fallar al inicio
- [X] T031 [P] [US3] Prueba de contrato en `server/tests/contract/tickets.contract.test.js` contra `specs/004-pagos-tickets-dashboard/contracts/tickets.md`: sobre `{ok,data}` con `ticket`; campos completos del objeto ticket; idempotencia 201/200; `payment: null` sin pago; códigos `ORDER_NOT_FINISHED`/`TICKET_NOT_FOUND`/`FORBIDDEN`; pruebas que deben fallar al inicio
- [X] T032 [P] [US3] Prueba de widget en `client/test/ticket_screen_test.dart`: el comprobante muestra folio, totales, desglose y el botón «Imprimir»; con `payment: null` muestra «Sin pago» (US3 escenario 4); pruebas que deben fallar al inicio

### Implementación de la historia de usuario 3

- [X] T033 [P] [US3] Crear `server/models/ticket.model.js` con `buscarPorOrden` y `crear` (sobre la clave única `order_id`: en duplicado devuelve el existente); sin `DELETE`
- [X] T034 [P] [US3] Crear `server/config/taller.js` con las constantes del taller para el ticket (nombre «Motorix», dirección y teléfono `null` hasta que exista un módulo de ajustes; R-05)
- [X] T035 [US3] Crear `server/services/tickets.service.js` con `generarTicket` (orden existe → 404; estado `FINISHED`/`DELIVERED` → 400 `ORDER_NOT_FINISHED`; idempotente 201/200) y `obtenerTicket` que arma el contenido calculado de CA-4 reutilizando `order-total.service.js` y el pago `PAID` de la orden (`payment: null` si no existe) con folio derivado del id (depende de T012, T033, T034)
- [X] T036 [US3] Crear `server/controllers/tickets.controller.js` y `server/routes/tickets.routes.js` con `POST /api/service-orders/:id/ticket` y `GET /api/service-orders/:id/ticket` (`authenticate` + `authorize(["ADMIN","RECEPTIONIST"])`) y registrarlos en `server/routes/index.js`
- [X] T037 [P] [US3] Crear `client/lib/models/ticket.dart` con `fromJson` del objeto ticket completo (secciones, subtotales y pago)
- [X] T038 [US3] Ampliar `client/lib/providers/payments_provider.dart` con `generarTicket(orderId)` y `obtenerTicket(orderId)` (el ticket vive en el contexto de la orden)
- [X] T039 [US3] Crear `client/lib/screens/tickets/ticket_screen.dart`: comprobante de ancho fijo con todos los campos de CA-4 en español, botón «Imprimir» que genera el PDF **en memoria** con el paquete `pdf` y lo envía al diálogo del sistema con `printing` (`Printing.layoutPdf`), sin almacenar archivos
- [X] T040 [US3] Agregar `pdf` y `printing` a `client/pubspec.yaml` (justificación R-06: imprimir no se resuelve con <50 líneas), añadir la acción «Generar/Ver ticket» en la sección «Pago» de `client/lib/screens/orders/order_detail_screen.dart` y registrar la ruta en `client/lib/utils/app_route.dart` (nota de adaptación: AppRoute solo define la transición de página, patrón de T019/T035/T054 de sprints previos; la navegación al comprobante es AppRoute(builder: ...) desde la sección «Pago» del detalle, y PaymentsProvider ya estaba registrado en T021)

**Checkpoint**: Historia de usuario 3 completa: comprobante imprimible con folio único (CA-4, CA-5)

---

## Fase 6: Historia de usuario 4 - Pagar con Mercado Pago en modo sandbox (Prioridad: P4)

**Objetivo**: El pago MP nace `PENDING` con su preferencia de sandbox, se abre el checkout en el navegador, «Verificar estado» sincroniza el resultado del proveedor (`approved → PAID`, `rejected → REJECTED`) y «Cancelar» abandona el intento; el proveedor se prueba **simulado** (sin red) y la lógica queda aislada en su servicio (R-04, RN-14)

**Prueba independiente**: Con el cliente MP simulado, un pago MP crea la preferencia y queda `Pendiente`; el sync lo lleva a `Pagado`/`Rechazado`; cancelarlo deja la orden libre para otro intento; sin credenciales → «no disponible» sin bloquear los manuales (CA-3, CA-7, SC-006)

### Pruebas de la historia de usuario 4

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T041 [P] [US4] Prueba de integración en `server/tests/integration/payments-mp.test.js` contra `motorix_test` con el cliente de Mercado Pago **simulado** (mock del módulo, sin red): `POST .../payments` con `MERCADO_PAGO` configurado → 201 pago `PENDING` con `initPoint` y `externalReference` (CA-3); `POST .../payments/{paymentId}/sync` con resultado aprobado → 200 `PAID`; rechazado → 200 `REJECTED`; en proceso → permanece `PENDING`; `POST .../payments/{paymentId}/cancel` → 200 `CANCELLED` y la orden acepta otro intento; `sync`/`cancel` sobre método manual o estado terminal → 409 `INVALID_PAYMENT_TRANSITION`; pago de otra orden → 404 `PAYMENT_NOT_FOUND`; el proveedor simulado lanzando error → 502 `MERCADO_PAGO_ERROR` sin cambio de estado; sin credenciales → 409 `MERCADO_PAGO_NOT_CONFIGURED`; pruebas que deben fallar al inicio
- [X] T042 [P] [US4] Ampliar `server/tests/contract/payments.contract.test.js` contra `contracts/payments.md`: `initPoint` no nulo para MP (cliente simulado); contratos de `sync` y `cancel` con sus códigos (`INVALID_PAYMENT_TRANSITION`, `PAYMENT_NOT_FOUND`, `MERCADO_PAGO_NOT_CONFIGURED`, `MERCADO_PAGO_ERROR` 502); pruebas que deben fallar al inicio
- [X] T043 [P] [US4] Prueba de widget en `client/test/payment_mp_test.dart`: el flujo MP muestra el estado `Pendiente`, el botón «Verificar estado» y «Cancelar pago» con confirmación; el resultado del sync refleja «Pagado» o «Rechazado» (CA-3, RN-14: sin campos de tarjeta en la UI); pruebas que deben fallar al inicio

### Implementación de la historia de usuario 4

- [X] T044 [P] [US4] Completar `server/services/mercadopago.service.js` con `crearPreferenciaPago` (`POST https://api.mercadopago.com/checkout/preferences` con `external_reference = paymentId`, un ítem «Orden de servicio #N» con el total y cabecera `Authorization: Bearer $MP_ACCESS_TOKEN`, usando el `fetch` global de Node) y `consultarPago` (`GET /v1/payments/search?external_reference=…` con mapeo `approved → PAID`, `rejected → REJECTED`, resto → `PENDING`); toda falla del proveedor → 502 `MERCADO_PAGO_ERROR`; cliente HTTP **inyectable** para las pruebas simuladas (R-04: este es el único módulo que habla con el proveedor; RN-14: nunca recibe ni guarda datos de tarjeta)
- [X] T045 [US4] Ampliar `server/services/payments.service.js` con `sincronizarPago` (pago propio `MERCADO_PAGO` en `PENDING` → llama a `consultarPago` y aplica la transición; otro caso → 409 `INVALID_PAYMENT_TRANSITION`; pago ajeno a la orden → 404 `PAYMENT_NOT_FOUND`) y `cancelarPago` (`PENDING` → `CANCELLED` local, sin reembolsos) (depende de T044)
- [X] T046 [US4] Ampliar `server/controllers/payments.controller.js` y `server/routes/payments.routes.js` con `POST /api/service-orders/:id/payments/:paymentId/sync` y `POST /api/service-orders/:id/payments/:paymentId/cancel` (`authenticate` + `authorize(["ADMIN","RECEPTIONIST"])`)
- [X] T047 [US4] Ampliar `client/lib/screens/payments/payment_form_screen.dart` con el flujo MP: al crear el pago mostrar `Pendiente` con el `initPoint`, botón «Abrir en el navegador» (`url_launcher`), «Verificar estado» (sync) y «Cancelar pago» con `confirm_dialog.dart`; píldoras de estado con tokens (ámbar Pendiente, verde Pagado, rojo Rechazado, gris Cancelado)
- [X] T048 [US4] Agregar `url_launcher` a `client/pubspec.yaml` y ampliar `client/lib/providers/payments_provider.dart` con `sincronizarPago(orderId, paymentId)` y `cancelarPago(orderId, paymentId)`

**Checkpoint**: Historia de usuario 4 completa: flujo digital sandbox de extremo a extremo sin datos de tarjeta (CA-3, CA-7)

---

## Fase 7: Historia de usuario 5 - Panel de control con información general (Prioridad: P5)

**Objetivo**: El administrador abre un panel con los 8 indicadores reales del taller (vehículos atendidos y en reparación, órdenes pendientes y terminadas, citas próximas, mantenimientos próximos y vencidos, stock bajo), calculados en cada consulta sin duplicar información

**Prueba independiente**: Como admin, abrir Dashboard y ver los 8 contadores coherentes con los datos de los módulos; como recepción o mecánico → 403; taller vacío → todo en cero con estados vacíos (CA-6, SC-003, SC-007)

### Pruebas de la historia de usuario 5

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T049 [P] [US5] Prueba de integración en `server/tests/integration/dashboard.test.js` contra `motorix_test`: `GET /api/dashboard` → 200 con los 8 contadores del `summary` coincidentes con los datos reales (`vehiclesAttended` = vehículos distintos con órdenes `FINISHED`/`DELIVERED`; `vehiclesInRepair` con los 4 estados activos; `ordersPending`; `ordersFinished`; `nextAppointments` con `appointment_date >= hoy` y `PENDING`/`CONFIRMED`; `upcomingMaintenances`/`overdueMaintenances` con el estado calculado; `lowStockCount` = `stock_current <= stock_min`); RECEPTIONIST y MECHANIC → 403 `FORBIDDEN` (RN-15, FR-012); base vacía → todos en cero (US5 escenario 3); pruebas que deben fallar al inicio
- [X] T050 [P] [US5] Prueba de contrato en `server/tests/contract/dashboard.contract.test.js` contra `specs/004-pagos-tickets-dashboard/contracts/dashboard.md`: sobre `{ok,data}` con `summary` y arreglos; los 8 campos del resumen; 403 para roles no ADMIN; pruebas que deben fallar al inicio
- [X] T051 [P] [US5] Prueba de widget en `client/test/dashboard_screen_test.dart`: la entrada «Dashboard» es visible solo para ADMIN en el rail y no aparece para RECEPTIONIST/MECHANIC; las 8 tarjetas muestran su etiqueta en español y su valor (CA-6, FR-012); pruebas que deben fallar al inicio

### Implementación de la historia de usuario 5

- [X] T052 [P] [US5] Crear `server/models/dashboard.model.js` con las consultas de conteo (`COUNT(DISTINCT vehicle_id)` atendidos y en reparación, `COUNT(*)` de órdenes pendientes/terminadas y citas próximas) usando los índices existentes de `status`, `vehicle_id` y `(appointment_date, appointment_time)`
- [X] T053 [US5] Crear `server/services/dashboard.service.js` que compone el `summary`: reutiliza `maintenance.model.js` con `calcularEstadoMantenimiento` de `server/utils/maintenance-state.js` (misma regla que la lista de mantenimientos, sin duplicar) y el filtro de stock bajo del inventario (`stock_current <= stock_min`); cálculo en cada consulta, sin caché ni tablas derivadas (RN-10, R-08) (depende de T052)
- [X] T054 [US5] Crear `server/controllers/dashboard.controller.js` y `server/routes/dashboard.routes.js` con `GET /api/dashboard` (`authenticate` + `authorize(["ADMIN"])`) y registrarlos en `server/routes/index.js`
- [X] T055 [P] [US5] Crear `client/lib/models/dashboard_data.dart` con `fromJson` del `summary` y etiquetas en español de los 8 indicadores
- [X] T056 [US5] Crear `client/lib/providers/dashboard_provider.dart` con `cargar()`, estado vacío/cargando/error y recarga manual
- [X] T057 [US5] Crear `client/lib/screens/dashboard/dashboard_screen.dart` con las 8 tarjetas de indicadores (tokens de `docs/design-system.md`), estados con `states_view.dart` y el estado vacío en español
- [X] T058 [US5] Agregar la entrada «Dashboard» en `client/lib/widgets/app_shell.dart` visible **solo para ADMIN**, registrar la ruta en `client/lib/utils/app_route.dart` y el provider en `client/lib/main.dart` (nota de adaptación: AppRoute solo define la transición de página, patrón de T019/T035/T040/T054 de sprints previos; el Dashboard se abre con la entrada del rail —cambio de sección dentro del shell, sin navegar con AppRoute— y DashboardProvider quedó registrado en `main.dart`)

**Checkpoint**: Historia de usuario 5 completa: supervisión general del taller con datos reales (CA-6)

---

## Fase 8: Historia de usuario 6 - Detalle visual del panel (Prioridad: P6)

**Objetivo**: El panel muestra el detalle para pasar del resumen a la acción: últimas órdenes, próximas citas, mantenimientos próximos/vencidos y refacciones en alerta; al cambiar un dato en su módulo, el panel lo refleja al recargar

**Prueba independiente**: Con el panel abierto, cada sección lista sus registros vigentes; entregar una orden y actualizar → los contadores y el detalle reflejan el cambio (CA-6, RN-10)

### Pruebas de la historia de usuario 6

> **NOTA**: Escribir estas pruebas PRIMERO y comprobar que fallan antes de implementar

- [X] T059 [P] [US6] Ampliar `server/tests/integration/dashboard.test.js`: `recentOrders` (últimas 5 con cliente, vehículo, estado y total), `nextAppointments` (próximas 5 con fecha, hora, motivo y estado), `maintenances.upcoming` (5) y `maintenances.overdue` (todos) con sus días/kilómetros restantes, `lowStockParts` (todas con `stockCurrent`/`stockMin`); entregar una orden terminada y reconsultar → `ordersFinished` y `vehiclesAttended` cambian en la misma respuesta (SC-007, RN-10); pruebas que deben fallar al inicio
- [X] T060 [P] [US6] Ampliar `client/test/dashboard_screen_test.dart`: las secciones «Últimas órdenes», «Próximas citas», «Mantenimientos» y «Alertas de inventario» renderizan sus registros; cada sección con datos vacíos muestra su estado vacío en español; el botón «Actualizar» recarga el panel; pruebas que deben fallar al inicio

### Implementación de la historia de usuario 6

- [X] T061 [US6] Ampliar `server/models/dashboard.model.js` y `server/services/dashboard.service.js` con las listas de detalle (más recientes/próximas primero, con los límites del contrato: 5, 5, 5, todas y todas) calculadas **en la misma ejecución** que el `summary` (SC-007); reutiliza el orden de urgencia de mantenimientos y el filtro de stock bajo existentes
- [X] T062 [P] [US6] Ampliar `client/lib/models/dashboard_data.dart` con las secciones de detalle (`recentOrders`, `nextAppointments`, `maintenances.upcoming/overdue`, `lowStockParts`)
- [X] T063 [US6] Ampliar `client/lib/screens/dashboard/dashboard_screen.dart` con las 4 secciones de detalle (tarjetas o listas compactas con tokens del design system), estado vacío por sección y el botón «Actualizar» con recarga manual

**Checkpoint**: Historia de usuario 6 completa: el panel conecta el resumen con la acción operativa (CA-6)

---

## Fase 9: Pulido y aspectos transversales

**Propósito**: Semillas, documentación, trazabilidad y validación final del sprint

- [X] T064 [P] Ampliar `server/scripts/seed.js` (idempotente por orden, patrón del Sprint 3): sobre la orden terminada del seed registrar un pago en efectivo `PAID` y generar su ticket `TCK-…`; si la orden ya tiene pago o ticket, omitir; dejar al menos una orden terminada **sin** pago para demostrar el cobro; re-ejecutar `npm run seed` 2 veces → 0 duplicados (FR-018, R-11, CA-1/CA-4)
- [X] T065 [P] Actualizar `database/README.md` con las migraciones `012_create_payments.sql` y `013_create_tickets.sql`
- [X] T066 [P] Actualizar `docs/project-context.md` con las decisiones nuevas del Sprint 4 para la trazabilidad del Principio I: máquina de estados de pagos con único «pagado» por orden, total calculado (sin columna), Mercado Pago sandbox sin webhook (verificación por consulta), ticket con folio derivado e idempotente, panel compuesto calculado en consulta y matriz de permisos R-08
- [X] T067 [P] Actualizar el `README.md` raíz con la sección del Sprint 4 (cobro, ticket, Mercado Pago sandbox y dashboard, con sus endpoints y pantallas)
- [X] T068 [P] Actualizar `.env.example` con los placeholders `MP_ACCESS_TOKEN=` y `MP_PUBLIC_KEY=` (sin valores reales, CA-7) y verificar que `.env` sigue en `.gitignore` y que no hay credenciales en el repositorio
- [X] T069 Ejecutar el quickstart `specs/004-pagos-tickets-dashboard/quickstart.md` (V1–V7; V4 en modo «no configurado» si no hay credenciales sandbox) y registrar los resultados por escenario en `specs/004-pagos-tickets-dashboard/quickstart-resultados.md` con las comprobaciones PASS/FAIL
- [X] T070 Verificación final del sprint: `npm test` (todas las suites en verde, CA-8/SC-008), `npm run lint` (0 hallazgos), `flutter analyze` (0 problemas) y `flutter test` (en verde); corregir cualquier hallazgo
- [X] T071 Marcar CA-1 a CA-8 con su evidencia en `docs/sprints/sprint-4-pagos-tickets-dashboard.md`

---

## Dependencias y orden de ejecución

### Dependencias por fase

- **Preparación (Fase 1)**: sin dependencias — puede empezar de inmediato
- **Fundacional (Fase 2)**: depende de Preparación — BLOQUEA todas las historias
- **Historias (Fase 3+)**: todas dependen de la fase Fundacional
  - Tras Fundacional, las historias pueden avanzar en paralelo si hay capacidad
  - O en orden de prioridad: US1 → US2 → US3 → US4 → US5 → US6
- **Pulido (Fase 9)**: depende de las historias deseadas

### Dependencias entre historias

- **US1 (P1)**: empieza tras Fundacional; sin dependencias de otras historias
- **US2 (P2)**: depende de US1 (comparte `payments.service.js`, `validators/payments.js` y el formulario de pago; extiende la rama MP)
- **US3 (P3)**: depende de US1 (reutiliza `order-total.service.js` y el pago `PAID` del ticket; comparte `order_detail_screen.dart`)
- **US4 (P4)**: depende de US2 (la rama MP y `mercadopago.service.js` nacen en US2; US4 completa preferencia real, sync y cancel)
- **US5 (P5)**: sin dependencias de otras historias (backend y pantallas propias)
- **US6 (P6)**: depende de US5 (comparte `dashboard.model.js`, `dashboard.service.js` y `dashboard_screen.dart`)

### Dentro de cada historia

- Pruebas primero (deben fallar) → modelos → servicios → controladores/rutas → frontend (modelo → provider → pantallas) → rutas, rail y `main.dart`
- Historia completa antes de pasar a la siguiente prioridad

### Archivos compartidos (cuidado al paralelizar historias)

`server/utils/errors.js`, `server/routes/index.js`, `server/services/payments.service.js`, `server/validators/payments.js`, `server/controllers/payments.controller.js`, `server/routes/payments.routes.js`, `server/services/order-total.service.js`, `client/lib/screens/orders/order_detail_screen.dart`, `client/lib/screens/payments/payment_form_screen.dart`, `client/lib/providers/payments_provider.dart`, `client/lib/services/api_client.dart`, `client/lib/utils/app_route.dart`, `client/lib/widgets/app_shell.dart`, `client/lib/main.dart`, `client/pubspec.yaml`, `server/models/dashboard.model.js`, `server/services/dashboard.service.js`, `client/lib/screens/dashboard/dashboard_screen.dart`

- Si dos historias trabajan a la vez, que una persona edite cada archivo compartido; el resto de tareas [P] son seguras en paralelo

### Oportunidades de paralelización

- **Preparación**: T002 (con T001 en paralelo si se desea)
- **Fundacional**: T003 + T004 (archivos distintos) → T005
- **US1**: T006 + T007 + T008 + T009 + T010 (pruebas) ∥ T011 + T017 (modelo backend y modelo Flutter)
- **US2**: T022 + T023 (pruebas) ∥ T024 + T025
- **US3**: T029 + T030 + T031 + T032 (pruebas) ∥ T033 + T034 + T037
- **US4**: T041 + T042 + T043 (pruebas)
- **US5**: T049 + T050 + T051 (pruebas) ∥ T052 + T055
- **US6**: T059 + T060 (pruebas)
- **Entre historias**: US3 ∥ US5 (backends y pantallas independientes); US4 ∥ US5; US6 siempre después de US5
- **Pulido**: T064 + T065 + T066 + T067 + T068 (archivos distintos)

---

## Ejemplo de paralelización: Historia de usuario 1

```bash
# Lanzar juntas las pruebas de US1 (archivos distintos):
Tarea: "Prueba unitaria del total en server/tests/unit/order-total.test.js"
Tarea: "Prueba unitaria de las reglas de pago en server/tests/unit/payment-rules.test.js"
Tarea: "Prueba de integración en server/tests/integration/payments.test.js"
Tarea: "Prueba de contrato en server/tests/contract/payments.contract.test.js"
Tarea: "Prueba de widget en client/test/payment_form_test.dart"

# Lanzar juntos el modelo del backend y el modelo Flutter (sin dependencias entre sí):
Tarea: "Crear server/models/payment.model.js"
Tarea: "Crear client/lib/models/payment.dart"

# En cadena (dependencias del servicio):
Tarea: "Crear server/services/order-total.service.js"   # sin dependencias internas
Tarea: "Crear server/services/payments.service.js"      # depende del modelo y del total
Tarea: "Crear server/controllers/payments.controller.js" # depende del servicio
```

---

## Estrategia de implementación

### MVP primero (solo Historia de usuario 1)

1. Completar Fase 1: Preparación
2. Completar Fase 2: Fundacional (CRÍTICO — bloquea todas las historias)
3. Completar Fase 3: Historia de usuario 1 (cobro manual)
4. **PARAR y VALIDAR**: probar US1 de forma independiente (CA-1, SC-001)
5. Demostrar/desplegar si está listo

### Entrega incremental

1. Preparación + Fundacional → base lista
2. US1 (cobro manual) → probar → demo (**MVP**: el taller cobra)
3. US2 (4 métodos) → probar → demo (Mercado Pago «no disponible» sin credenciales)
4. US3 (ticket) → probar → demo (comprobante imprimible al cliente)
5. US4 (MP sandbox) → probar → demo (flujo digital completo)
6. US5 → US6 (panel con resumen y detalle) → probar → demo
7. Pulido → seeds, docs, quickstart y pruebas en verde

### Estrategia en equipo paralelo

1. El equipo completa Preparación + Fundacional juntos
2. Después: desarrollador A → US1 (cobro) ∥ desarrollador B → US5 (panel)
3. En cadena: US2 → US4 (mismo servicio de pagos) y US3 (tras US1); US6 tras US5
4. Todos terminan con Pulido y la validación del quickstart

---

## Notas

- Las tareas [P] usan archivos distintos y no dependen de tareas incompletas
- La etiqueta [Story] da trazabilidad requisito → historia → tarea (Principio I)
- Cada historia debe poder probarse de forma independiente en su checkpoint
- Verificar que las pruebas fallen antes de implementar (rojo → verde)
- Commits pequeños y en español tras cada tarea o grupo lógico
- Si una tarea revela un conflicto con el spec, detenerse y aclarar antes de continuar
- Base de datos: desarrollo en `motorix`, pruebas del backend contra `motorix_test`; migraciones con `database/scripts/aplicar-migraciones.ps1`
- Estado interino documentado: en US1 el validador aún no acepta `MERCADO_PAGO` (se suma en US2) y en US2 el servicio MP aún no tiene credenciales reales (la implementación completa llega en US4); el comportamiento «no disponible» es el esperado hasta entonces
- La integración de Mercado Pago se prueba siempre con el cliente **simulado**: sin red ni credenciales en CI
- Cuentas para la validación manual y el quickstart: `admin`/`Admin2026!`, `recepcion`/`Recepcion2026!`, `mecanico`/`Mecanico2026!`
- El repositorio aún no tiene git inicializado; al hacerlo, crear la rama `004-pagos-tickets-dashboard` antes de implementar
