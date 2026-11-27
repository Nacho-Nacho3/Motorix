# Motorix — Sistema de Gestión para Taller Mecánico

Aplicación de escritorio para talleres mecánicos: control de clientes,
vehículos y usuarios con autenticación por roles, gestión de citas y órdenes
de servicio. Este repositorio contiene:

- **Sprint 1** (base de clientes y vehículos) según `specs/001-base-clientes-vehiculos/`.
- **Sprint 2** (citas y órdenes de servicio) según `specs/002-citas-ordenes-servicio/`.
- **Sprint 3** (historial, mantenimiento e inventario) según `specs/003-historial-mantenimiento-inventario/`.
- **Sprint 4** (pagos, tickets y panel de control) según `specs/004-pagos-tickets-dashboard/`.
- **Sprint 5** (precios de refacciones y cobro completo) según `specs/005-precios-refacciones-cobro/`.
- **Sprint 6** (notificaciones internas) según `specs/006-notificaciones-internas/`.
- **Sprint 7** (reportes, configuración, términos y seguridad) según `specs/007-reportes-configuracion/`.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Node.js + Express 5 (ESM), `mysql2`, `zod`, JWT (`jsonwebtoken`), `bcryptjs` |
| Frontend | Flutter + Material 3, `provider`, `google_fonts` (IBM Plex Sans), `data_table_2`, `http` |
| Base de datos | MySQL local (InnoDB, `utf8mb4`), migraciones SQL inmutables |
| Pruebas | Jest + supertest (backend), `flutter test` (frontend) |

## Estructura

```
motorix/
├── client/       # Aplicación Flutter (lib/, test/)
├── database/     # Migraciones SQL y scripts de entorno (.ps1)
├── docs/         # project-context.md, design-system.md, reglas.md
├── server/       # API Express (config/, models/, services/, routes/, …)
└── specs/        # Spec Kit: spec, plan, tasks, contratos, quickstart
```

## Módulos y pantallas

### Sprint 1 — base

| Módulo | Pantallas (`client/lib/screens/`) | Backend |
|--------|-----------------------------------|---------|
| Clientes | `clients/` — lista con búsqueda, alta, edición y detalle con vehículos | `GET/POST/PUT/PATCH /api/clients` |
| Vehículos | `vehicles/` — lista con filtros y formulario (placas/VIN únicos, kilometraje VV-01…VV-05) | `/api/vehicles` |
| Usuarios | `users/` — lista y formulario por roles (ADMIN, RECEPTIONIST, MECHANIC) | `/api/users` |

### Sprint 2 — citas y órdenes de servicio

| Módulo | Pantallas | Backend |
|--------|-----------|---------|
| Citas | `appointments/` — lista con búsqueda por cliente o placas, filtro por estado y píldora de estado; formulario con selector cliente/vehículo; cancelación con confirmación | `/api/appointments` — estados `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED` y `CANCELED` |
| Órdenes de servicio | `orders/` — lista con filtros («Solo mis órdenes» para el mecánico, chip de vehículo al abrir desde vehículos), formulario con asignación manual de mecánico y detalle con cambiar estado, diagnóstico, observaciones/recomendaciones, servicios y mano de obra en línea | `/api/service-orders` — estados `RECEIVED → DIAGNOSIS → IN_REPAIR → FINISHED → DELIVERED` más `WAITING_PART` con `waiting_origin` |
| Navegación | `widgets/app_shell.dart` — secciones visibles según el rol del token | — |

### Sprint 3 — historial, mantenimiento e inventario

| Módulo | Pantallas | Backend |
|--------|-----------|---------|
| Historial del vehículo | `history/vehicle_history_screen.dart` — resumen con totales y costos calculados en consulta (US1) | `GET /api/vehicles/{id}/history` |
| Mantenimiento preventivo | `maintenances/` — lista con chips de estado (Todos, Normales, Próximos, Vencidos) y formulario con antelación `warn_days`/`warn_km` | `/api/maintenances` — estados `NORMAL`/`UPCOMING`/`OVERDUE` derivados en consulta |
| Inventario de refacciones | `inventory/` — lista con contador y chip «Stock bajo», búsqueda, estados de stock y formulario; movimientos `IN`/`ADJUSTMENT` | `/api/parts` y `/api/parts/{id}/movements` (escrituras solo ADMIN) |
| Refacciones de la orden | `orders/order_detail_screen.dart` — sección «Refacciones» con selector y alta inline (solo el mecánico de la orden, nunca `DELIVERED`) | `GET/POST /api/service-orders/{id}/parts` |

### Sprint 4 — pagos, tickets y panel de control

| Módulo | Pantallas | Backend |
|--------|-----------|---------|
| Cobro de la orden | `payments/payment_form_screen.dart` — total calculado precargado, métodos Efectivo/Tarjeta/Transferencia/Mercado Pago, historial y estados en píldora; sección «Pago» en `orders/order_detail_screen.dart` | `GET/POST /api/service-orders/{id}/total` y `.../payments` — un único pago `PAID` y uno `PENDING` por orden, importe = total (VN-03…VN-05) |
| Mercado Pago (sandbox) | la misma pantalla de cobro: pago `Pendiente` con «Abrir en el navegador», «Verificar estado» y «Cancelar pago» con confirmación; la app nunca ve datos de tarjeta (RN-14) | `POST .../payments/{paymentId}/sync` (consulta al proveedor, sin webhooks) y `.../cancel`; sin credenciales → 409 `MERCADO_PAGO_NOT_CONFIGURED` |
| Ticket de servicio | `tickets/ticket_screen.dart` — comprobante PDF en memoria con «Imprimir» (nada almacenado); botón «Generar/Ver ticket» en el detalle | `POST/GET /api/service-orders/{id}/ticket` — folio `TCK-{id:06d}` derivado y `order_id` ÚNICO (idempotente: repetir devuelve el mismo) |
| Panel de control | `dashboard/dashboard_screen.dart` — 8 tarjetas de indicadores y las secciones «Últimas órdenes», «Próximas citas», «Mantenimientos» y «Alertas de inventario», con botón «Actualizar» | `GET /api/dashboard` (solo ADMIN) — resumen y detalle calculados en la misma consulta (RN-10) |

### Sprint 5 — precios de refacciones y cobro completo

| Módulo | Pantallas | Backend |
|--------|-----------|---------|
| Precios de refacciones | `inventory/` — categoría, marca y precios de compra y de venta en el formulario; la advertencia de venta menor a compra | `/api/parts` — el precio de compra solo lo ve el ADMIN; el mecánico usa `GET /api/parts/lookup`, sin precios |
| Total y cobro | `orders/order_detail_screen.dart` y `payments/` — el total suma servicios, mano de obra y refacciones | Cada línea de la orden guarda su precio de venta; un cambio de precio no altera órdenes abiertas ni pagos y tickets emitidos |
| Corrección administrativa | `orders/order_detail_screen.dart` — corrección del precio de una línea de refacción | `PATCH /api/service-orders/{id}/parts/{partRowId}/price` |

### Sprint 6 — notificaciones internas

| Módulo | Pantallas | Backend |
|--------|-----------|---------|
| Centro de avisos | campana con contador en el encabezado (`widgets/app_shell.dart`) y panel agrupado en `notifications/notifications_panel.dart`: mantenimientos, citas de hoy, stock y órdenes detenidas | `GET /api/notifications` (calculado en cada consulta, sin caché) y `POST /api/notifications/read` (lectura por usuario) |
| Clientes por avisar | `clients/client_notice_screen.dart` — sección «Por avisar» (ADMIN y recepción) con «Ya lo hablé» y nota opcional | `GET/POST /api/client-notices` — el registro es idempotente: primera vez 201, repetir 200 |

Los avisos se filtran por rol en el backend: el administrador recibe todos
los grupos, recepción todos menos stock y el mecánico solo las órdenes
detenidas de sus órdenes. El sistema **no envía mensajes** a los clientes.

### Sprint 7 — reportes, configuración, términos y seguridad

| Módulo | Pantallas | Backend |
|--------|-----------|---------|
| Configuración (solo ADMIN) | `settings/settings_screen.dart` — datos del taller, márgenes de «Próximo», catálogo de tipos de servicio y términos, con «Cambios sin guardar» y «Restablecer» | `GET/PATCH /api/settings` — valores de respaldo en código; el ticket congela los datos del taller al emitirse |
| Tipos de servicio | sección en Configuración y selector opcional en el servicio de la orden (`orders/order_detail_screen.dart`) | `GET/POST/PATCH /api/service-types` y `GET /lookup` — sin borrado, se desactiva |
| Próximo servicio | línea «Próximo servicio» en el ticket (pantalla y PDF) y propuesta editable en el formulario de mantenimiento | `nextService` guardado al emitir el ticket y `GET /api/maintenances/suggestion` |
| Reportes (solo ADMIN) | `reports/reports_screen.dart` — periodo (hoy, semana, mes y rango libre de hasta 366 días), pestañas Ingresos, Servicios, Productividad, Margen de refacciones y Rotación, y «Exportar CSV» | `GET /api/reports/{income,services,productivity,parts-margin,inventory-rotation}` con `?format=csv`; calculados en cada consulta, importes en centavos |
| Términos y condiciones | `terms/terms_acceptance_screen.dart` (pantalla completa tras iniciar sesión o a mitad de la sesión) y sección en Configuración para publicar versiones | `GET /api/terms/current`, `POST /accept`, `POST /` y `GET /acceptances`; bloqueo `403 TERMS_NOT_ACCEPTED` en todas las rutas salvo cuatro |
| Seguridad | `audit/audit_log_screen.dart` — Bitácora con filtros; cierre de sesión por inactividad (30 minutos) | `GET /api/audit-log` (solo lectura), contraseñas de 8 a 64 caracteres y `401 SESSION_IDLE` |

La migración `016_settings_reports_security.sql` es aditiva (5 tablas y 12
columnas). Los datos del taller y los márgenes ya **no** se configuran por
variables de entorno: viven en la aplicación.

Las rutas, permisos por rol y códigos de error de cada endpoint están en
`specs/002-citas-ordenes-servicio/contracts/`,
`specs/003-historial-mantenimiento-inventario/contracts/`,
`specs/004-pagos-tickets-dashboard/contracts/`,
`specs/005-precios-refacciones-cobro/contracts/` y
`specs/006-notificaciones-internas/contracts/` y
`specs/007-reportes-configuracion/contracts/`.

## Requisitos

- Node.js 20 o superior (probado con 25)
- Flutter 3.47 o superior
- MySQL 8 o superior (probado con 9.6), con permisos para crear bases y usuarios

## Puesta en marcha

### 1. Base de datos

```powershell
database/scripts/crear-entorno.ps1        # bases motorix + motorix_test y usuario motorix_app
database/scripts/aplicar-migraciones.ps1  # aplica database/migrations/ (idempotente)
```

### 2. Configuración

```powershell
Copy-Item .env.example .env   # completar credenciales; .env NUNCA se versiona
# Opcional (Mercado Pago sandbox): MP_ACCESS_TOKEN=TEST-... y MP_PUBLIC_KEY=...
# Sin ellos, el método Mercado Pago responde «no disponible» y el resto opera igual.
```

### 3. Datos iniciales

```powershell
cd server
npm install
npm run seed      # idempotente: cuentas, clientes, vehículos, citas, órdenes,
                  # refacciones, mantenimientos, un pago PAID con su ticket y
                  # una orden terminada sin pago para probar el cobro
```

### 4. Backend

```powershell
cd server
npm start         # http://localhost:3000/api
npm run dev       # con recarga automática
```

### 5. Frontend

```powershell
cd client
flutter pub get
flutter run -d windows
```

## Credenciales del MVP (solo pruebas locales)

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `Admin2026!` | ADMIN |
| `recepcion` | `Recepcion2026!` | RECEPTIONIST |
| `mecanico` | `Mecanico2026!` | MECHANIC |

El inicio de sesión acepta **usuario o correo** en el mismo campo
(`*@motorix.local`). El administrador también puede crearse con
`npm run create-admin`.

## Despliegue (TiDB Cloud y Render)

| Pieza | Dónde |
|-------|-------|
| Base de datos | TiDB Cloud (compatible con MySQL), ver `database/README.md` |
| API y versión web | Un servicio Node en Render: instalar con `cd server && npm ci --omit=dev` e iniciar con `cd server && node app.js` |

Variables del servicio: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`, `DB_SSL=true`, `DB_TIME_ZONE=-06:00`, `TZ=America/Mexico_City` y
`JWT_SECRET`. La versión web se compila antes de subir el código con
`bash client/tool/publicar_web.sh`.

## Pruebas

```powershell
# Backend (lint + suites contra motorix_test)
cd server
npm run lint
npm test

# Frontend
cd client
flutter analyze
flutter test
```

Las pruebas del backend usan **siempre** `motorix_test` con el usuario dedicado
`motorix_app`; nunca tocan la base principal ni `root`.

## Documentación

- `docs/project-context.md` — contexto maestro del proyecto (entidades, sprints, decisiones).
- `docs/design-system.md` — sistema de diseño de la interfaz (tokens, movimiento, componentes).
- `docs/reglas.md` — reglas de trabajo del repositorio.
- `specs/001-base-clientes-vehiculos/` — especificación del Sprint 1: `spec.md`, `plan.md`, `tasks.md`, `contracts/`, `quickstart.md`.
- `specs/002-citas-ordenes-servicio/` — especificación del Sprint 2: `spec.md`, `plan.md`, `tasks.md`, `contracts/`, `quickstart.md`.
- `specs/003-historial-mantenimiento-inventario/` — especificación del Sprint 3: `spec.md`, `plan.md`, `tasks.md`, `contracts/`, `quickstart.md`.
- `specs/004-pagos-tickets-dashboard/`, `specs/005-precios-refacciones-cobro/` y `specs/006-notificaciones-internas/` — especificación de los sprints 4, 5 y 6 con la misma estructura.
- `docs/sprints/` — insumo de cada sprint y la propuesta de los posteriores al MVP.
- `docs/aseguramiento-calidad-sprint-5.md`, `docs/aseguramiento-calidad-sprint-6.md` y `docs/aseguramiento-calidad-sprint-7.md` — documentos de calidad de los sprints 5, 6 y 7.
- `database/README.md` — esquema, migraciones y scripts de entorno.

## Seguridad

- `.env` está en `.gitignore`: no se versionan secretos; `.env.example` solo
  trae placeholders.
- MySQL se consume con el usuario dedicado `motorix_app` (nunca `root`).
- Contraseñas solo con hash bcrypt (costo 10 en producción, 4 en pruebas).
- Los permisos se validan en backend en cada endpoint (RN-15); la interfaz
  oculta secciones que el rol no puede usar, pero eso no es seguridad.
