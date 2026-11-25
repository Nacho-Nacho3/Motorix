import { jest } from "@jest/globals";

// T004: resolución de la configuración con valores de respaldo (US1, FR-004,
// D-16, research P-2 y P-3). Se simula el modelo para probar solo la regla.
const obtenerTodas = jest.fn();

jest.unstable_mockModule("../../models/settings.model.js", () => ({
  obtenerTodas,
  guardar: jest.fn(),
}));

const { obtenerConfiguracion, resolverMargenes } = await import(
  "../../services/settings.service.js"
);

beforeEach(() => {
  obtenerTodas.mockReset();
});

describe("obtenerConfiguracion", () => {
  test("sin filas guardadas devuelve los valores de respaldo", async () => {
    obtenerTodas.mockResolvedValue([]);

    const config = await obtenerConfiguracion();

    expect(config.shop).toEqual({ name: "Motorix", address: null, phone: null });
    expect(config.maintenance).toEqual({ warnDays: 30, warnKm: 500 });
    expect(config.defaults.shop.name).toBe("Motorix");
    expect(config.defaults.maintenance).toEqual({ warnDays: 30, warnKm: 500 });
  });

  test("devuelve el valor guardado cuando existe y el de respaldo cuando falta", async () => {
    obtenerTodas.mockResolvedValue([
      { key: "shop.name", value: "Taller Central" },
      { key: "maintenance.warn_days", value: "45" },
    ]);

    const config = await obtenerConfiguracion();

    expect(config.shop.name).toBe("Taller Central");
    expect(config.shop.address).toBeNull();
    expect(config.shop.phone).toBeNull();
    expect(config.maintenance.warnDays).toBe(45);
    expect(config.maintenance.warnKm).toBe(500);
  });

  test("convierte los márgenes guardados como texto a número entero", async () => {
    obtenerTodas.mockResolvedValue([
      { key: "maintenance.warn_days", value: "0" },
      { key: "maintenance.warn_km", value: "1200" },
    ]);

    const config = await obtenerConfiguracion();

    expect(config.maintenance.warnDays).toBe(0);
    expect(config.maintenance.warnKm).toBe(1200);
  });

  test("una dirección o un teléfono guardados se devuelven tal cual", async () => {
    obtenerTodas.mockResolvedValue([
      { key: "shop.address", value: "Av. Reforma 10" },
      { key: "shop.phone", value: "5512345678" },
    ]);

    const config = await obtenerConfiguracion();

    expect(config.shop.address).toBe("Av. Reforma 10");
    expect(config.shop.phone).toBe("5512345678");
  });
});

describe("resolverMargenes", () => {
  const config = { maintenance: { warnDays: 45, warnKm: 800 } };

  test("usa el valor propio del mantenimiento cuando no es NULL", () => {
    const margenes = resolverMargenes({ warn_days: 10, warn_km: 100 }, config);

    expect(margenes).toEqual({ warnDays: 10, warnKm: 100 });
  });

  test("usa el valor del taller cuando el del mantenimiento es NULL", () => {
    const margenes = resolverMargenes({ warn_days: null, warn_km: null }, config);

    expect(margenes).toEqual({ warnDays: 45, warnKm: 800 });
  });

  test("resuelve columna por columna", () => {
    expect(resolverMargenes({ warn_days: 7, warn_km: null }, config)).toEqual({
      warnDays: 7,
      warnKm: 800,
    });
    expect(resolverMargenes({ warn_days: null, warn_km: 50 }, config)).toEqual({
      warnDays: 45,
      warnKm: 50,
    });
  });

  test("un valor propio de 0 se respeta y no se confunde con NULL", () => {
    const margenes = resolverMargenes({ warn_days: 0, warn_km: 0 }, config);

    expect(margenes).toEqual({ warnDays: 0, warnKm: 0 });
  });
});
