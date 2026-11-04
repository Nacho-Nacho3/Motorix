# Evidencia — Corrida focalizada de los RF-01 a RF-05 (2026-11-03)

- **Comando ejecutado**: `npm.cmd test -- order-parts historical tickets order-total payment-concurrency payments parts-catalog` dentro de `server/` (el patrón llega a las suites que cubren los cinco requisitos del control de calidad final).
- **Base de datos**: `motorix_test`.
- **Fecha de la ejecución**: 2026-11-03, sobre la rama `005-precios-refacciones-cobro`.
- **Correspondencia con la guía de capturas**: esta corrida sustituye a las capturas **C-06** (RF-03), **C-07** (RF-04) y **C-08** (RF-05); para RF-01, RF-02 y RF-05 es además la prueba registrada en la matriz de la sección 9.

## Resultado de la ejecución válida

| Métrica | Valor |
|---|---|
| Test Suites | 11 passed, 11 total |
| Tests | 114 passed, 114 total |
| Fallidas | 0 |
| Snapshots | 0 total |
| Tiempo | 11.411 s |
| Código de salida | 0 |

Transcripción del resumen:

```text
Test Suites: 11 passed, 11 total
Tests:       114 passed, 114 total
Snapshots:   0 total
Time:        11.411 s, estimated 13 s
Ran all test suites matching order-parts|historical|tickets|order-total|payment-concurrency|payments|parts-catalog.
```

## Suites incluidas (salida de Jest `--listTests`)

1. `tests/integration/order-parts.test.js`
2. `tests/contract/order-parts.contract.test.js`
3. `tests/integration/historical-compat.test.js`
4. `tests/integration/tickets.test.js`
5. `tests/contract/tickets.contract.test.js`
6. `tests/unit/order-total.test.js`
7. `tests/integration/payment-concurrency.test.js`
8. `tests/integration/payments.test.js`
9. `tests/integration/payments-mp.test.js`
10. `tests/contract/payments.contract.test.js`
11. `tests/integration/parts-catalog.test.js`

## Cobertura por requisito de la sección 9

| RF | Suites dentro de esta corrida | Qué verifica |
|---|---|---|
| RF-01 (instantánea y total) | `integration/order-parts.test.js`, `contract/order-parts.contract.test.js`, `unit/order-total.test.js` | El precio se guarda al agregar la línea, un cambio posterior de catálogo no altera la línea ni el total, y la suma es exacta en centavos. |
| RF-02 (compatibilidad y ticket) | `integration/historical-compat.test.js`, `integration/tickets.test.js`, `contract/tickets.contract.test.js` | Pagos y tickets anteriores conservan importe y contenido; el ticket nuevo detalla refacciones con cantidad, precio e importe. |
| RF-03 (precio de compra solo ADMIN) | `integration/parts-catalog.test.js` (lookup y catálogo), `integration/order-parts.test.js` (proyección por rol), `contract/order-parts.contract.test.js` | El lookup del mecánico y las consultas de otros roles no traen `purchasePrice`; el administrador sí lo recibe. |
| RF-04 (un solo pago, simultáneo) | `integration/payment-concurrency.test.js`, `integration/payments.test.js`, `integration/payments-mp.test.js`, `contract/payments.contract.test.js` | Cobros simultáneos dejan un solo pago vigente; el segundo pago y el importe distinto se rechazan; sin datos de tarjeta. |
| RF-05 (límites y centavos) | `integration/parts-catalog.test.js` (tope `99,999.99`, negativos y 3 decimales), `unit/order-total.test.js` (redondeo en centavos) | Los precios inválidos responden 400 con mensaje en `error.details[]` y los importes salen con 2 decimales. |

> Nota: transcripción de la salida observada en la ejecución; no es un archivo de consola literal. El recorrido completo de escenarios V1–V10 está en `escenarios-api-e06.md`.
