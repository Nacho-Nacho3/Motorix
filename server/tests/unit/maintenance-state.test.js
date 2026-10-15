import { calcularEstadoMantenimiento } from "../../utils/maintenance-state.js";

// T020: cálculo de NORMAL/UPCOMING/OVERDUE en el backend (FR-007, RN-11,
// RN-12, Q4). La antelación es por registro (warnDays/warnKm, defecto
// 30/500) y el estado no se persiste: se recalcula en cada lectura (VM-06).

const BASE = {
  nextDueDate: "2026-11-20",
  nextDueMileage: 50000,
  warnDays: 30,
  warnKm: 500,
  fechaActual: "2026-10-14",
  kilometrajeActual: 48500,
};

describe("Cálculo del estado del próximo mantenimiento (US2)", () => {
  test("devuelve NORMAL cuando falta más que la antelación configurada", () => {
    const resultado = calcularEstadoMantenimiento({ ...BASE });

    expect(resultado.state).toBe("NORMAL");
    expect(resultado.daysRemaining).toBe(37);
    expect(resultado.mileageRemaining).toBe(1500);
  });

  test("devuelve UPCOMING dentro de la antelación por días", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      fechaActual: "2026-11-10", // faltan 10 días ≤ 30
    });

    expect(resultado.state).toBe("UPCOMING");
    expect(resultado.daysRemaining).toBe(10);
    expect(resultado.mileageRemaining).toBe(1500);
  });

  test("devuelve UPCOMING dentro de la antelación por kilometraje", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      kilometrajeActual: 49700, // faltan 300 km ≤ 500
    });

    expect(resultado.state).toBe("UPCOMING");
    expect(resultado.mileageRemaining).toBe(300);
  });

  test("devuelve OVERDUE cuando la fecha objetivo ya pasó", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      fechaActual: "2026-11-25",
    });

    expect(resultado.state).toBe("OVERDUE");
    expect(resultado.daysRemaining).toBe(-5);
  });

  test("devuelve OVERDUE cuando el kilometraje alcanza el objetivo", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      kilometrajeActual: 50000,
    });

    expect(resultado.state).toBe("OVERDUE");
    expect(resultado.mileageRemaining).toBe(0);
  });

  test("con ambos objetivos se vence al cumplirse cualquiera de los dos", () => {
    const porKilometraje = calcularEstadoMantenimiento({
      ...BASE,
      fechaActual: "2026-10-20", // la fecha aún no vence (faltan 31 días)
      kilometrajeActual: 50200, // pero el kilometraje sí
    });
    expect(porKilometraje.state).toBe("OVERDUE");

    const porFecha = calcularEstadoMantenimiento({
      ...BASE,
      fechaActual: "2026-12-01", // la fecha venció
      kilometrajeActual: 48600, // pero el kilometraje no (faltan 1400 km)
    });
    expect(porFecha.state).toBe("OVERDUE");
    expect(porFecha.mileageRemaining).toBe(1400);
  });

  test("usa la antelación del propio registro (warnDays y warnKm)", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      warnDays: 60,
      warnKm: 3000,
      fechaActual: "2026-10-20", // 31 días: > 30 (defecto) pero ≤ 60
      kilometrajeActual: 48000, // 2000 km: > 500 (defecto) pero ≤ 3000
    });

    expect(resultado.state).toBe("UPCOMING");
  });

  test("solo con fecha objetivo devuelve mileageRemaining nulo", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      nextDueMileage: null,
    });

    expect(resultado.state).toBe("NORMAL");
    expect(resultado.daysRemaining).toBe(37);
    expect(resultado.mileageRemaining).toBeNull();
  });

  test("solo con kilometraje objetivo devuelve daysRemaining nulo", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      nextDueDate: null,
      fechaActual: "2026-10-14",
      kilometrajeActual: 48500,
    });

    expect(resultado.state).toBe("NORMAL");
    expect(resultado.daysRemaining).toBeNull();
    expect(resultado.mileageRemaining).toBe(1500);
  });

  test("daysRemaining y mileageRemaining quedan negativos cuando ya venció", () => {
    const resultado = calcularEstadoMantenimiento({
      ...BASE,
      fechaActual: "2026-12-01",
      kilometrajeActual: 51000,
    });

    expect(resultado.state).toBe("OVERDUE");
    expect(resultado.daysRemaining).toBe(-11);
    expect(resultado.mileageRemaining).toBe(-1000);
  });
});
