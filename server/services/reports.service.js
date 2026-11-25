import * as modelo from "../models/report.model.js";
import { calcularRotacion } from "../utils/inventory-rotation.js";
import { aCadena, centavosManoDeObra } from "./order-total.service.js";

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

const SIN_TIPO = "Sin tipo de servicio";

/**
 * Servicios más frecuentes: líneas de órdenes terminadas en el rango, por tipo,
 * de más a menos frecuentes. Las líneas sin tipo se agrupan en un solo renglón.
 */
export async function servicios({ from, to }) {
  const grupos = await modelo.serviciosFrecuentes({ from, to });

  const ordenados = [...grupos].sort(
    (a, b) =>
      b.count - a.count ||
      (a.serviceTypeId === null) - (b.serviceTypeId === null) ||
      String(a.serviceType).localeCompare(String(b.serviceType), "es"),
  );
  const filas = ordenados.map((grupo) => ({
    serviceTypeId: grupo.serviceTypeId,
    serviceType: grupo.serviceType ?? SIN_TIPO,
    count: grupo.count,
    amount: aCadena(grupo.cents),
  }));

  return {
    from,
    to,
    rows: filas.slice(0, MAX_FILAS),
    totals: {
      count: grupos.reduce((suma, grupo) => suma + grupo.count, 0),
      amount: aCadena(grupos.reduce((suma, grupo) => suma + grupo.cents, 0)),
    },
    truncated: filas.length > MAX_FILAS,
  };
}

/**
 * Productividad por mecánico: órdenes terminadas en el rango e importe de su
 * mano de obra con la misma regla del total de la orden (horas × tarifa,
 * redondeada a centavos por línea). `approximateDates` avisa cuántas órdenes
 * tienen la fecha aproximada de la migración (D-19).
 */
export async function productividad({ from, to }) {
  const [mecanicos, lineas, aproximadas] = await Promise.all([
    modelo.ordenesTerminadasPorMecanico({ from, to }),
    modelo.manoDeObraTerminada({ from, to }),
    modelo.ordenesConFechaAproximada({ from, to }),
  ]);

  const centavosPorMecanico = new Map();
  for (const linea of lineas) {
    centavosPorMecanico.set(
      linea.mechanicId,
      (centavosPorMecanico.get(linea.mechanicId) ?? 0) + centavosManoDeObra(linea),
    );
  }

  const filas = mecanicos
    .map((mecanico) => ({
      ...mecanico,
      cents: centavosPorMecanico.get(mecanico.mechanicId) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.ordersFinished - a.ordersFinished ||
        a.mechanicName.localeCompare(b.mechanicName, "es"),
    );

  return {
    from,
    to,
    rows: filas.slice(0, MAX_FILAS).map((fila) => ({
      mechanicId: fila.mechanicId,
      mechanicName: fila.mechanicName,
      ordersFinished: fila.ordersFinished,
      laborAmount: aCadena(fila.cents),
    })),
    totals: {
      ordersFinished: filas.reduce((suma, fila) => suma + fila.ordersFinished, 0),
      laborAmount: aCadena(filas.reduce((suma, fila) => suma + fila.cents, 0)),
    },
    approximateDates: aproximadas,
    truncated: filas.length > MAX_FILAS,
  };
}

/**
 * Costo y margen de refacciones por refacción (D-05). Ventas = cantidad × precio
 * guardado en la línea; costo = cantidad × costo congelado solo en líneas con
 * costo; margen = ventas con costo − costo. Las líneas sin costo no entran al
 * margen: sus unidades y ventas salen aparte.
 */
export async function margenRefacciones({ from, to }) {
  const grupos = await modelo.margenRefacciones({ from, to });

  // Importes de una fila o de los totales (mismas relaciones del contrato).
  const montos = (grupo) => ({
    units: grupo.units,
    salesAmount: aCadena(grupo.salesCents),
    costAmount: aCadena(grupo.costCents),
    marginAmount: aCadena(grupo.salesCents - grupo.salesWithoutCostCents - grupo.costCents),
    unitsWithoutCost: grupo.unitsWithoutCost,
    salesWithoutCost: aCadena(grupo.salesWithoutCostCents),
  });
  const fila = (grupo) => ({
    partId: grupo.partId,
    partCode: grupo.partCode,
    name: grupo.name,
    ...montos(grupo),
  });

  const ordenados = [...grupos].sort(
    (a, b) => b.salesCents - a.salesCents || a.partCode.localeCompare(b.partCode, "es"),
  );
  const totales = grupos.reduce(
    (suma, g) => ({
      units: suma.units + g.units,
      salesCents: suma.salesCents + g.salesCents,
      costCents: suma.costCents + g.costCents,
      unitsWithoutCost: suma.unitsWithoutCost + g.unitsWithoutCost,
      salesWithoutCostCents: suma.salesWithoutCostCents + g.salesWithoutCostCents,
    }),
    { units: 0, salesCents: 0, costCents: 0, unitsWithoutCost: 0, salesWithoutCostCents: 0 },
  );

  return {
    from,
    to,
    rows: ordenados.slice(0, MAX_FILAS).map(fila),
    totals: montos(totales),
    truncated: ordenados.length > MAX_FILAS,
  };
}

/**
 * Rotación de inventario por refacción: unidades salidas del periodo entre la
 * existencia promedio, reconstruida con los movimientos (D-08). No se listan las
 * refacciones sin existencia ni movimientos en el periodo.
 */
export async function rotacionInventario({ from, to }) {
  const { partes, movimientos } = await modelo.movimientosPorRefaccion({ from, to });

  const porParte = new Map();
  for (const m of movimientos) {
    const actual = porParte.get(m.partId) ?? { periodo: [], posteriores: [] };
    (m.posterior ? actual.posteriores : actual.periodo).push({ type: m.type, quantity: m.quantity });
    porParte.set(m.partId, actual);
  }

  const filas = [];
  for (const parte of partes) {
    const { periodo = [], posteriores = [] } = porParte.get(parte.id) ?? {};
    const rotacion = calcularRotacion({
      stockActual: parte.stock,
      movimientosPeriodo: periodo,
      movimientosPosteriores: posteriores,
    });
    // Sin existencia y sin movimientos en el periodo no hay nada que informar.
    if (periodo.length === 0 && Number(rotacion.averageStock) === 0) continue;
    filas.push({
      partId: parte.id,
      partCode: parte.partCode,
      name: parte.name,
      unitsOut: rotacion.unitsOut,
      averageStock: rotacion.averageStock,
      rotation: rotacion.rotation,
    });
  }

  filas.sort(
    (a, b) => b.unitsOut - a.unitsOut || a.partCode.localeCompare(b.partCode, "es"),
  );
  return {
    from,
    to,
    rows: filas.slice(0, MAX_FILAS),
    totals: { unitsOut: filas.reduce((suma, f) => suma + f.unitsOut, 0) },
    truncated: filas.length > MAX_FILAS,
  };
}
