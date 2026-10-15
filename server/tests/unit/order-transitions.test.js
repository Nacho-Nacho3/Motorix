import {
  calcularTransicion,
  transicionesOrden,
} from "../../services/service_orders.service.js";

// T063: máquina de estados de la orden (R-02, Q1, CA-5) sin base de datos.

function capturarError(funcion) {
  try {
    funcion();
    return null;
  } catch (error) {
    return error;
  }
}

function transicion(statusActual, nuevoStatus, waitingOrigin = null) {
  return calcularTransicion({ statusActual, nuevoStatus, waitingOrigin });
}

describe("Máquina de estados de la orden (R-02, Q1, CA-5)", () => {
  test("permite el flujo lineal RECEIVED → DIAGNOSIS → IN_REPAIR → FINISHED → DELIVERED", () => {
    expect(transicion("RECEIVED", "DIAGNOSIS")).toEqual({
      status: "DIAGNOSIS",
      waitingOrigin: null,
    });
    expect(transicion("DIAGNOSIS", "IN_REPAIR")).toEqual({
      status: "IN_REPAIR",
      waitingOrigin: null,
    });
    expect(transicion("IN_REPAIR", "FINISHED")).toEqual({
      status: "FINISHED",
      waitingOrigin: null,
    });
    expect(transicion("FINISHED", "DELIVERED")).toEqual({
      status: "DELIVERED",
      waitingOrigin: null,
    });
  });

  test("permite DIAGNOSIS → WAITING_PART guardando el estado de origen", () => {
    expect(transicion("DIAGNOSIS", "WAITING_PART")).toEqual({
      status: "WAITING_PART",
      waitingOrigin: "DIAGNOSIS",
    });
  });

  test("permite IN_REPAIR → WAITING_PART guardando el estado de origen", () => {
    expect(transicion("IN_REPAIR", "WAITING_PART")).toEqual({
      status: "WAITING_PART",
      waitingOrigin: "IN_REPAIR",
    });
  });

  test("permite salir de WAITING_PART hacia el estado de origen", () => {
    expect(transicion("WAITING_PART", "DIAGNOSIS", "DIAGNOSIS")).toEqual({
      status: "DIAGNOSIS",
      waitingOrigin: null,
    });
    expect(transicion("WAITING_PART", "IN_REPAIR", "IN_REPAIR")).toEqual({
      status: "IN_REPAIR",
      waitingOrigin: null,
    });
  });

  test("rechaza los saltos de estado (INVALID_STATUS_TRANSITION)", () => {
    const salto = capturarError(() => transicion("RECEIVED", "FINISHED"));
    expect(salto.status).toBe(400);
    expect(salto.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("rechaza los retrocesos", () => {
    expect(
      capturarError(() => transicion("DIAGNOSIS", "RECEIVED")).code,
    ).toBe("INVALID_STATUS_TRANSITION");
    expect(
      capturarError(() => transicion("FINISHED", "IN_REPAIR")).code,
    ).toBe("INVALID_STATUS_TRANSITION");
  });

  test("rechaza cualquier salida de DELIVERED (CA-5, CA-8)", () => {
    for (const destino of [
      "RECEIVED",
      "DIAGNOSIS",
      "IN_REPAIR",
      "WAITING_PART",
      "FINISHED",
    ]) {
      const error = capturarError(() => transicion("DELIVERED", destino));
      expect(error.code).toBe("INVALID_STATUS_TRANSITION");
    }
  });

  test("rechaza salir de WAITING_PART a un estado distinto del origen", () => {
    const error = capturarError(() =>
      transicion("WAITING_PART", "FINISHED", "DIAGNOSIS"),
    );
    expect(error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("rechaza quedarse en el mismo estado", () => {
    const error = capturarError(() => transicion("DIAGNOSIS", "DIAGNOSIS"));
    expect(error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("los mensajes de rechazo están en español", () => {
    const salto = capturarError(() => transicion("RECEIVED", "FINISHED"));
    expect(salto.message).toBe(
      "La orden no puede pasar de Recibido a Terminado.",
    );

    const salidaDeEntregado = capturarError(() =>
      transicion("DELIVERED", "DIAGNOSIS"),
    );
    expect(salidaDeEntregado.message).toBe(
      "La orden no puede pasar de Entregado a Diagnóstico.",
    );
  });

  test("sin waiting_origin no se puede salir de WAITING_PART", () => {
    const error = capturarError(() => transicion("WAITING_PART", "IN_REPAIR"));
    expect(error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(error.message).toBe(
      "La orden no puede pasar de Esperando refacción a En reparación.",
    );
  });

  test("el mapa de transiciones no permite saltos ni retrocesos implícitos", () => {
    expect(transicionesOrden.RECEIVED).toEqual(["DIAGNOSIS"]);
    expect(transicionesOrden.DIAGNOSIS).toEqual(["IN_REPAIR", "WAITING_PART"]);
    expect(transicionesOrden.IN_REPAIR).toEqual(["FINISHED", "WAITING_PART"]);
    expect(transicionesOrden.WAITING_PART).toEqual([]);
    expect(transicionesOrden.FINISHED).toEqual(["DELIVERED"]);
    expect(transicionesOrden.DELIVERED).toEqual([]);
  });
});
