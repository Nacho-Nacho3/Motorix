import { jest } from "@jest/globals";
import { errorHandler, noEncontrado } from "../../middlewares/errorHandler.js";
import { errores } from "../../utils/errors.js";

// T079: auditoría de seguridad — los 500 nunca filtran trazas de pila ni
// mensajes internos (Principio IV): la respuesta es genérica y en español.

function resFalso() {
  return {
    statusCode: null,
    cuerpo: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("un error inesperado responde 500 INTERNAL_ERROR sin trazas ni secretos", () => {
  const res = resFalso();
  const falloInterno = new Error(
    "detalle sensible: DB_PASSWORD=secreto-de-prueba",
  );
  falloInterno.stack = "Error: detalle sensible\n    at /ruta/oculta.js:1:1";

  errorHandler(falloInterno, {}, res, () => {});

  expect(res.statusCode).toBe(500);
  expect(res.cuerpo).toEqual({
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor." },
  });

  const serializado = JSON.stringify(res.cuerpo);
  expect(serializado).not.toContain("DB_PASSWORD");
  expect(serializado).not.toContain("at /ruta");
  expect(serializado).not.toContain("stack");
});

test("un AppError esperado conserva su código y mensaje en español", () => {
  const res = resFalso();

  errorHandler(errores.serviceOrderNotFound(), {}, res, () => {});

  expect(res.statusCode).toBe(404);
  expect(res.cuerpo.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  expect(res.cuerpo.error.message).toBe(
    "La orden de servicio solicitada no existe.",
  );
});

test("una ruta inexistente responde 404 NOT_FOUND en español", () => {
  const res = resFalso();

  noEncontrado({}, res);

  expect(res.statusCode).toBe(404);
  expect(res.cuerpo).toEqual({
    ok: false,
    error: { code: "NOT_FOUND", message: "Recurso no encontrado." },
  });
});
