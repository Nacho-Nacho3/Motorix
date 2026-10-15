# Quickstart — Validación del Sprint 3

**Fecha**: 2026-10-14 | **Rama**: `003-historial-mantenimiento-inventario`

Guía de puesta en marcha y validación de extremo a extremo. Los detalles de contrato
viven en [contracts/](contracts/) y las tablas en [data-model.md](data-model.md).

## Requisitos previos

- Windows con PowerShell (los scripts del entorno son `.ps1`).
- MySQL 8 o superior instalado de forma **local** (nativo, no Docker).
- Node.js LTS.
- Flutter 3.47 con soporte de escritorio.
- Entorno de los Sprints 1–2 ya creado (usuario dedicado `motorix_app`, `.env`
  completo, esquema 001–007 aplicado).

## Puesta en marcha

```powershell
# 1. Esquema del Sprint 3: nuevas migraciones 008–011 (idempotentes, registro en schema_migrations)
database/scripts/aplicar-migraciones.ps1

# 2. Backend
cd server
npm install
npm run dev                  # debe escuchar el puerto definido en .env

# 3. Seeds con datos de ejemplo del sprint (idempotentes: correrlos 2 veces no duplica nada)
npm run seed

# 4. Frontend (escritorio Windows)
cd ../client
flutter pub get
flutter run -d windows
```

**Resultado esperado**: al iniciar sesión aparecen las nuevas secciones **Historial**
(ADMIN/MECHANIC), **Mantenimientos** (los 3 roles) e **Inventario** (solo ADMIN) en
el rail, con refacciones, mantenimientos y al menos una orden terminada de ejemplo
(SC-009).

## Comandos de prueba

```powershell
cd server
npm test                     # Jest: unit + integración + contrato (contra motorix_test)
npm run lint                 # ESLint sin hallazgos

cd ../client
flutter analyze              # sin problemas
flutter test                 # providers, roles y filtros
```

> Las pruebas de integración NUNCA corren contra la base principal; solo contra
> `motorix_test` (Principio VII). Nombres y mensajes de aserción en español.

## Escenarios de validación

### V1. Esquema y seeds idempotentes (SC-009, CA-4, CA-8)

1. Ejecutar `aplicar-migraciones.ps1` → `schema_migrations` registra
   `008_create_maintenance`, `009_create_parts`, `010_create_inventory_movements`
   y `011_create_order_parts`.
2. Volver a ejecutarla → 0 aplicadas, sin errores (scripts inmutables).
3. Correr `npm run seed` dos veces → la segunda **no crea registros**.
4. **Resultado**: hay al menos 6 refacciones (una con stock ≤ mínimo), movimientos
   `IN` iniciales, al menos 1 mantenimiento Vencido o Próximo y 1 orden terminada;
   0 duplicados; la app nunca arranca vacía.

### V2. Historial de un vehículo (CA-1, US1, US2, RN-10, SC-001)

1. Entrar como `mecanico` → Historial → elegir el vehículo con órdenes terminadas
   de ejemplo.
2. **Resultado**: aparecen las órdenes `TERMINADO`/`ENTREGADO` en orden cronológico
   con fecha, kilometraje, diagnóstico, servicios, mano de obra, refacciones,
   observaciones y recomendaciones (CA-1).
3. Verificar que las órdenes en curso **no** aparecen y que un vehículo sin
   servicios terminados muestra estado vacío con mensaje en español.
4. `GET /api/vehicles/{id}/history` con token de `recepcion` → 403 `FORBIDDEN`;
   con vehículo inexistente → 404 `VEHICLE_NOT_FOUND`.
5. Comparar una entrada con su orden original (`GET /api/service-orders/{id}`):
   los datos coinciden y no existe ninguna tabla de historial (RN-10).

### V3. Registrar el próximo mantenimiento (CA-2, US3, RN-11, RN-12, SC-002)

1. Entrar como `mecanico` → Mantenimientos → Nuevo mantenimiento: vehículo, fecha
   objetivo y/o kilometraje objetivo, antelación y recomendaciones → Guardar.
2. **Resultado**: 201, el registro aparece en la lista con su estado calculado
   (CA-2); reabrir la pantalla conserva los datos.
3. Intentar guardar sin fecha ni kilometraje → 400 `MAINTENANCE_TARGET_REQUIRED` y
   lo capturado no se pierde en la interfaz.
4. Registrar **otro** mantenimiento para el mismo vehículo → reemplaza al anterior
   (la lista sigue mostrando 1 registro por vehículo, sin duplicados).
5. **SC-002**: el registro completo toma menos de 2 minutos.

### V4. Mantenimientos próximos y vencidos (CA-3, US4, SC-003)

1. Entrar como `recepcion` → Mantenimientos → **Resultado**: ve la lista ordenada
   con Vencido primero, luego Próximo y Normal, con vehículo, cliente, objetivo y
   sus estados (CA-3).
2. Verificar los 3 estados con los datos de ejemplo: uno con fecha pasada o
   kilometraje superado → **Vencido**; uno dentro de su antelación → **Próximo**;
   el resto → **Normal** (Q4).
3. Filtrar por estado `OVERDUE` en `GET /api/maintenances?state=OVERDUE` → solo
   vencidos; `?state=XX` → 400 `VALIDATION_ERROR`.
4. `POST /api/maintenances` con token de `recepcion` → 403 `FORBIDDEN` (solo
   consulta).

### V5. Catálogo de refacciones y stock (CA-4, US5, US6, SC-004)

1. Entrar como `admin` → Inventario → Nueva refacción: código, nombre, categoría,
   stock inicial y stock mínimo → Guardar → 201 y aparece en la lista.
2. Intentar registrar otra con el **mismo código** → 400 `PART_CODE_DUPLICATED`,
   sin registro nuevo.
3. Verificar en MySQL que el registro creó su movimiento `IN` inicial y que el
   saldo coincide con `GET /api/parts` (CA-4 contra la base local).
4. Editar precios y stock mínimo → 200; el cambio persiste tras reiniciar.
5. Como `recepcion` o `mecanico`, `GET /api/parts` → 403 `FORBIDDEN`.

### V6. Agregar refacciones a una orden con salida de inventario (CA-5, US7, RN-6, RN-7, SC-005)

1. Entrar como `mecanico` → Órdenes → abrir una orden asignada **no entregada** →
   Refacciones → elegir pieza y cantidad → Guardar.
2. **Resultado**: 201, la refacción aparece en la orden y su stock baja en
   Inventario; `GET /api/parts/{id}/movements` muestra un `OUT` con `orderId` de
   esa orden (CA-5, RN-7).
3. Intentar con `quantity` mayor al stock → 400 `STOCK_INSUFFICIENT`; verificar que
   **no** se creó fila, **no** hubo movimiento y el saldo no cambió.
4. Intentar con una orden **ajena** → 403 `FORBIDDEN`; con una orden
   `ENTREGADA` → 400 `ORDER_DELIVERED` (Q5, RN-9).
5. Como `recepcion` o `admin`, `POST /api/service-orders/{id}/parts` → 403
   (solo el mecánico agrega usos, Q5).

### V7. Stock negativo rechazado y alertas de stock bajo (CA-6, CA-7, US8, RN-8, Q1, SC-006, SC-007)

1. Como `admin`, `POST /api/parts/{id}/movements` con `ADJUSTMENT` que dejaría el
   saldo en negativo → 400 `STOCK_INSUFFICIENT` y el stock **no cambia** (Q1).
2. Repetir con un ajuste válido (motivo ≥ 10 caracteres) → 201 y el saldo cambia
   exactamente en la cantidad del ajuste; sin motivo → 400 `VALIDATION_ERROR`.
3. Intentar un `OUT` manual → 400 `VALIDATION_ERROR` (las salidas solo son
   automáticas, Q2).
4. En Inventario, activar el filtro «Stock bajo» → se listan solo las refacciones
   con `stock ≤ stock mínimo` (la de ejemplo incluida); quitar una de ellas del
   filtro subiendo su stock → desaparece de las alertas (CA-7).
5. `GET /api/parts?low=true` → coincide con `lowStockCount` de la lista completa
   (SC-007: 100 % de las refacciones bajo mínimo visibles).

### V8. Permisos por rol en backend (RN-15, R-07, SC-008)

Con tokens de `recepcion` y `mecanico`, comprobar en API (no solo en la interfaz):

1. `recepcion` → 403 en: `GET /api/vehicles/{id}/history`, `GET /api/parts`,
   `POST /api/parts`, `POST /api/parts/{id}/movements`, `POST /api/maintenances`.
2. `mecanico` → 403 en: `GET /api/parts`, `POST /api/parts`,
   `POST /api/parts/{id}/movements`; y 403 en `GET .../parts` de una orden ajena.
3. `admin` → 403 en `POST /api/service-orders/{id}/parts` (Q5: solo mecánico).
4. Sin token → 401 `UNAUTHORIZED` en todos los endpoints nuevos.
5. **Resultado**: 0 accesos no autorizados aceptados (SC-008).

### V9. Flujo demostrable de extremo a extremo en la interfaz (SC-001, SC-002, SC-003)

1. Como `mecanico`: abrir el historial de un vehículo → verificar el servicio
   terminado más reciente → registrar su próximo mantenimiento con fecha y
   kilometraje.
2. Agregarle una refacción a una orden en curso → el stock baja en Inventario.
3. Como `admin`: confirmar en Inventario que la refacción quedó con saldo menor y,
   si pasó de su mínimo, verla en «Stock bajo».
4. Como `recepcion`: abrir Mantenimientos → ver el mantenimiento recién creado con
   su estado y datos del cliente para avisarlo.
5. **Resultado**: el flujo del sprint (finalizar servicio → historial → próximo
   mantenimiento → refacciones en la orden → inventario → alertas) funciona de
   extremo a extremo en menos de 5 minutos.

### V10. Interfaz, instalación repetible y pruebas (CA-8, SC-009, FR-018, FR-019)

1. Recorrer las pantallas nuevas: estados vacío, cargando, error y éxito en
   español; tokens del design system (ámbar en Próximo, rojo en Vencido y stock
   bajo, verde en Normal); confirmaciones donde apliquen; sin valores de color o
   tipografía sueltos.
2. `flutter analyze` sin problemas; `flutter test` en verde.
3. `npm run lint` sin hallazgos; `npm test` en verde: unit
   (`maintenance-state`, `inventory-stock`), integración (`vehicle-history`,
   `maintenances`, `parts-inventory`, `order-parts`) y contrato (3 archivos) —
   CA-8.
4. Instalación desde cero en una base desechable: migraciones 001→011 + seed ×2 →
   sin duplicados y con datos visibles (SC-009).
5. **Resultado**: el sprint queda demostrable con pruebas automatizadas en verde.

## Mapa de criterios de aceptación

| CA | Descripción | Escenario(s) |
|----|-------------|--------------|
| CA-1 | Historial con órdenes terminadas en orden cronológico | V2 |
| CA-2 | Registrar próximo mantenimiento por fecha y/o kilometraje | V3 |
| CA-3 | Consulta de mantenimientos próximos y vencidos | V4 |
| CA-4 | Registrar refacciones y consultar stock contra MySQL local | V1, V5 |
| CA-5 | Agregar refacción a una orden genera salida de inventario | V6 |
| CA-6 | El sistema impide stock negativo | V7 |
| CA-7 | Alertas de stock bajo visibles en la interfaz | V7 |
| CA-8 | Pruebas de inventario y mantenimiento existen y pasan | V1, V10 |

| SC | Escenario(s) | SC | Escenario(s) |
|----|--------------|----|--------------|
| SC-001 | V2, V9 | SC-006 | V7, V10 |
| SC-002 | V3 | SC-007 | V7 |
| SC-003 | V4 | SC-008 | V8 |
| SC-004 | V5 | SC-009 | V1, V10 |
| SC-005 | V6 | | |
