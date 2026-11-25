# Contrato: Reportes (Sprint 7)

Relacionado: FR-010 a FR-017, US4 a US7, CA-6 a CA-11, D-01, D-05 a D-09, D-19, RN-10, RN-15.

Módulo nuevo (`server/routes/reports.routes.js`). **Solo ADMIN** en los cinco endpoints (el precio de compra y los costos son reservados); RECEPTIONIST y MECHANIC → 403 `FORBIDDEN`. Todos son `GET`, de solo lectura, y se calculan en cada consulta (RN-10).

## Parámetros comunes

| Parámetro | Tipo | Reglas |
|-----------|------|--------|
| `from` | `YYYY-MM-DD` | inicio inclusivo; por omisión el primer día del mes en curso |
| `to` | `YYYY-MM-DD` | fin inclusivo; por omisión hoy |
| `format` | `json` \| `csv` | por omisión `json`; `csv` descarga el archivo (ver «Exportación») |

- `to` no puede ser anterior a `from` y el rango no puede pasar de **366 días**: 400 `VALIDATION_ERROR` con mensaje claro.
- Las fechas son locales del taller (corte diario por hora local, D-06).
- Los listados tienen tope de **500 filas**; si se supera, `truncated: true` y el CSV trae las mismas filas.

## Estructura común de la respuesta 200

```json
{ "ok": true, "data": { "from": "2026-11-01", "to": "2026-11-30", "rows": [ ... ], "totals": { ... }, "truncated": false } }
```

## `GET /api/reports/income` — ingresos por periodo

Solo pagos `PAID`, por la fecha en que quedaron pagados; los `PENDING`, `REJECTED` y `CANCELLED` no cuentan (FR-012).

```json
{
  "rows": [ { "date": "2026-11-03", "method": "CASH", "count": 2, "total": "1850.00" } ],
  "totals": { "count": 14, "total": "21640.50", "byMethod": [ { "method": "CASH", "count": 8, "total": "9800.00" } ] }
}
```

CSV: `Fecha,Método,Pagos,Importe` y una fila final `TOTAL`.

## `GET /api/reports/services` — servicios más frecuentes

Líneas de servicio de órdenes terminadas en el rango, de más a menos frecuentes; las líneas sin tipo (anteriores al sprint o sin elegir) se agrupan en un solo renglón.

```json
{
  "rows": [ { "serviceTypeId": 1, "serviceType": "Cambio de aceite", "count": 12, "amount": "7200.00" },
            { "serviceTypeId": null, "serviceType": "Sin tipo de servicio", "count": 30, "amount": "9100.00" } ],
  "totals": { "count": 42, "amount": "16300.00" }
}
```

CSV: `Tipo de servicio,Cantidad,Importe`.

## `GET /api/reports/productivity` — productividad por mecánico

Órdenes `FINISHED` o `DELIVERED` con `finished_at` en el rango, por mecánico asignado; el importe es la mano de obra de esas órdenes con la misma regla del total de la orden (`horas × tarifa`, a centavos).

```json
{
  "rows": [ { "mechanicId": 3, "mechanicName": "Mecánico", "ordersFinished": 5, "laborAmount": "2400.00" } ],
  "totals": { "ordersFinished": 9, "laborAmount": "4150.00" },
  "approximateDates": 2
}
```

`approximateDates` es el número de órdenes del rango cuya fecha de terminación es la aproximación de la migración (D-19); la pantalla lo muestra como nota. CSV: `Mecánico,Órdenes terminadas,Mano de obra`.

## `GET /api/reports/parts-margin` — costo y margen de refacciones

Líneas de refacción de órdenes terminadas en el rango. Las líneas **sin costo registrado** (`unit_cost` nulo) se excluyen del margen y sus ventas se muestran aparte (D-05).

```json
{
  "rows": [ {
    "partId": 2, "partCode": "FIL-002", "name": "Filtro de aceite",
    "units": 6, "salesAmount": "900.00", "costAmount": "540.00", "marginAmount": "300.00",
    "unitsWithoutCost": 1, "salesWithoutCost": "150.00"
  } ],
  "totals": { "units": 20, "salesAmount": "3100.00", "costAmount": "1700.00", "marginAmount": "1200.00", "unitsWithoutCost": 2, "salesWithoutCost": "300.00" }
}
```

Relaciones que una prueba verifica: `salesAmount` = ventas con costo + `salesWithoutCost`; `marginAmount` = ventas con costo − `costAmount`; `units` incluye `unitsWithoutCost`. CSV: `Código,Refacción,Unidades,Ventas,Costo,Margen,Unidades sin costo,Ventas sin costo`.

## `GET /api/reports/inventory-rotation` — rotación de inventario

Por refacción: unidades `OUT` del periodo entre la existencia promedio (inicio y cierre del periodo reconstruidos con los movimientos, D-08).

```json
{
  "rows": [ { "partId": 2, "partCode": "FIL-002", "name": "Filtro de aceite", "unitsOut": 6, "averageStock": "8.50", "rotation": "0.71" } ],
  "totals": { "unitsOut": 20 }
}
```

`rotation` es `null` cuando la existencia promedio es 0. CSV: `Código,Refacción,Unidades salidas,Existencia promedio,Rotación`.

## Exportación (`?format=csv`)

- Respuesta 200 con `Content-Type: text/csv; charset=utf-8` y `Content-Disposition: attachment; filename="reporte-<nombre>-<from>-<to>.csv"`.
- El archivo sale de **la misma estructura de filas** que el JSON, con los mismos filtros (CA-9, SC-007).
- BOM UTF-8, separador coma, punto decimal, encabezados en español, comillas escapadas; una celda de texto que empieza con `=`, `+`, `-` o `@` se antepone con una comilla simple (fórmulas neutralizadas).
- Sin datos: solo la fila de encabezados.

## Errores

- 400 `VALIDATION_ERROR`: fecha inválida, `to` < `from`, rango > 366 días, `format` desconocido.
- 403 `FORBIDDEN`: rol distinto de ADMIN.
