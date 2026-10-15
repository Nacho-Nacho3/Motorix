import { validarKilometraje } from "../../services/service_orders.service.js";

// T022: validación de kilometraje de entrada (RN-3, RN-4, CA-6) sin base de datos.

function capturarError(funcion) {
  try {
    funcion();
    return null;
  } catch (error) {
    return error;
  }
}

const VEHICULO_EN_85000 = 85000;

describe("Validación de kilometraje de entrada", () => {
  test("acepta 0 como primer registro cuando el vehículo está en 0 (RN-3)", () => {
    const resultado = validarKilometraje({
      entryMileage: 0,
      kilometrajePrevio: 0,
      rol: "RECEPTIONIST",
    });

    expect(resultado.aplicarCorreccion).toBe(false);
    expect(resultado.motivo).toBeNull();
  });

  test("acepta un kilometraje mayor o igual al previo sin motivo", () => {
    const mayor = validarKilometraje({
      entryMileage: 86000,
      kilometrajePrevio: VEHICULO_EN_85000,
      rol: "RECEPTIONIST",
    });
    const igual = validarKilometraje({
      entryMileage: VEHICULO_EN_85000,
      kilometrajePrevio: VEHICULO_EN_85000,
      rol: "RECEPTIONIST",
    });

    expect(mayor.aplicarCorreccion).toBe(false);
    expect(igual.aplicarCorreccion).toBe(false);
  });

  test("rechaza un kilometraje menor que el previo (RN-4, CA-6)", () => {
    const error = capturarError(() =>
      validarKilometraje({
        entryMileage: 84000,
        kilometrajePrevio: VEHICULO_EN_85000,
        rol: "ADMIN",
      }),
    );

    expect(error).not.toBeNull();
    expect(error.status).toBe(400);
    expect(error.code).toBe("MILEAGE_LOWER_THAN_PREVIOUS");
    expect(error.message).toBe(
      "El kilometraje de entrada no puede ser menor que el registrado previamente.",
    );
  });

  test("ADMIN con motivo de 10 caracteres o más corrige el kilometraje menor", () => {
    const resultado = validarKilometraje({
      entryMileage: 84000,
      kilometrajePrevio: VEHICULO_EN_85000,
      rol: "ADMIN",
      motivoCorreccion: "Se reinició el odómetro",
    });

    expect(resultado.aplicarCorreccion).toBe(true);
    expect(resultado.motivo).toBe("Se reinició el odómetro");
  });

  test("ADMIN con motivo corto no puede corregir", () => {
    const error = capturarError(() =>
      validarKilometraje({
        entryMileage: 84000,
        kilometrajePrevio: VEHICULO_EN_85000,
        rol: "ADMIN",
        motivoCorreccion: "corto",
      }),
    );

    expect(error.code).toBe("MILEAGE_LOWER_THAN_PREVIOUS");
  });

  test("solo ADMIN puede enviar motivo de corrección (403 en otro rol)", () => {
    const error = capturarError(() =>
      validarKilometraje({
        entryMileage: 86000,
        kilometrajePrevio: VEHICULO_EN_85000,
        rol: "RECEPTIONIST",
        motivoCorreccion: "Motivo de al menos diez caracteres",
      }),
    );

    expect(error.status).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe(
      "No tienes permisos para realizar esta acción.",
    );
  });

  test("rechaza un kilometraje negativo o no entero con VALIDATION_ERROR", () => {
    const negativo = capturarError(() =>
      validarKilometraje({
        entryMileage: -1,
        kilometrajePrevio: 0,
        rol: "ADMIN",
      }),
    );
    const decimal = capturarError(() =>
      validarKilometraje({
        entryMileage: 1.5,
        kilometrajePrevio: 0,
        rol: "ADMIN",
      }),
    );

    expect(negativo.code).toBe("VALIDATION_ERROR");
    expect(decimal.code).toBe("VALIDATION_ERROR");
    expect(negativo.details[0].field).toBe("entryMileage");
  });
});
