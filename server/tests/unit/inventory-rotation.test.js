import { calcularRotacion } from "../../utils/inventory-rotation.js";

// T109: rotación de inventario (US6, D-08, research P-9). La existencia al cierre
// se reconstruye desde el saldo actual; la de inicio, desde la de cierre.

const mov = (tipo, cantidad) => ({ type: tipo, quantity: cantidad });

describe("calcularRotacion", () => {
  test("sin movimientos posteriores el cierre es el saldo actual y el inicio resta el periodo", () => {
    // Inicio 4, entran 10 y salen 6: cierre 8 = saldo actual.
    const resultado = calcularRotacion({
      stockActual: 8,
      movimientosPeriodo: [mov("IN", 10), mov("OUT", 6)],
      movimientosPosteriores: [],
    });

    // Promedio (4 + 8) / 2 = 6; rotación 6 / 6 = 1.
    expect(resultado).toEqual({ unitsOut: 6, averageStock: "6.00", rotation: "1.00" });
  });

  test("los movimientos posteriores al fin se deshacen para reconstruir el cierre", () => {
    // Saldo actual 5. Después del periodo salieron 3 y entraron 1: cierre 5 − (−3 + 1) = 7.
    // En el periodo salieron 2: inicio 7 − (−2) = 9.
    const resultado = calcularRotacion({
      stockActual: 5,
      movimientosPeriodo: [mov("OUT", 2)],
      movimientosPosteriores: [mov("OUT", 3), mov("IN", 1)],
    });

    expect(resultado.unitsOut).toBe(2);
    expect(resultado.averageStock).toBe("8.00");
    expect(resultado.rotation).toBe("0.25");
  });

  test("IN suma, OUT resta con cantidad positiva y ADJUSTMENT lleva su propio signo", () => {
    // Cierre 10. Periodo: IN 5, OUT 3, ADJUSTMENT −2, ADJUSTMENT +4 → neto +4; inicio 6.
    const resultado = calcularRotacion({
      stockActual: 10,
      movimientosPeriodo: [mov("IN", 5), mov("OUT", 3), mov("ADJUSTMENT", -2), mov("ADJUSTMENT", 4)],
      movimientosPosteriores: [],
    });

    expect(resultado.unitsOut).toBe(3);
    expect(resultado.averageStock).toBe("8.00");
    expect(resultado.rotation).toBe("0.38");
  });

  test("los ajustes no cuentan como unidades salidas", () => {
    const resultado = calcularRotacion({
      stockActual: 10,
      movimientosPeriodo: [mov("ADJUSTMENT", -5)],
      movimientosPosteriores: [],
    });

    expect(resultado.unitsOut).toBe(0);
    expect(resultado.rotation).toBe("0.00");
  });

  test("existencia promedio 0 devuelve rotación null", () => {
    const resultado = calcularRotacion({
      stockActual: 0,
      movimientosPeriodo: [],
      movimientosPosteriores: [],
    });

    expect(resultado).toEqual({ unitsOut: 0, averageStock: "0.00", rotation: null });
  });

  test("agotado al cierre pero con existencia al inicio sí tiene rotación", () => {
    // Inicio 10, salen 10: cierre 0; promedio 5; rotación 2.
    const resultado = calcularRotacion({
      stockActual: 0,
      movimientosPeriodo: [mov("OUT", 10)],
      movimientosPosteriores: [],
    });

    expect(resultado).toEqual({ unitsOut: 10, averageStock: "5.00", rotation: "2.00" });
  });

  test("redondea la rotación y la existencia a dos decimales", () => {
    // Inicio 3, cierre 4 (entra 1... salen 0): promedio 3.5; salen 1 → 0.2857…
    const resultado = calcularRotacion({
      stockActual: 4,
      movimientosPeriodo: [mov("IN", 2), mov("OUT", 1)],
      movimientosPosteriores: [],
    });

    expect(resultado.averageStock).toBe("3.50");
    expect(resultado.rotation).toBe("0.29");
  });

  test("es pura: no modifica sus entradas y repite el resultado", () => {
    const entrada = {
      stockActual: 7,
      movimientosPeriodo: [mov("OUT", 2), mov("IN", 1)],
      movimientosPosteriores: [mov("OUT", 1)],
    };
    const copia = JSON.parse(JSON.stringify(entrada));

    const a = calcularRotacion(entrada);
    const b = calcularRotacion(entrada);

    expect(entrada).toEqual(copia);
    expect(a).toEqual(b);
  });
});
