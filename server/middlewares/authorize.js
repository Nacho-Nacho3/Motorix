import { errores } from "../utils/errors.js";

// T012: autorización por rol, siempre en el backend (RN-15).
export function authorize(...rolesPermitidos) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(errores.unauthorized());
    }
    if (!rolesPermitidos.includes(req.user.role)) {
      return next(errores.forbidden());
    }
    return next();
  };
}
