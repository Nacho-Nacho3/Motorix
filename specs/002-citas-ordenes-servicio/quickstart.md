# Quickstart — Validación del Sprint 2

**Fecha**: 2026-10-14 | **Rama**: `002-citas-ordenes-servicio`

Guía de puesta en marcha y validación de extremo a extremo. Los detalles de contrato
viven en [contracts/](contracts/) y las tablas en [data-model.md](data-model.md).

## Requisitos previos

- Windows con PowerShell (los scripts del entorno son `.ps1`).
- MySQL 8 o superior instalado de forma **local** (nativo, no Docker).
- Node.js LTS.
- Flutter 3.47 con soporte de escritorio.
- Entorno del Sprint 1 ya creado (usuario dedicado `motorix_app`, `.env` completo).

## Puesta en marcha

```powershell
# 1. Esquema del Sprint 2: nuevas migraciones 004–007 (idempotentes, registro en schema_migrations)
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

**Resultado esperado**: al iniciar sesión aparecen las nuevas secciones **Citas**
(ADMIN/RECEPTIONIST) y **Órdenes** (los 3 roles) en el rail, con citas y órdenes de
ejemplo ya cargadas (SC-007).

## Comandos de prueba

```powershell
cd server
npm test                     # Jest: unit + integración + contrato (contra motorix_test)
npm run lint                 # ESLint sin hallazgos

cd ../client
flutter analyze              # sin problemas
flutter test                 # providers y widgets
```

> Las pruebas de integración NUNCA corren contra la base principal; solo contra
> `motorix_test` (Principio VII). Nombres y mensajes de aserción en español.

## Escenarios de validación

### V1. Esquema y seeds idempotentes (SC-007, CA-8)

1. Ejecutar `aplicar-migraciones.ps1` → `schema_migrations` registra
   `004_create_appointments`, `005_create_service_orders`,
   `006_create_order_services` y `007_create_order_labor`.
2. Volver a ejecutarla → 0 aplicadas, sin errores (scripts inmutables).
3. Correr `npm run seed` dos veces → la segunda **no crea registros**.
4. **Resultado**: hay al menos 1 cita, 1 orden con servicios y mano de obra de
   ejemplo, y 0 duplicados; la app nunca arranca vacía.

### V2. Registrar, consultar y modificar citas (CA-1, FR-001–FR-003, US1)

1. Entrar como `recepcion` → Citas → Nueva cita: cliente, vehículo, fecha, hora y
   motivo → Guardar → 201, estado **Pendiente** y aparece en la lista.
2. Reabrir la cita y cambiar la hora → 200; el cambio persiste tras reiniciar.
3. Filtrar por fecha y buscar por cliente → la cita se encuentra (SC-002: registro
   completo en menos de 2 minutos).
4. Intentar una cita cuyo vehículo **no** pertenezca al cliente → 400
   `VEHICLE_CLIENT_MISMATCH`; con datos vacíos → 400 `VALIDATION_ERROR` y no se
   guarda nada.
5. **Resultado**: el ciclo de la cita funciona de extremo a extremo (CA-1).

### V3. Cancelación de citas (FR-004, Q3)

1. Cancelar una cita con confirmación («Confirmar» en el diálogo) → estado
   **Cancelada**; sigue visible en la consulta (no se borra).
2. Cancelar una cita ya **Completada** → 400 `APPOINTMENT_CLOSED` (la cita
   cerrada es historial inmutable, VA-05).
3. Intentar reactivar una cancelada → 400 `INVALID_STATUS_TRANSITION` o
   `APPOINTMENT_CLOSED`.
4. Cancelar una cita existente → las órdenes de servicio **no cambian** (no hay
   vínculo cita↔orden, Q3).
5. Entrar como `mecanico` → la sección Citas no existe y un GET directo a
   `/api/appointments` responde 403.
6. **Resultado**: la cancelación respeta estados, conserva historial y no toca
   órdenes.

### V4. Creación de órdenes con cliente, vehículo y kilometraje (CA-2, CA-6, US2, US3, RN-2, RN-3, RN-4)

1. Como `recepcion` → Órdenes → Nueva orden: cliente, vehículo, mecánico asignado,
   kilometraje de entrada y problema reportado → 201, estado **RECIBIDO**.
2. Intentar con un vehículo inexistente → 404 `VEHICLE_NOT_FOUND` (RN-2) y no se
   crea registro; sin vehículo → 400 `VEHICLE_REQUIRED`.
3. Asignar a un usuario que **no** es mecánico → 400 `INVALID_MECHANIC`.
4. Capturar un kilometraje **menor** al del vehículo → 400
   `MILEAGE_LOWER_THAN_PREVIOUS` (RN-4, CA-6); repetir como `admin` con motivo de
   corrección → 201 y el motivo queda guardado.
5. Tras crearla, el kilometraje del vehículo queda actualizado: crear una segunda
   orden con el kilometraje anterior → rechazada.
6. **Resultado**: toda orden nueva cumple RN-2, RN-3 y RN-4 (SC-006).

### V5. El mecánico solo ve sus órdenes (CA-3, US4, SC-004)

1. Entrar como `mecanico` → Órdenes → el listado muestra **solo** las suyas.
2. Si no tiene ninguna → estado vacío con mensaje en español.
3. Un GET directo a una orden **ajena** responde 403 `FORBIDDEN` (no 404 ni 200).
4. Como `admin` o `recepcion` → se ven todas, con filtro por estado.
5. **Resultado**: 0 órdenes ajenas visibles para el mecánico en cualquier vista.

### V6. Diagnóstico, servicios, mano de obra y recomendaciones (CA-4, US5, US7)

1. Como `mecanico`, abrir una orden suya → registrar diagnóstico → 200; reabrir →
   persiste.
2. Agregar 2 servicios con descripción y precio, y 1 concepto de mano de obra con
   horas y tarifa → 201 cada uno y aparecen en la orden.
3. Borrar un servicio erróneo → diálogo de confirmación → 200.
4. Dejar un campo obligatorio vacío → 400 con validación en español y lo capturado
   no se pierde.
5. Guardar observaciones y recomendaciones → 200 y visibles al reabrir.
6. Como `recepcion`, intentar registrar diagnóstico → 403.
7. **Resultado**: el trabajo del mecánico queda documentado y solo él (y ADMIN) lo
   puede escribir.

### V7. Transiciones de estado de la orden (CA-5, CA-8, US6)

1. Recorrer la secuencia: RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO →
   ENTREGADO → 200 en cada paso.
2. Intentar un salto (RECIBIDO → ENTREGADO) o un retroceso → 400
   `INVALID_STATUS_TRANSITION` con mensaje en español.
3. De EN_REPARACION a ESPERANDO_REFACCION y después «continuar» → regresa a
   EN_REPARACION (a DIAGNOSTICO si se salió desde ahí).
4. Como `recepcion`, cambiar estado → 403; como `mecanico` de orden ajena → 403.
5. Una vez ENTREGADO → sin salidas; la orden sigue consultable (RN-9) y no existe
   endpoint de borrado.
6. **Resultado**: `npm test` incluye `order-transitions.test.js` con todas las
   transiciones permitidas y rechazadas, y pasa (CA-8).

### V8. Permisos por rol en backend (CA-7, FR-017, SC-005)

Verificar con llamadas **directas a la API** (sin pasar por la interfaz), por ejemplo
desde PowerShell:

```powershell
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login `
  -ContentType 'application/json' -Body '{"identifier":"mecanico","password":"..."}').data.token
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri http://localhost:3000/api/appointments -Headers $headers  # se espera 403
```

1. `mecanico` → `/api/appointments` (lectura) → 403.
2. `mecanico` → `POST /api/service-orders` → 403.
3. `recepcion` → `PATCH /api/service-orders/{id}/status` → 403.
4. `mecanico` → `PATCH /api/service-orders/{id}/status` de orden **ajena** → 403.
5. Sin token → 401 `UNAUTHORIZED`.
6. **Resultado**: toda operación sin permiso se rechaza aunque no pase por la
   interfaz (SC-005).

### V9. Flujo demostrable de extremo a extremo en la interfaz (SC-001, SC-002)

1. Como `recepcion`: registrar cita (< 2 min) → verla en la agenda.
2. Crear la orden con cliente, vehículo, kilometraje y mecánico → asignar
   (reasignar) si hace falta.
3. Como `mecanico`: ver la orden en su listado → diagnóstico → servicios → mano de
   obra → estados hasta TERMINADO → observaciones.
4. Como `recepcion`/`admin`: recibir el vehículo (ENTREGADO) y marcar la cita
   relacionada (solo visual, sin vínculo).
5. **Resultado**: el flujo completo (registrar cita → recibir vehículo → crear
   orden → asignar → diagnosticar → servicios → estados → terminar) se completa en
   **menos de 5 minutos** (SC-001).

### V10. Interfaz, instalación repetible y pruebas (FR-019, SC-003, SC-007)

1. Pantallas nuevas con tokens de `docs/design-system.md` (sin valores sueltos),
   estados vacío/cargando/error/éxito en español y transiciones suaves; salir de un
   formulario con cambios pide confirmación («Confirmar»/«Cancelar»).
2. Borrar la base, re-ejecutar `aplicar-migraciones.ps1` y `npm run seed` dos veces
   → todo aplica sin errores y sin duplicados.
3. `npm test`, `npm run lint`, `flutter analyze` y `flutter test` → todo en verde.
4. Revisar que `.env` no está versionado y `.env.example` no contiene secretos.
5. **Resultado**: pruebas de transiciones presentes y en verde (CA-8, SC-003); la
   instalación es repetible y no hay secretos.

## Mapa de criterios de aceptación

| CA | Escenario(s) |
|----|--------------|
| CA-1 | V2, V3 |
| CA-2 | V4 |
| CA-3 | V5 |
| CA-4 | V6 |
| CA-5 | V7 |
| CA-6 | V4 |
| CA-7 | V8 |
| CA-8 | V1, V7, V10 |
