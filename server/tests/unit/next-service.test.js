import { calcularProximoServicio } from "../../utils/next-service.js";

// T055: cálculo puro del próximo servicio (US8, research P-5, CA-5, CA-14).

const aceite = { intervalDays: 180, intervalKm: 5000 };
const frenos = { intervalDays: 90, intervalKm: null };
const afinacion = { intervalDays: null, intervalKm: 3000 };

describe("calcularProximoServicio", () => {
  test("con un tipo suma sus intervalos a la fecha y al kilometraje base", () => {
    const resultado = calcularProximoServicio({
      tipos: [aceite],
      fechaBase: "2026-11-25",
      kilometrajeBase: 80000,
    });

    expect(resultado).toEqual({ date: "2027-05-24", mileage: 85000 });
  });

  test("usa el intervalo en días más corto y el de kilómetros más corto entre los tipos", () => {
    const resultado = calcularProximoServicio({
      tipos: [aceite, frenos, afinacion],
      fechaBase: "2026-01-01",
      kilometrajeBase: 10000,
    });

    expect(resultado).toEqual({ date: "2026-04-01", mileage: 13000 });
  });

  test("solo con intervalo en días deja el kilometraje en null", () => {
    expect(
      calcularProximoServicio({ tipos: [frenos], fechaBase: "2026-01-01", kilometrajeBase: 500 }),
    ).toEqual({ date: "2026-04-01", mileage: null });
  });

  test("solo con intervalo en kilómetros deja la fecha en null", () => {
    expect(
      calcularProximoServicio({ tipos: [afinacion], fechaBase: "2026-01-01", kilometrajeBase: 500 }),
    ).toEqual({ date: null, mileage: 3500 });
  });

  test("sin tipos con intervalo devuelve todo null", () => {
    expect(
      calcularProximoServicio({ tipos: [], fechaBase: "2026-01-01", kilometrajeBase: 500 }),
    ).toEqual({ date: null, mileage: null });
    expect(
      calcularProximoServicio({
        tipos: [{ intervalDays: null, intervalKm: null }],
        fechaBase: "2026-01-01",
        kilometrajeBase: 500,
      }),
    ).toEqual({ date: null, mileage: null });
  });

  test("cruza fin de mes y de año sin desfase de zona horaria", () => {
    expect(
      calcularProximoServicio({
        tipos: [{ intervalDays: 30, intervalKm: null }],
        fechaBase: "2026-12-15",
        kilometrajeBase: 0,
      }).date,
    ).toBe("2027-01-14");
    expect(
      calcularProximoServicio({
        tipos: [{ intervalDays: 1, intervalKm: null }],
        fechaBase: "2028-02-28",
        kilometrajeBase: 0,
      }).date,
    ).toBe("2028-02-29");
  });

  test("acepta un Date como fecha base", () => {
    const resultado = calcularProximoServicio({
      tipos: [{ intervalDays: 10, intervalKm: null }],
      fechaBase: new Date(2026, 5, 20),
      kilometrajeBase: 0,
    });

    expect(resultado.date).toBe("2026-06-30");
  });

  test("sin kilometraje base no calcula kilometraje", () => {
    expect(
      calcularProximoServicio({ tipos: [aceite], fechaBase: "2026-01-01", kilometrajeBase: null }),
    ).toEqual({ date: "2026-06-30", mileage: null });
  });

  test("es pura: no modifica los tipos recibidos y repite el resultado", () => {
    const tipos = [aceite, frenos];
    const copia = JSON.parse(JSON.stringify(tipos));
    const primera = calcularProximoServicio({ tipos, fechaBase: "2026-01-01", kilometrajeBase: 1 });
    const segunda = calcularProximoServicio({ tipos, fechaBase: "2026-01-01", kilometrajeBase: 1 });

    expect(tipos).toEqual(copia);
    expect(primera).toEqual(segunda);
  });
});
