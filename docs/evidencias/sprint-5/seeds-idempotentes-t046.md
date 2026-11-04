# Evidencia — Seeds con precios e idempotencia (T045, T046 / CA-12)

- **Comando ejecutado**: `$env:DB_NAME="motorix_test"; node ..\docs\evidencias\sprint-5\verificar-seed-limpio-t046.mjs` dentro de `server/` (script auxiliar que limpia `motorix_test`, aplica las migraciones y ejecuta `server/scripts/seed.js` dos veces seguidas).
- **Base de datos**: `motorix_test`; la base de demostración `motorix` no se toca.
- **Fecha de la ejecución**: 2026-11-03, sobre la rama `005-precios-refacciones-cobro`.
- **Código de salida**: 0.

## Salida (transcripción)

```text
--- pasada 1 ---
Seed completado:
  - Usuarios: 3 creados, 0 ya existentes
  - Clientes: 3 creados, 0 ya existentes
  - Vehículos: 3 creados, 0 ya existentes
  - Citas: 4 creadas, 0 ya existentes
  - Órdenes: 4 creadas, 0 ya existentes
  - Refacciones: 6 creadas, 0 ya existentes
  - Mantenimientos: 3 creados, 0 ya existentes
  - Usos de orden: 1 creados, 0 ya existentes
  - Cobro y ticket: pago PAID registrado, ticket generado
  - Escenarios de precios (T045): línea en orden abierta creada, pago PENDING desfasado creado
--- pasada 2 ---
Seed completado:
  - Usuarios: 0 creados, 3 ya existentes
  - Clientes: 0 creados, 3 ya existentes
  - Vehículos: 0 creados, 3 ya existentes
  - Citas: 0 creadas, 4 ya existentes
  - Órdenes: 0 creadas, 4 ya existentes
  - Refacciones: 0 creadas, 6 ya existentes
  - Mantenimientos: 0 creados, 3 ya existentes
  - Usos de orden: 0 creados, 1 ya existentes
  - Cobro y ticket: pago ya existente u orden sin terminar, ticket ya existente u orden sin terminar
  - Escenarios de precios (T045): línea en orden abierta ya existente u no disponible, pago PENDING desfasado ya existente u no disponible
(b) líneas en órdenes abiertas: [{"orden":3714,"estado":"DIAGNOSIS","precioLinea":"850.00","refaccion":"BAL-001"}]
(c) pago PENDING desfasado: {"id":1075,"orden":3717,"importe":"1490.00","referencia":"SEED-PENDIENTE-3717","total":"1480.00","distintoAlTotal":true}
(a) órdenes cobrables con refacciones: [{"orden":3716,"estado":"FINISHED","lineas":1}]
Conteos tras las dos pasadas: {"ordenes":4,"lineas":2,"pagos":2,"refacciones":6,"tickets":1}
```

## Qué demuestra

- **Idempotencia (SC-007 / CA-12)**: la segunda pasada no crea absolutamente ningún registro (todo aparece como «ya existente») y los conteos finales coinciden con los de la primera pasada.
- **(a) Orden cobrable con refacciones**: orden en `FINISHED` con 1 línea de refacción (D-02).
- **(b) Orden abierta con línea con precio**: la línea conserva `unitPrice` `850.00` (instantánea D-01).
- **(c) Pago pendiente desfasado**: `PENDING` de Mercado Pago por `1490.00` frente a un total de `1480.00` (D-04), con referencia propia.

El escenario se repite en los V2 del recorrido de escenarios (`escenarios-api-e06.md`), donde la segunda pasada del seed vuelve a quedar en conteos idénticos.

> Nota: transcripción de la salida observada en la ejecución. Las ids de orden y de pago (3714, 3716, 3717, 1075) son las de esa corrida en `motorix_test`; en una ejecución nueva se repiten los mismos estados e importes con ids distintos.
