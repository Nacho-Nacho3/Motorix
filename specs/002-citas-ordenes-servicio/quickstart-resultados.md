# Resultados del quickstart — Sprint 2

**Fecha**: 2026-10-14 · **Rama**: `002-citas-ordenes-servicio` · **Estado**: V1–V10 ejecutados

## Cómo se validó

- **V1 y V10**: comandos directos (migraciones, seeds, suites de pruebas e
  instalación desde cero en la base desechable `motorix_qs`).
- **V2 a V9**: script de verificación contra la API real en
  `http://localhost:3000` con los usuarios `admin`, `recepcion` y `mecanico` y
  datos de prueba propios (sufijo único). **Resultado: 52 comprobaciones PASS,
  0 FAIL.**
- **Interfaz**: los pasos de UI equivalentes están cubiertos por las 61 pruebas
  de widget (`appointment_*`, `order_*_test.dart`), que consumen el mismo
  contrato que la API verificada.

> **Nota de V9**: la entrega de la orden (`DELIVERED`) la realiza **ADMIN**;
> `recepcion` recibe 403 en `PATCH .../status` por la decisión Q1 (confirmado en
> V7.4 y V8.3). El recorrido cronometrado se midió en la capa API (0.2 s); el
> recorrido manual en la GUI queda pendiente de ejecución humana.

---

## V1. Esquema y seeds idempotentes (SC-007, CA-8) ✅

1. `aplicar-migraciones.ps1` → registra `004_create_appointments.sql`,
   `005_create_service_orders.sql`, `006_create_order_services.sql` y
   `007_create_order_labor.sql` (más las 001–003). **PASS**
2. Segunda ejecución → 7 de 7 **[omitida]**, 0 aplicadas, sin errores. **PASS**
3. `npm run seed` dos veces → primera: `Citas: 4 creadas` y `Órdenes: 3
   creadas`; segunda: `Citas: 0 creadas, 4 ya existentes` y `Órdenes: 0
   creadas, 3 ya existentes`. **PASS**
4. Conteo tras el seed: `appointments=4`, `service_orders=3`,
   `order_services=3`, `order_labor=3`, `schema_migrations=7`. **PASS**

## V2. Registrar, consultar y modificar citas (CA-1, FR-001–FR-003) ✅

- V2.1 alta de cita → 201 con estado `PENDING`. **PASS**
- V2.2 cambio de hora → 200 y persiste al reabrir. **PASS**
- V2.3 búsqueda por cliente y V2.3b filtro por fecha la encuentran. **PASS**
- V2.4 vehículo de otro cliente → 400 `VEHICLE_CLIENT_MISMATCH`. **PASS**
- V2.4b cuerpo vacío → 400 `VALIDATION_ERROR`. **PASS**

## V3. Cancelación de citas (FR-004, Q3) ✅

- V3.1 cancelar con confirmación → 200 `CANCELED` y la cita sigue visible. **PASS**
- V3.2 cancelar una ya `COMPLETED` → 400 `APPOINTMENT_CLOSED` (historial
  inmutable, VA-05). **PASS** — *ajuste de documentación: el quickstart
  preveía `INVALID_STATUS_TRANSITION`; la implementación y las pruebas usan
  `APPOINTMENT_CLOSED` para citas cerradas, reservando
  `INVALID_STATUS_TRANSITION` para transiciones entre estados activos. Se
  corrigieron `quickstart.md` (V3.2) y `contracts/appointments.md`.*
- V3.3 reactivar una cancelada → 400 (`APPOINTMENT_CLOSED`). **PASS**
- V3.4 cancelar una cita no modifica el total de órdenes (sin vínculo). **PASS**
- V3.5 `mecanico` → `GET /api/appointments` → 403. **PASS**

## V4. Órdenes: cliente, vehículo y kilometraje (CA-2, CA-6, RN-2…RN-4) ✅

- V4.1 alta válida → 201 estado `RECEIVED`. **PASS**
- V4.2 vehículo inexistente → 404 `VEHICLE_NOT_FOUND`; V4.2b sin vehículo →
  400 `VEHICLE_REQUIRED`. **PASS**
- V4.3 asignar a un usuario que no es mecánico → 400 `INVALID_MECHANIC`. **PASS**
- V4.4 kilometraje menor (recepción) → 400 `MILEAGE_LOWER_THAN_PREVIOUS`;
  V4.4b como `admin` con motivo de corrección → 201 y el motivo queda guardado. **PASS**
- V4.5 `vehicles.current_mileage` pasa a `entryMileage` al crear;
  V4.5b una segunda orden con el kilometraje anterior → 400. **PASS**

## V5. El mecánico solo ve sus órdenes (CA-3, SC-004) ✅

- V5.1 el listado del mecánico solo contiene órdenes con su `mechanicId`. **PASS**
- V5.2 un mecánico sin órdenes recién creado → `total: 0` (la UI muestra el
  estado vacío «Cuando te asignen una orden de servicio aparecerá aquí.»). **PASS**
- V5.3 detalle de orden ajena → 403 `FORBIDDEN` (no 404). **PASS**
- V5.4 `admin` y `recepcion` ven todas; V5.4b `?status=RECEIVED` respeta el
  filtro; V5.4c `/mechanics` lista ≥ 2 mecánicos (200 para recepción);
  V5.4d `/mechanics` → 403 para `MECHANIC`. **PASS**

## V6. Diagnóstico, servicios, mano de obra y notas (CA-4, US5, US7) ✅

- V6.1 diagnóstico → 200 y persiste al reabrir. **PASS**
- V6.2 dos servicios y una mano de obra → 201 cada uno; V6.2b aparecen en el
  detalle. **PASS**
- V6.3 borrar un servicio → 200. **PASS**
- V6.4 descripción vacía → 400 `VALIDATION_ERROR` con mensaje en español en
  `error.details[0].message`. **PASS**
- V6.5 observaciones y recomendaciones → 200 y visibles al reabrir. **PASS**
- V6.6 `recepcion` intenta registrar diagnóstico → 403. **PASS**

## V7. Transiciones de estado de la orden (CA-5, CA-8, US6) ✅

- V7.1 secuencia `RECEIVED → DIAGNOSIS → IN_REPAIR → FINISHED → DELIVERED` →
  200 en cada paso. **PASS**
- V7.2 salto `RECEIVED → DELIVERED` → 400 `INVALID_STATUS_TRANSITION`
  («La orden no puede pasar de … a ….»); V7.2b retroceso desde `DELIVERED` →
  400. **PASS**
- V7.3 `DIAGNOSIS → WAITING_PART` expone `waitingOrigin: "DIAGNOSIS"` y la
  salida regresa a `DIAGNOSIS`; V7.3b desde `IN_REPAIR` regresa a `IN_REPAIR`. **PASS**
- V7.4 `recepcion` → 403 en `PATCH .../status`; V7.4b mecánico sobre orden
  ajena → 403. **PASS**
- V7.5 `DELIVERED` sin salidas (400 incluso para ADMIN), la orden sigue
  consultable (RN-9) y `DELETE /api/service-orders/{id}` → 404 (no existe). **PASS**
- V7.6 `npm test` incluye `tests/unit/order-transitions.test.js` con las
  transiciones permitidas y rechazadas → en verde. **PASS**

## V8. Permisos por rol en backend (CA-7, SC-005) ✅

Llamadas directas a la API, sin pasar por la interfaz:

- V8.1 `mecanico` → `GET /api/appointments` → 403. **PASS**
- V8.2 `mecanico` → `POST /api/service-orders` → 403. **PASS**
- V8.3 `recepcion` → `PATCH /api/service-orders/{id}/status` → 403. **PASS**
- V8.4 `mecanico` → `PATCH .../status` de orden ajena → 403. **PASS**
- V8.5 sin token → 401 `UNAUTHORIZED`. **PASS**

## V9. Flujo demostrable de extremo a extremo (SC-001, SC-002) ✅ (con nota)

Cronometrado contra la API real (script completo, sin pausas):

| Paso | Resultado |
|------|-----------|
| V9.1 registrar cliente + vehículo + cita | **96 ms** (< 2 min, SC-002) |
| V9.2 crear la orden y reasignarla (2× `PATCH {mechanicId}`) | 200/200 **PASS** |
| V9.3 mecánico: listado → diagnóstico → servicios → mano de obra → `DIAGNOSIS → IN_REPAIR → FINISHED` → observaciones | **PASS** |
| V9.4 entrega (`DELIVERED`, ADMIN) y cita `COMPLETED` (recepción) | **PASS** |
| V9.5 flujo completo | **0.2 s** (< 5 min, SC-001) |

Los pasos de interfaz equivalentes (alta de cita, alta de orden con selector de
mecánico, detalle con diagnóstico/ítems/estados/notas) están cubiertos por las
pruebas de widget en verde; el recorrido manual cronometrado en la GUI sigue
pendiente de ejecución humana.

## V10. Interfaz, instalación repetible y pruebas (FR-019, SC-003, SC-007) ✅

1. **Tokens y estados** (revisión registrada en T080): colores, espaciados,
   radios y tipografía de `docs/design-system.md`; único valor suelto
   encontrado (`fontSize: 13`) corregido a `AppFontSizes.small`; estados
   vacío/cargando/error/éxito en español; confirmaciones con
   «Confirmar»/«Cancelar»; `PopScope` en `appointment_form_screen` y
   `order_form_screen`; transiciones de 250 ms globales (`pageTransitionsTheme`). **PASS**
2. **Instalación desde cero**: en la base desechable `motorix_qs` (sin tocar
   `motorix`): 7/7 migraciones **[aplicada]**, primer seed crea todo
   (3 usuarios, 3 clientes, 3 vehículos, 4 citas, 3 órdenes) y el segundo
   crea **0**; base eliminada al terminar. **PASS**
3. **Suites en verde**:
   - `server`: `npm run lint` → 0; `npm test` → **27 suites, 215 pruebas, 0 fallos**.
   - `client`: `flutter analyze` → 0; `flutter test` → **61 pruebas, 0 fallos**.
4. **Secretos**: `.env` está en `.gitignore` (línea 2) y `.env.example` solo
   contiene placeholders (`cambiar_en_local`). **PASS**

---

## Mapa de criterios de aceptación

| CA | Escenario(s) | Resultado |
|----|--------------|-----------|
| CA-1 | V2, V3 | ✅ |
| CA-2 | V4 | ✅ |
| CA-3 | V5 | ✅ |
| CA-4 | V6 | ✅ |
| CA-5 | V7 | ✅ |
| CA-6 | V4 | ✅ |
| CA-7 | V8 | ✅ |
| CA-8 | V1, V7, V10 | ✅ |

## Hallazgos durante la validación

1. **Códigos de cita cerrada (V3.2)**: cancelar una cita `COMPLETED` responde
   `APPOINTMENT_CLOSED`, no `INVALID_STATUS_TRANSITION`. Se alinearon
   `quickstart.md` y `contracts/appointments.md` con la implementación (la que
   además está cubierta por pruebas).
2. **Respuesta de login**: `POST /api/auth/login` responde **201** (no 200);
   el contrato de Sprint 1 (`contracts/auth.md`) ya lo documenta.
3. **Entrega por rol (V9)**: `DELIVERED` requiere ADMIN o el mecánico de la
   orden; la recepción no mueve estados (Q1). El flujo demostrable usa ADMIN
   para la entrega.
