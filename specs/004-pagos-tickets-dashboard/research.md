# Investigación — Sprint 4: Pagos, tickets y dashboard

**Fecha**: 2026-10-14
**Rama**: `004-pagos-tickets-dashboard`

Fuentes consultadas: `.specify/memory/constitution.md`, `docs/project-context.md`
(secciones 6.8 Pagos, 6.9 Mercado Pago, 6.10 Tickets, 6.11 Dashboard y las reglas
9, 13, 14 y 15 de la sección 13), `docs/design-system.md`,
`docs/sprints/sprint-4-pagos-tickets-dashboard.md` y las aclaraciones del spec
(sesión 2026-10-14: Q1 forma de pago — un único pago por el total).

Todas las incógnitas del Contexto Técnico quedan resueltas en esta fase: **0
`NEEDS CLARIFICATION` pendientes** (el stack se hereda completo de los Sprints 1–3).

## Decisiones

### R-01. Esquema del sprint: migraciones nuevas 012–013

- **Decisión**: dos scripts SQL numerados e inmutables en `database/migrations/`:
  `012_create_payments.sql` y `013_create_tickets.sql`; se aplican con
  `aplicar-migraciones.ps1` y quedan registrados en `schema_migrations`. El total
  de la orden y el contenido del ticket **no** tienen columna ni tabla propia: se
  calculan (R-03, R-05).
- **Justificación**: Principio III (scripts numerados e inmutables); el insumo del
  sprint lista exactamente `payments` y `tickets` como tablas a crear.
- **Alternativas consideradas**: una sola migración con ambas tablas (descartado:
  pierde granularidad); editar scripts de sprints anteriores (prohibido por la
  constitución).

### R-02. Pagos: máquina de estados con «pagado» único por orden (Q1)

- **Decisión**: `payments` guarda el historial de intentos de cobro de una orden.
  Estados: `PENDING | PAID | REJECTED | CANCELLED` (códigos en inglés en la API,
  etiquetas en español en la interfaz). Reglas de transición, aplicadas **solo** en
  `payments.service.js` (la API nunca acepta un estado arbitrario del cliente):
  - **Métodos manuales** (efectivo, tarjeta, transferencia): el pago se crea
    directamente como `PAID` (el dinero se recibió al registrarlo).
  - **Mercado Pago**: el pago se crea como `PENDING`; `sync` lo lleva a `PAID`
    (aprobado) o `REJECTED` (rechazado); `cancel` lleva `PENDING → CANCELLED`.
  - `PAID`, `REJECTED` y `CANCELLED` son terminales en el MVP (sin reembolsos,
    supuesto del spec).
  - Un solo pago `PAID` por orden: si existe → 400 `ORDER_ALREADY_PAID`. Si existe
    un `PENDING` activo → 409 `PENDING_PAYMENT_EXISTS` (debe cancelarse o
    sincronizarse primero); los terminales no bloquean (Q1: reintento permitido).
  - Creación y validación corren en **transacción con bloqueo de fila de la orden**
    (mismo patrón que el stock del Sprint 3): dos cobros simultáneos nunca crean
    dos pagos pagados.
  - Importe: el cuerpo envía `{ method, amount? }`; si `amount` viene y difiere del
    total → 400 `PAYMENT_AMOUNT_MISMATCH`; si no viene, se usa el total calculado
    (Q1: importe = total, sin parciales).
- **Justificación**: Q1 (2026-10-14), FR-003/FR-004/FR-005, RN-13 y el caso límite
  «pagar una orden ya pagada»; mantener la máquina de estados en el servicio la
  hace unitariamente testeable (CA-8).
- **Alternativas consideradas**: estado `PENDING` intermedio para métodos manuales
  (descartado: inventaría un cobro que ya ocurrió y exigiría un «confirmar
  recepción» extra sin valor para el taller); reembolsos desde la app (descartado:
  fuera de alcance, supuesto del spec); pagos parciales (descartados en Q1).

### R-03. Total de la orden: calculado en consulta, sin columna ni tabla derivada

- **Decisión**: `GET /api/service-orders/{id}/total` y toda validación de pago usan
  un cálculo único en el backend:
  `total = Σ(order_services.unit_price) + Σ(order_labor.hours × hourly_rate) +
  Σ(order_parts.quantity × parts.sale_price)`.
  Los importes de refacciones usan el **precio de venta vigente** de la refacción
  (RN-10: no se duplica el precio en `order_parts`).
- **Justificación**: RN-10 (sin duplicación) y CA-4 (el ticket muestra el mismo
  desglose que el cobro); un total almacenado quedaría obsoleto al editar
  servicios, mano de obra o precios.
- **Alternativas consideradas**: columna `total` en `service_orders` actualizada
  con triggers (descartada: triggers fuera del patrón y la lógica vive en el
  backend); snapshot de precios en `order_parts` al momento de uso (descartado:
  agrega una columna con historial de precios que el MVP no pide; si el equipo
  decide «precio a fecha de uso» después, será un ajuste acotado).

### R-04. Mercado Pago: sandbox con preferencia y verificación por consulta (sin webhook)

- **Decisión**: integración en modo sandbox con `MP_ACCESS_TOKEN` de prueba en
  `.env` (CA-7), aislada en `services/mercadopago.service.js` + lectura de env en
  `config/mercadopago.js`, usando el `fetch` global de Node (sin SDK, sin
  dependencias nuevas en el backend). Flujo:
  1. `POST .../payments` con `method: "MERCADO_PAGO"` crea el pago `PENDING` y una
     **preferencia** de Checkout Pro (`POST /checkout/preferences`) con
     `external_reference = paymentId`, un solo ítem «Orden de servicio #N» y el
     total; devuelve `initPoint` (URL de pago).
  2. El frontend abre `initPoint` en el navegador del equipo (`url_launcher`).
  3. El usuario paga con la cuenta/carnet de prueba de sandbox.
  4. «Verificar estado» llama a `POST .../payments/{id}/sync`, que consulta
     `GET /v1/payments/search?external_reference={paymentId}` y actualiza el pago
     (`approved → PAID`, `rejected → REJECTED`; si aún está en proceso, permanece
     `PENDING`).
  Sin credenciales configuradas el método no está disponible: alta de pago MP →
  409 `MERCADO_PAGO_NOT_CONFIGURED`; fallo del proveedor al sincronizar → 502
  `MERCADO_PAGO_ERROR` (los métodos manuales siguen operando). **No hay webhooks**
  en el MVP: un taller local no tiene URL pública alcanzable desde Mercado Pago.
  RN-14: la aplicación nunca ve ni almacena datos de tarjeta (la captura ocurre en
  el proveedor).
- **Justificación**: FR-006/FR-007, CA-3, CA-7 y 6.9 del contexto (integración
  aislada, sandbox temprano, sin datos de tarjeta); la verificación por consulta
  elimina la necesidad de exponer el backend a internet.
- **Alternativas consideradas**: webhooks (descartados: requieren URL pública y
  un servidor expuesto, inviable en el MVP local); Checkout Transparente con
  tarjeta en la app (descartado: viola RN-14); SDK oficial `mercadopago` npm
  (descartado: dependencia grande para dos llamadas resueltas con `fetch`);
  polling automático periódico (descartado: la verificación manual es
  determinista para la demo y evita procesos de fondo).

### R-05. Tickets: tabla mínima con folio derivado y contenido calculado

- **Decisión**: `tickets` guarda `id`, `order_id` (**ÚNICO**: un ticket por orden),
  `issued_by` y `created_at`; **no** guarda folio ni desglose. El folio se deriva
  del id (`TCK-000001`, sin carrera de contadores) y el contenido (taller, cliente,
  vehículo, placas, kilometraje, servicios, mano de obra, refacciones, subtotales,
  total, método y estado de pago, fecha) se **calcula al servirlo** desde las
  tablas existentes (RN-10). `POST .../ticket` es idempotente: crea (201) o devuelve
  el existente (200). Emisión solo en órdenes `FINISHED`/`DELIVERED` → 400
  `ORDER_NOT_FINISHED` en otro estado. Los datos del taller (nombre y datos de
  contacto) son constantes en `server/config/taller.js` (no existe tabla de
  ajustes en el MVP).
- **Justificación**: FR-009/FR-010/FR-011, CA-4/CA-5, RN-10 y los supuestos del
  spec (vista imprimible, sin PDF archivado); `order_id` único garantiza «sin
  duplicados» a nivel de base.
- **Alternativas consideradas**: columna `folio` con contador (descartada: carrera
  de concurrencia sin beneficio); almacenar el desglose en el ticket (descartado:
  duplica datos y se desincroniza, RN-10); PDF almacenado en disco (descartado:
  supuesto del spec lo deja como futuro; se genera en memoria al imprimir).

### R-06. Impresión del ticket: `pdf` + `printing` (dependencias nuevas justificadas)

- **Decisión**: la pantalla de ticket muestra el comprobante (visualización, CA-5)
  y el botón «Imprimir» genera el PDF **en memoria** con el paquete `pdf` y lo envía
  al diálogo de impresión del sistema con `printing` (`Printing.layoutPdf`), sin
  almacenar archivos. `url_launcher` abre el link de pago de Mercado Pago (R-04).
  Son las **3 únicas** dependencias nuevas del sprint, todas de una sola fuente
  mantenida (`pdf`/`printing` de FlutterFountain; `url_launcher` de flutter.dev).
- **Justificación**: Principio III («sin dependencias grandes sin justificar»):
  imprimir y abrir una URL externa no se resuelven con <50 líneas ni con el SDK de
  Flutter; CA-5 exige imprimir; Principio VIII (el comprobante mantiene el sistema
  de diseño en pantalla).
- **Alternativas consideradas**: imprimir con `dart:html`/plugins de plataforma a
  medida (descartado: más complejo y no portable); «imprimir» capturando la
  pantalla como imagen (descartado: pierde calidad y texto seleccionable);
  generar el PDF en el backend (descartado: el backend no habla con la impresora
  del equipo y obligaría a almacenarlo o regenerarlo).

### R-07. Matriz de permisos del Sprint 4 (R-08, evaluada en backend)

- **Decisión** (middlewares `authenticate` + `authorize` existentes):

| Recurso | ADMIN | RECEPTIONIST | MECHANIC |
|---------|-------|--------------|----------|
| Total de la orden (lectura) | sí | sí | **403** |
| Pagos de una orden: listar, registrar, sincronizar, cancelar | sí | sí | **403** |
| Ticket de una orden: generar, consultar | sí | sí | **403** |
| Dashboard (lectura) | sí | **403** | **403** |

- **Justificación**: FR-015/RN-15 (recepción opera pagos y tickets; administrador
  consulta pagos y panel; el mecánico no accede a pagos — el ticket incluye
  importes y estado de cobro, por eso también es 403) y FR-012 (panel de uso
  exclusivo del administrador).
- **Alternativas consideradas**: dar al mecánico el total de su orden (descartado:
  el spec reserva pagos/tickets a recepción y administración; evita exponer precios
  en taller); panel para recepción con solo lectura (descartado: FR-012 lo reserva
  al administrador).

### R-08. Dashboard: un solo endpoint compuesto, calculado en cada consulta

- **Decisión**: `GET /api/dashboard` (solo ADMIN) devuelve en una sola respuesta el
  resumen y el detalle, todo calculado en el momento (sin caché ni tabla
  materializada, supuesto «calculado al abrir/recargar»):
  - Conteos: vehículos atendidos (`DISTINCT vehicle_id` con órdenes
    `FINISHED|DELIVERED`), vehículos en reparación (órdenes activas:
    `RECEIVED|DIAGNOSIS|IN_REPAIR|WAITING_PART`), órdenes pendientes (mismas
    activas), órdenes terminadas (`FINISHED|DELIVERED`), citas próximas
    (`appointment_date >= hoy` y estado `PENDING|CONFIRMED`), mantenimientos
    próximos/vencidos y refacciones con stock bajo.
  - Detalle: últimas órdenes (5, con estado), próximas citas (5), mantenimientos
    próximos (5) y vencidos (todos), refacciones en stock bajo (todas).
  - Mantenimientos: se **reutilizan** `maintenance.model.js` y
    `utils/maintenance-state.js` (mismo cálculo que la lista de mantenimientos,
    sin duplicar la regla); stock bajo: se reutiliza el filtro de
    `inventory.service.js`.
- **Justificación**: FR-012/FR-013/FR-014, CA-6 (datos reales sin duplicar,
  RN-10) y SC-003/SC-007 (un solo punto de consulta garantiza consistencia entre
  contador y detalle); los índices existentes (`status`, `vehicle_id`,
  `appointment_date`, `stock_current`) sostienen el volumen del MVP.
- **Alternativas consideradas**: tabla de indicadores actualizada por eventos
  (descartada: duplica información y exige actualizarla desde todos los módulos,
  contra CA-6); varios endpoints por indicador (descartado: más round-trips y el
  frontend podría mezclar instantáneas distintas, contra SC-007); refresco
  automático (descartado: supuesto del spec lo deja fuera).

### R-09. Superficie de API y códigos de error nuevos

- **Decisión**: sobre el sobre JSON y los middlewares existentes:
  `GET /api/service-orders/{id}/total`;
  `GET/POST /api/service-orders/{id}/payments`;
  `POST /api/service-orders/{id}/payments/{paymentId}/sync`;
  `POST /api/service-orders/{id}/payments/{paymentId}/cancel`;
  `POST/GET /api/service-orders/{id}/ticket`;
  `GET /api/dashboard`.
  Códigos nuevos: `PAYMENT_NOT_FOUND` (404), `PAYMENT_AMOUNT_MISMATCH` (400),
  `ORDER_ALREADY_PAID` (409), `PENDING_PAYMENT_EXISTS` (409),
  `ORDER_NOT_PAYABLE` (400: la orden no está Terminada/Entregada),
  `INVALID_PAYMENT_TRANSITION` (409), `MERCADO_PAGO_NOT_CONFIGURED` (409),
  `MERCADO_PAGO_ERROR` (502), `TICKET_NOT_FOUND` (404),
  `ORDER_NOT_FINISHED` (400: ticket de orden no Terminada/Entregada). Reutiliza
  `SERVICE_ORDER_NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN`, `UNAUTHORIZED` e
  `INTERNAL_ERROR`.
- **Justificación**: Principio VI (rutas coherentes con el patrón
  `/api/service-orders/{id}/…` de Sprint 2 y `/api/vehicles/{id}/history` de
  Sprint 3) y trazabilidad de cada regla a un código propio para pruebas de
  contrato.
- **Alternativas consideradas**: `POST /api/payments` de nivel superior (descartado:
  un pago sin contexto de orden rompe RN-13 en la ruta y el patrón de
  subrecurso); `GET /api/tickets/{id}` (descartado: el ticket se consulta por su
  orden, evitando una ruta que expone folios adivinables).

### R-10. Formato de importes, fechas y estados en la API

- **Decisión**: importes como `DECIMAL(10,2)` en la base y cadenas con dos
  decimales en JSON (`"3150.00"`), consistente con `purchasePrice`/`salePrice` del
  Sprint 3; fechas ISO en la API (`created_at` `YYYY-MM-DDTHH:mm:ss`); métodos de
  pago como `CASH | CARD | TRANSFER | MERCADO_PAGO` y estados
  `PENDING | PAID | REJECTED | CANCELLED` (inglés en la API, español en la
  interfaz: Efectivo, Tarjeta, Transferencia, Mercado Pago; Pendiente, Pagado,
  Rechazado, Cancelado). Los estados de pago se pintan con tokens del design
  system: ámbar (Pendiente), verde (Pagado), rojo (Rechazado), gris (Cancelado).
- **Justificación**: consistencia con los Sprints 1–3 (enums en inglés, etiquetas
  en español) y Principio VIII (tokens de color existentes).
- **Alternativas consideradas**: enteros de centavos (descartado: rompe la
  consistencia con los DECIMAL del catálogo); enums en español en la API
  (descartado: los existentes están en inglés).

### R-11. Seeds del sprint: un cobro y un ticket sobre la orden terminada

- **Decisión**: ampliar `server/scripts/seed.js` (idempotente por orden, igual que
  el patrón del Sprint 3): sobre la orden terminada del seed se registra un pago
  en efectivo `PAID` y se genera su ticket; si la orden ya tiene pago o ticket, se
  omiten (re-ejecutar `npm run seed` no duplica). Queda al menos una orden
  terminada **sin** pago para demostrar el registro de cobro al arrancar.
- **Justificación**: Principio III (la app nunca arranca vacía), la restricción de
  idempotencia del insumo, FR-018 y CA-1/CA-4 (dashboard y ticket con datos desde
  el primer arranque).
- **Alternativas consideradas**: seed con pagos de los 4 métodos (descartado:
  el flujo completo de MP se demuestra en el quickstart con sandbox; el seed
  duplicaría cobros ficticios); script separado por sprint (descartado: duplicaría
  la lógica de idempotencia ya resuelta).

### R-12. Pantallas, navegación y estado: entrada «Dashboard» y flujo de cobro

- **Decisión**: se agrega al `NavigationRail` la entrada **Dashboard** (solo ADMIN,
  visibilidad filtrada en `app_shell.dart`). Pantallas nuevas:
  `screens/payments/payment_form_screen.dart` (total calculado, selector de los 4
  métodos, registrar; para MP muestra el link y «Verificar estado`),
  `screens/tickets/ticket_screen.dart` (comprobante de ancho fijo con botón
  Imprimir) y `screens/dashboard/dashboard_screen.dart` (tarjetas de indicadores +
  secciones de órdenes, citas, mantenimientos y alertas, con «Actualizar» manual);
  el detalle de orden gana la sección «Pago» (estado de cobro actual, acción
  «Registrar pago», pagos previos y «Generar/Ver ticket»). Providers
  `payments_provider.dart` y `dashboard_provider.dart`; modelos `payment.dart`,
  `ticket.dart` y `dashboard_data.dart`; rutas nuevas con el patrón
  `AppRoute`/`transicionPantalla()`; reutiliza `states_view.dart`,
  `confirm_dialog.dart` y `estado_orden_chip.dart`.
- **Justificación**: Principio VIII (mismo sistema de diseño y tokens), FR-016 y la
  navegación por rail resuelta en el Sprint 1; el cobro nace en el detalle de la
  orden porque RN-13 amarra el pago a ella.
- **Alternativas consideradas**: pantalla independiente de «Pagos» en el rail
  (descartada: no hay listado global de pagos en el spec; el contexto es la
  orden); formulario como diálogo (descartado: en MP necesita espacio para el link
  y el estado de sincronización); dashboard como pestaña de Inicio (descartado:
  crece rápido y el spec lo define como panel del administrador).

### R-13. Pruebas del Sprint 4

- **Decisión**:
  - Unit (`server/tests/unit/`): `payment-rules.test.js` (máquina de estados:
    manual → PAID, MP PENDING → PAID/REJECTED/CANCELLED, terminales, un solo
    pagado, importe = total) y `order-total.test.js` (suma de servicios, mano de
    obra y refacciones con precio vigente).
  - Integración (`server/tests/integration/`): `payments.test.js` (CA-1/CA-2,
    permisos, orden no cobrable, doble cobro, sin parciales), `payments-mp.test.js`
    (CA-3: preferencia, sync y cancelación con el cliente MP **simulado**, sin red;
    sin credenciales → `MERCADO_PAGO_NOT_CONFIGURED`), `tickets.test.js`
    (CA-4/CA-5: generación idempotente, contenido calculado, orden no terminada) y
    `dashboard.test.js` (CA-6: contadores contra datos reales, permisos ADMIN
    únicamente).
  - Contrato (`server/tests/contract/`): `payments.contract.test.js`,
    `tickets.contract.test.js` y `dashboard.contract.test.js` (sobre JSON, códigos,
    roles y formatos de importe/método/estado).
  - Frontend (`client/test/`): providers de pagos y dashboard, visibilidad del
    «Dashboard» en el rail por rol y estados del formulario de pago. Nombres y
    mensajes de aserción en español.
- **Justificación**: Principio VII (toda lógica de negocio — estados de pago,
  total, ticket, permisos — debe tener pruebas) y CA-8.
- **Alternativas consideradas**: E2E automatizado con Playwright/Cypress (descartado:
  fuera del alcance definido en el Sprint 1; la validación E2E es el quickstart);
  probar contra la API real de Mercado Pago (descartado: exige red y credenciales
  en CI; el contrato de R-04 se prueba con el cliente simulado).

## Pendientes fuera de esta fase

- Actualizar `docs/project-context.md` con las decisiones nuevas (máquina de
  estados de pagos, total calculado, MP sin webhook, ticket con folio derivado,
  dashboard compuesto) — trazabilidad del Principio I al momento de implementar.
- No hay incógnitas técnicas abiertas: **0 `NEEDS CLARIFICATION`**.
