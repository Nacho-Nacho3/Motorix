# Motorix — Sistema de Gestión para Taller Mecánico

Aplicación de escritorio para talleres mecánicos: control de clientes,
vehículos y usuarios con autenticación por roles, gestión de citas y órdenes
de servicio. Este repositorio contiene:

- **Sprint 1** (base de clientes y vehículos) según `specs/001-base-clientes-vehiculos/`.
- **Sprint 2** (citas y órdenes de servicio) según `specs/002-citas-ordenes-servicio/`.
- **Sprint 3** (historial, mantenimiento e inventario) según `specs/003-historial-mantenimiento-inventario/`.

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

Las rutas, permisos por rol y códigos de error de cada endpoint están en
`specs/002-citas-ordenes-servicio/contracts/`,
`specs/003-historial-mantenimiento-inventario/contracts/` y
`specs/004-pagos-tickets-dashboard/contracts/`.

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
- `database/README.md` — esquema, migraciones y scripts de entorno.

## Seguridad

- `.env` está en `.gitignore`: no se versionan secretos; `.env.example` solo
  trae placeholders.
- MySQL se consume con el usuario dedicado `motorix_app` (nunca `root`).
- Contraseñas solo con hash bcrypt (costo 10 en producción, 4 en pruebas).
- Los permisos se validan en backend en cada endpoint (RN-15); la interfaz
  oculta secciones que el rol no puede usar, pero eso no es seguridad.
