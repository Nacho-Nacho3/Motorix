import * as modelo from "../models/report.model.js";
import { aCadena } from "./order-total.service.js";

// T098: reportes calculados en cada consulta (Sprint 7, research P-9, RN-10). Los
// importes se operan en centavos enteros y se devuelven como cadenas de 2
// decimales, igual que tickets y pagos.

/** Tope de filas de un listado; si se supera, `truncated` es verdadero. */
export const MAX_FILAS = 500;

/**
 * Ingresos por periodo: pagos `PAID` por día y método. Los totales salen de
 * todos los registros aunque `rows` se recorte al tope.
 */
export async function ingresos({ from, to }) {
  const grupos = await modelo.ingresosPorDiaYMetodo({ from, to });

  const porMetodo = new Map();
  let cantidad = 0;
  let centavos = 0;
  for (const grupo of grupos) {
    cantidad += grupo.count;
    centavos += grupo.cents;
    const actual = porMetodo.get(grupo.method) ?? { count: 0, cents: 0 };
    actual.count += grupo.count;
    actual.cents += grupo.cents;
    porMetodo.set(grupo.method, actual);
  }

  const filas = grupos.map((grupo) => ({
    date: grupo.date,
    method: grupo.method,
    count: grupo.count,
    total: aCadena(grupo.cents),
  }));

  return {
    from,
    to,
    rows: filas.slice(0, MAX_FILAS),
    totals: {
      count: cantidad,
      total: aCadena(centavos),
      byMethod: [...porMetodo.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([method, datos]) => ({
          method,
          count: datos.count,
          total: aCadena(datos.cents),
        })),
    },
    truncated: filas.length > MAX_FILAS,
  };
}
