import { ZodError } from "zod";
import { errores } from "../utils/errors.js";

// T011: middleware de validación con esquemas zod (RN-15: validar también en backend).
export function validate(esquema, fuente = "body") {
  return (req, _res, next) => {
    const resultado = esquema.safeParse(req[fuente]);
    if (!resultado.success) {
      return next(formatearError(resultado.error));
    }
    req[fuente] = resultado.data;
    return next();
  };
}

export function formatearError(error) {
  if (!(error instanceof ZodError)) return error;
  const details = error.issues.map((issue) => ({
    field: issue.path.join(".") || "(cuerpo)",
    message: issue.message,
  }));
  return errores.validation(details);
}
