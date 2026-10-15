# Quickstart — Validación del Sprint 4

**Fecha**: 2026-10-14 | **Rama**: `004-pagos-tickets-dashboard`

Guía de puesta en marcha y validación de extremo a extremo del flujo completo del
MVP: orden terminada → total → pago (incluido Mercado Pago en sandbox) → ticket →
panel de control. Los detalles de contrato viven en [contracts/](contracts/) y las
tablas en [data-model.md](data-model.md).

## Requisitos previos

- Windows con PowerShell (los scripts del entorno son `.ps1`).
- MySQL 8 o superior instalado de forma **local** (nativo, no Docker).
- Node.js LTS.
- Flutter 3.47 con soporte de escritorio.
- Entorno de los Sprints 1–3 ya creado (usuario dedicado `motorix_app`, `.env`
  completo, esquema 001–011 aplicado, seeds del Sprint 3).
- (Opcional, solo para V4) Cuenta de prueba de Mercado Pago **sandbox** con un
  `MP_ACCESS_TOKEN` de prueba. Sin credenciales, V4 valida el modo «no
  disponible» y el resto del sprint opera normalmente.

## Puesta en marcha

```powershell
# 1. Esquema del Sprint 4: nuevas migraciones 012–013 (idempotentes, registro en schema_migrations)
database/scripts/aplicar-migraciones.ps1

# 2. Variables de Mercado Pago en .env (sin secretos en el repositorio, CA-7):
#    MP_ACCESS_TOKEN=TEST-...     (token de prueba sandbox; vacío = método no disponible)

# 3. Backend
cd server
npm install
npm run dev                  # debe escuchar el puerto definido en .env

# 4. Seeds con datos de ejemplo del sprint (idempotentes: correrlos 2 veces no duplica nada)
npm run seed

# 5. Frontend (escritorio Windows)
cd ../client
flutter pub get
flutter run -d windows
```

**Resultado esperado**: al iniciar sesión como `admin` aparece la entrada
**Dashboard** en el rail; la orden terminada de ejemplo ya tiene un pago en
efectivo `Pagado` y su ticket `TCK-00000X` visible desde el detalle de la orden
(SC-006).

## Comandos de prueba

```powershell
cd server
npm test                     # Jest: unit + integración + contrato (contra motorix_test)
npm run lint                 # ESLint sin hallazgos

cd ../client
flutter analyze              # sin problemas
flutter test                 # providers, formulario de pago, ticket y panel
```

> Las pruebas de integración NUNCA corren contra la base principal; solo contra
> `motorix_test` (Principio VII). La integración de Mercado Pago se prueba con el
> cliente **simulado** (sin red). Nombres y mensajes de aserción en español.

## Escenarios de validación

### V1. Esquema y seeds idempotentes (CA-1, CA-4, FR-018)

1. Ejecutar `aplicar-migraciones.ps1` → `schema_migrations` registra
   `012_create_payments` y `013_create_tickets`.
2. Volver a ejecutarla → 0 aplicadas, sin errores (scripts inmutables).
3. Correr `npm run seed` dos veces → la segunda **no crea registros**.
4. **Resultado**: la orden terminada de ejemplo tiene 1 pago `PAID` (efectivo) y
   1 ticket (`TCK-…`); existe al menos una orden terminada **sin** pago para
   demostrar el cobro; 0 duplicados.

### V2. Total y cobro en efectivo (CA-1, CA-2, US1, US2, SC-001)

1. Entrar como `recepcion` → abrir una orden `TERMINADO` sin pago → la sección
   «Pago» muestra el desglose y el total calculado.
2. Registrar pago con método **Efectivo** → el pago queda `Pagado` con importe =
   total; la sección muestra el estado verde y los pagos previos.
3. Intentar un segundo pago sobre la misma orden → error en español «ya tiene un
   pago pagado» (400 `ORDER_ALREADY_PAID`).
4. Probar los métodos **Tarjeta** y **Transferencia** sobre otra orden → ambos
   quedan `Pagado`.
5. Intentar pagar una orden en curso → rechazo «la orden debe estar terminada o
   entregada» (400 `ORDER_NOT_PAYABLE`).
6. Enviar `amount` distinto del total (por API) → 400 `PAYMENT_AMOUNT_MISMATCH`
   (Q1: sin parciales). `GET .../total` devuelve subtotales y total correctos.

### V3. Permisos de pagos (RN-15, FR-015, matriz R-08)

1. Con token de `mecanico`: `GET .../total`, `GET/POST .../payments`,
   `POST .../ticket` → 403 `FORBIDDEN` en todos.
2. Con token de `recepcion` y de `admin` → los mismos endpoints responden 200/201.
3. **Resultado**: el backend rechaza, no solo la interfaz oculta botones.

### V4. Mercado Pago en sandbox (CA-3, CA-7, US4, RN-14, SC-006)

**Sin credenciales** (`MP_ACCESS_TOKEN` vacío):

1. Registrar un pago con método **Mercado Pago** → error en español «Mercado Pago
   no está configurado» (409 `MERCADO_PAGO_NOT_CONFIGURED`); los métodos manuales
   siguen funcionando.

**Con credenciales sandbox**:

1. Registrar un pago MP sobre una orden terminada sin pago → el pago queda
   `Pendiente` y se abre el checkout de Mercado Pago en el navegador con el total
   exacto.
2. Pagar con una tarjeta de prueba de sandbox (ej. `4111 1111 1111 1111`) →
   volver a la app y pulsar «Verificar estado» → el pago pasa a `Pagado`
   (`sync` consulta al proveedor).
3. Repetir el flujo cancelando el pago en el proveedor o con tarjeta de rechazo →
   «Verificar estado» deja el pago `Rechazado`.
4. Iniciar un pago MP y abandonarlo → «Cancelar» deja el pago `Cancelado` y la
   orden acepta un nuevo intento.
5. Auditoría (RN-14): revisar `payments` → solo importe, método, estado y
   referencia del proveedor; **cero** datos de tarjeta; `MP_ACCESS_TOKEN` solo en
   `.env` (CA-7) y sin credenciales en el repositorio.
6. Intentar iniciar un segundo pago MP mientras hay uno `Pendiente` → 409
   `PENDING_PAYMENT_EXISTS`.

### V5. Ticket de servicio (CA-4, CA-5, US3, FR-011, SC-002)

1. Con `recepcion`, en una orden terminada: «Generar ticket» → se crea
   `TCK-00000X` (201) y se abre el comprobante.
2. Verificar el contenido (CA-4): folio, datos del taller, cliente, vehículo,
   placas, kilometraje de entrada, servicios, refacciones (cantidad y precio),
   mano de obra (horas × tarifa), subtotales, total, método y estado de pago,
   fecha.
3. Volver a pulsar «Generar ticket» → devuelve el **mismo** ticket y folio (200,
   sin duplicados); `order_id` ÚNICO lo garantiza a nivel de base.
4. «Imprimir» → se abre el diálogo de impresión del sistema con el comprobante;
   no queda ningún PDF almacenado.
5. Generar el ticket de una orden en curso → 400 `ORDER_NOT_FINISHED`; de una
   orden terminada **sin** pago → el ticket muestra «Sin pago».
6. `GET .../ticket` sin generar antes → 404 `TICKET_NOT_FOUND`.

### V6. Panel de control (CA-6, US5, US6, RN-10, SC-003, SC-007)

1. Entrar como `admin` → **Dashboard**: tarjetas con vehículos atendidos, en
   reparación, órdenes pendientes/terminadas, citas próximas, mantenimientos
   próximos/vencidos y stock bajo (menor de 3 segundos, SC-003).
2. Verificar consistencia (SC-007): los contadores coinciden con los listados de
   sus módulos (por ejemplo, órdenes terminadas = órdenes `FINISHED`/`DELIVERED`
   del listado de órdenes; stock bajo = refacciones con `?low=true`).
3. Entregar una orden terminada y reabrir el panel → el contador de terminadas y
   atendidos refleja el cambio (el panel deriva de los módulos, RN-10).
4. Secciones de detalle: últimas órdenes, próximas citas, mantenimientos
   próximos/vencidos y refacciones en alerta.
5. Con `recepcion` o `mecanico` → `GET /api/dashboard` responde 403 `FORBIDDEN`;
   la entrada no aparece en el rail.
6. Con la base vacía de práctica → contadores en cero y estados vacíos en español.

### V7. Batería completa del sprint (CA-8, SC-008)

1. `npm test` → todas las suites en verde, incluidas las de máquina de estados de
   pagos, total, tickets y dashboard (unit, integración y contrato).
2. `npm run lint` → 0 hallazgos.
3. `flutter analyze` → 0 problemas; `flutter test` → todo en verde.
4. **Resultado**: flujo completo demostrable de extremo a extremo en menos de 5
   minutos (SC-006): orden terminada → total → pago → MP sandbox → ticket →
   panel.
