# Evidencia — E-06: recorrido de los escenarios del quickstart contra la API real (2026-11-03)

- **Comando ejecutado** (desde la carpeta `server/`):

  ```powershell
  $env:DB_NAME="motorix_test"; node ..\docs\evidencias\sprint-5\guion-e06-sprint5.mjs
  ```

- **Qué hace el guion**: limpia y migra `motorix_test`, ejecuta `server/scripts/seed.js` contra esa base, levanta la API real (`node app.js`, puerto 3999) con `DB_NAME=motorix_test`, inicia sesión con los tres usuarios seed (`admin`, `mecanico`, `recepcion`) y ejecuta los escenarios V1 a V10 por HTTP (`fetch`), imprimiendo tabla de resultados y terminando con `process.exit` (no se queda colgado).
- **Base de datos**: `motorix_test`; la base de demostración `motorix` no se toca.
- **Requisito**: servicio MySQL en ejecución (en este equipo, `MySQL96`).
- **Fecha de la ejecución**: 2026-11-03, sobre la rama `005-precios-refacciones-cobro`.
- **Correspondencia con la guía de capturas**: sustituye a la captura **C-11** (`captura-escenarios-api.png`).
- **Código de salida**: 0.

## Resultado

**Total: 52 casos, 52 cumplen, 0 no cumplen.**

| Escenario | Caso | Esperado | Obtenido | Resultado |
|---|---|---|---|---|
| V1 | schema_migrations registra 014_order_parts_price.sql | 1 | 1 | Cumple |
| V1 | ninguna línea existente con unit_price NULL | 0 | 0 | Cumple |
| V1 | ninguna línea con precio ajeno al catálogo (backfill D-03) | 0 | 0 | Cumple |
| V1 | re-ejecutar las migraciones sin errores (scripts inmutables) | sin errores | re-aplicadas sin errores | Cumple |
| V2 | segunda pasada del seed sin registros nuevos (SC-007) | conteos idénticos | antes={"ordenes":4,"lineas":2,"pagos":2,"refacciones":6} después={"ordenes":4,"lineas":2,"pagos":2,"refacciones":6} | Cumple |
| V2 | orden cobrable con refacciones | ≥ 1 | orden 3711 | Cumple |
| V2 | orden abierta con línea de refacción con precio | ≥ 1 | orden 3709 | Cumple |
| V2 | pago PENDING de MP con importe distinto al total | importe ≠ total | orden 3712: 1490.00 vs total 1480.00 | Cumple |
| V2 | orden terminada ya pagada con línea de refacciones | ≥ 1 | orden 3711 | Cumple |
| V3 | admin crea refacción con precio de venta 100.00 | 201 | HTTP 201, id=2272 | Cumple |
| V3 | el mecánico elige una de sus órdenes abiertas | ≥ 1 abierta | orden 3710 (IN_REPAIR) | Cumple |
| V3 | mecánico agrega 2 unidades con el selector | 201 | HTTP 201, línea=1149 | Cumple |
| V3 | la línea guarda unitPrice 100.00 (instantánea D-01) | "100.00" | 100.00 | Cumple |
| V3 | admin cambia el precio del catálogo a 150.00 | 200 | HTTP 200 | Cumple |
| V3 | la línea NO cambia tras el cambio de catálogo | "100.00" | 100.00 | Cumple |
| V3 | partsSubtotal sigue en 200.00 (2 × 100.00) | "200.00" | 200.00 | Cumple |
| V6 | mecánico: GET /api/parts → 403 | 403 | HTTP 403 | Cumple |
| V6 | mecánico: lookup sin precios en ningún elemento | 200 y 0 con precios | HTTP 200, 7 elementos, con precios: 0 | Cumple |
| V6 | mecánico: líneas de la orden sin unitPrice | sin unitPrice | 1 elementos, con unitPrice: 0 | Cumple |
| V6 | recepción: GET /api/parts → 403 | 403 | HTTP 403 | Cumple |
| V6 | recepción: líneas con unitPrice y sin campos de corrección | unitPrice sí, corrección no | 1 elementos, cumple=true | Cumple |
| V6 | admin: catálogo con los dos precios | purchasePrice y salePrice | HTTP 200, 7 elementos | Cumple |
| V6 | recepción no puede crear refacciones → 403 | 403 | HTTP 403 | Cumple |
| V6 | mecánico no puede modificar precios → 403 | 403 | HTTP 403 | Cumple |
| V5 | salePrice 100000.00 rechazado con el tope | 400 con «99,999.99» en details | HTTP 400: Datos inválidos. Revisa los campos indicados. → El precio de venta no puede superar los 99,999.99. | Cumple |
| V5 | salePrice con 3 decimales rechazado | 400 | HTTP 400 VALIDATION_ERROR: Datos inválidos. Revisa los campos indicados. → El precio de venta debe ser un número mayor o igual a cero con hasta 2 decimales. | Cumple |
| V5 | precio negativo rechazado | 400 | HTTP 400 VALIDATION_ERROR: Datos inválidos. Revisa los campos indicados. → El precio de venta debe ser un número mayor o igual a cero con hasta 2 decimales. | Cumple |
| V5 | venta menor que compra: se guarda (advertencia ámbar = UI) | 201 | HTTP 201 | Cumple |
| V5 | PATCH del catálogo también aplica el tope | 400 con «99,999.99» en details | HTTP 400 → El precio de venta no puede superar los 99,999.99. | Cumple |
| V4 | Σ de subtotales = total (diferencia 0.00) | diferencia 0.00 | Σ 1680.00 vs total 1680.00 → 0.00 | Cumple |
| V4 | crear orden sin trabajo registrado | 201 | HTTP 201, orden=3713 | Cumple |
| V4 | total de la orden sin trabajo → "0.00" | "0.00" | 0.00 | Cumple |
| V4 | avanzar la orden vacía a FINISHED (VN-02 antecede al chequeo de total) | 200 en cada salto | RECEIVED→DIAGNOSIS:200, DIAGNOSIS→IN_REPAIR:200, IN_REPAIR→FINISHED:200 | Cumple |
| V4 | cobro de total 0.00 rechazado con mensaje en español | 400 con «0.00» en details | HTTP 400: Datos inválidos. Revisa los campos indicados. → El total de la orden es 0.00; no hay importes por cobrar. | Cumple |
| V7 | agregar una refacción a esa orden (instantánea 150.00) | 201 y unitPrice 150.00 verificado como admin | HTTP 201, unitPrice (como admin)=150.00 | Cumple |
| V7 | admin corrige la línea con motivo obligatorio | 200 con motivo, autor y fecha | HTTP 200, unitPrice=120.00, motivo=sí, autor=15123, fecha=sí | Cumple |
| V7 | la corrección cambia la línea y el total | línea 120.00, subtotal 240.00, total anterior + 40.00 | línea=120.00, partsSubtotal=240.00, total=1720.00 (esperado 1720.00) | Cumple |
| V7 | motivo corto → 400 VALIDATION_ERROR | 400 | HTTP 400 VALIDATION_ERROR | Cumple |
| V7 | sin motivo → 400 VALIDATION_ERROR | 400 | HTTP 400 VALIDATION_ERROR | Cumple |
| V7 | token de recepción → 403 | 403 | HTTP 403 | Cumple |
| V7 | fila inexistente o de otra orden → 404 | 404 ORDER_ITEM_NOT_FOUND | HTTP 404 ORDER_ITEM_NOT_FOUND | Cumple |
| V7 | la orden solo con refacciones tiene total > 0 | > 0.00 | 150.00 | Cumple |
| V7 | orden terminada solo con refacciones SÍ es cobrable (D-02) | 201 PAID | HTTP 201, importe=150.00, estado=PAID | Cumple |
| V7 | corregir una línea de orden ya pagada → 400 ORDER_ALREADY_PAID | 400 ORDER_ALREADY_PAID | HTTP 400 ORDER_ALREADY_PAID | Cumple |
| V7 | entregar la orden y corregir → 400 ORDER_DELIVERED | 400 ORDER_DELIVERED | entrega=200, corrección HTTP 400 ORDER_DELIVERED | Cumple |
| V8 | GET total cancela el pago PENDING desfasado (D-04) | CANCELLED | HTTP 200, pago=CANCELLED | Cumple |
| V8 | repetir la consulta es idempotente | sigue CANCELLED | CANCELLED | Cumple |
| V8 | pendiente que COINCIDE con el total → 409 PENDING_PAYMENT_EXISTS | 409 | HTTP 409 PENDING_PAYMENT_EXISTS | Cumple |
| V8 | retirar el pendiente inyectado y cobrar de nuevo | 201 con importe correcto | HTTP 201, importe=1480.00 (total 1480.00) | Cumple |
| V8 | los pagos PAID previos quedan intactos (SC-002) | 1 PAID sin cambios | CASH:PAID | Cumple |
| V9 | cobros simultáneos con Promise.all sobre la API real | exactamente 1 pago PAID y cero 500 | por suite: server/tests/integration/payment-concurrency.test.js (incluida en la ejecución focalizada de 11 suites / 114 pruebas) | Cumple |
| V10 | compatibilidad histórica y regresión completa | línea base en verde | historical-compat + tickets en las suites focalizadas; regresión completa 51 suites / 423 pruebas y Flutter 128 pruebas + analyze limpio | Cumple |

## Notas de ejecución

- **V9 y V10** se registran como cumplidos apoyándose en corridas de suites, no en pasos HTTP del guion: `payment-concurrency.test.js` y `historical-compat.test.js` corrieron en la corrida focalizada (`corrida-focalizada-rf.md`, 11 suites / 114 pruebas) y la regresión completa quedó en `regresion-cierre-2026-11-03.md` (51 suites / 423 pruebas de backend y 128 pruebas de Flutter con `flutter analyze` limpio).
- El pendiente de Mercado Pago que **coincide** con el total se inyecta por SQL dentro del guion con la referencia `E2E-PENDIENTE-COINCIDE` y se retira tras comprobar el 409; no deja residuos.
- Las ids de este listado (órdenes 3709–3713, refacción 2272, línea 1149, usuario 15123) pertenecen a esta corrida sobre `motorix_test`; una corrida nueva muestra los mismos estados e importes con otras ids.
- El mismo guion, contra la base limpia, dejó 51 de 52 casos cumplidos en un intento intermedio; el caso que falló (V4) se debió a un orden del guion que corrigió — la API respondía primero la regla de estado (VN-02) antes que la de total cero. Se documenta por transparencia: el único cambio fue en el guion, no en el producto.

> Nota: transcripción de la salida observada en la ejecución; no es un archivo de consola literal ni una captura de pantalla. El guion queda versionado en este mismo directorio para que la corrida sea reproducible.
