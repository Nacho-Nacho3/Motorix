# Contrato: Cambios a endpoints existentes (Sprint 7)

Relacionado: FR-002 a FR-004, FR-006 a FR-008, FR-018 a FR-021, FR-025 a FR-027, US1 a US3, US8, US9, US10, CA-1, CA-3, CA-5, CA-14, CA-19, CA-22 a CA-24, D-03, D-13, D-14, D-16.

Todos los cambios son **aditivos y compatibles hacia atrás**: ningún campo existente cambia de nombre o de tipo y los clientes anteriores siguen funcionando. Los contratos originales (Sprints 1 a 6) no se editan; este documento es la referencia de las diferencias.

## Mantenimientos (`contracts/maintenances.md` del Sprint 3)

### `POST /api/maintenances` (alta o reemplazo del registro único del vehículo)

- `warnDays` y `warnKm` pasan a ser **opcionales y admiten `null`**. Omitir el campo o enviar `null` significa «sin antelación propia: rige el valor del taller» (D-16). Enviar un número (0 o más) lo captura a mano.
- Hoy el servicio asume 30 y 500 cuando faltan; ahora, al faltar, guarda `NULL`.

### `GET /api/maintenances` y las respuestas de mantenimiento

- `warnDays` y `warnKm` devuelven el valor **efectivo** (el propio o el del taller), así que el cálculo de `state` los usa sin cambios.
- Campos nuevos: `warnDaysCustom` y `warnKmCustom` (boolean): `true` si el valor fue capturado a mano. El formulario los usa para mostrar «usar el valor del taller».
- Las respuestas de `GET /api/dashboard` y del centro de avisos no cambian de forma: consumen la misma lista, ya con los márgenes efectivos.

### `GET /api/maintenances/suggestion?vehicleId=<id>` (nuevo; ADMIN y MECHANIC, igual que el alta)

Propone fecha y kilometraje a partir de la **última orden terminada o entregada del vehículo** que tenga servicios con tipo con intervalo (CA-5). El usuario puede corregir los valores antes de guardar.

```json
{
  "ok": true,
  "data": {
    "suggestion": { "nextDueDate": "2027-05-23", "nextDueMileage": 87000, "basedOnOrderId": 41, "serviceTypes": ["Cambio de aceite"] }
  }
}
```

Sin orden elegible o sin tipos con intervalo: `{ "suggestion": null }`. Regla: el intervalo en días más corto da la fecha desde la fecha de terminación de la orden y el intervalo en kilómetros más corto da el kilometraje desde el kilometraje de entrada. 404 `VEHICLE_NOT_FOUND` si el vehículo no existe; 400 `VALIDATION_ERROR` si `vehicleId` falta o no es entero.

## Servicios de la orden (`contracts/service-orders.md` del Sprint 2)

- `POST /api/service-orders/:id/services` acepta `serviceTypeId` (entero, opcional). Si se envía debe existir y estar activo; si no, 400 `VALIDATION_ERROR` con mensaje en español.
- Las respuestas de servicios agregan `serviceTypeId` (number \| null) y `serviceTypeName` (string \| null). Las líneas anteriores devuelven `null` y siguen siendo válidas.
- Las órdenes ya terminadas o entregadas conservan sus reglas de edición del Sprint 2; el tipo no se puede cambiar en una línea existente (corregir una fila sigue siendo borrar y agregar, como hoy).

## Tickets (`contracts/tickets.md` del Sprint 4)

### `POST /api/service-orders/:id/ticket` y `GET /api/service-orders/:id/ticket`

- `workshop` ya no sale de `config/taller.js`: sale de la **instantánea guardada al emitir** (CA-1, D-03). La forma no cambia: `{ "name", "address", "phone" }`.
- Campo nuevo `nextService`: `null` o `{ "date": "2027-05-23" | null, "mileage": 87000 | null }` (CA-14). Es `null` cuando ninguna línea de servicio de la orden tiene un tipo con intervalo.
- La instantánea y `nextService` se calculan una sola vez, al emitir: reimprimir o volver a consultar devuelve lo mismo, aunque después cambie la configuración o el catálogo.
- El resto del ticket (cliente, vehículo, servicios, mano de obra, refacciones, totales y pago) se sigue calculando en cada lectura, sin cambios.
- Los tickets emitidos **antes** del sprint devuelven `workshop` con los valores que mostraban (`Motorix`, sin dirección ni teléfono) y `nextService: null`.

## Autenticación (`contracts/auth.md` del Sprint 1)

- `POST /api/auth/login` y `GET /api/auth/me` agregan `termsAccepted` (boolean) a la respuesta: `false` obliga al cliente a mostrar la pantalla de aceptación antes de cargar datos (CA-16).
- **Código nuevo 401 `SESSION_IDLE`** en toda ruta autenticada: más de 30 minutos sin actividad (CA-23). El cliente cierra la sesión y avisa; el usuario inicia sesión de nuevo.
- **Código nuevo 403 `TERMS_NOT_ACCEPTED`** en toda ruta autenticada salvo las cuatro exentas (CA-19; ver README de contratos).
- `POST /api/auth/login`: el campo `password` se acota a **128 caracteres** (más largo → 400 `VALIDATION_ERROR`) y los inicios de sesión fallidos y los bloqueos se registran en la bitácora.
- `POST /api/auth/change-password` y `POST /api/users`: la contraseña nueva admite **como máximo 64 caracteres**; más larga → 400 `WEAK_PASSWORD` con el requisito faltante en `details` («Debe tener 64 caracteres como máximo.», CA-22, D-13). Los demás requisitos no cambian.

## Registro en la bitácora desde endpoints existentes (sin cambios de forma)

Estos endpoints responden exactamente igual; solo escriben además un registro en la bitácora (ver `audit-log.md`):

| Endpoint | Acción |
|----------|--------|
| `POST /api/users` | `USER_CREATED` |
| `PATCH /api/users/:id` | `USER_UPDATED` (rol, baja o reactivación) |
| `PATCH /api/parts/:id` | `PART_PRICE_CHANGED` (solo si cambia un precio) |
| `PATCH /api/service-orders/:id/parts/:partRowId/price` | `ORDER_PART_PRICE_CORRECTED` |
| `POST /api/service-orders/:id/payments/:paymentId/cancel` | `PAYMENT_CANCELLED` |

## Garantía transversal (CA-24)

Ninguna respuesta de la API incluye `password`, `passwordHash`, `password_hash` ni `token` (salvo el del login), y los precios de compra y costos solo llegan a ADMIN. Es un contrato de **no regresión**: una suite recorre los endpoints de usuarios, refacciones, órdenes, pagos y tickets con cada rol.
