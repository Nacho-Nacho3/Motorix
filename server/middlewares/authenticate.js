import { verificarToken } from "../config/jwt.js";
import { buscarUsuarioPorId } from "../models/user.model.js";
import { tieneAceptacionVigente } from "../models/terms.model.js";
import { errores } from "../utils/errors.js";

// T012: verifica el token Y revalida rol y estado activo en CADA petición (R-03).
// Sprint 7 (CA-19): además exige la aceptación vigente de los términos, salvo en
// las cuatro rutas exentas que usan `authenticateSinTerminos`.
function crearAuthenticate({ exigirTerminos }) {
  return async function authenticate(req, _res, next) {
  try {
    const encabezado = req.headers.authorization || "";
    const [esquema, token] = encabezado.split(" ");

    if (esquema !== "Bearer" || !token) {
      throw errores.unauthorized("Debes iniciar sesión para continuar.");
    }

    let payload;
    try {
      payload = verificarToken(token);
    } catch {
      throw errores.unauthorized("Tu sesión no es válida o ha expirado. Inicia sesión de nuevo.");
    }

    const usuario = await buscarUsuarioPorId(payload.sub);
    if (!usuario) {
      throw errores.unauthorized("Tu sesión no es válida o ha expirado. Inicia sesión de nuevo.");
    }
    if (!usuario.active) {
      throw errores.accountDisabled();
    }

    req.user = {
      id: usuario.id,
      username: usuario.username,
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
    };

    // Después de la cuenta activa: un usuario desactivado conserva su error propio.
    if (exigirTerminos && !(await tieneAceptacionVigente(usuario.id))) {
      throw errores.termsNotAccepted();
    }
    return next();
  } catch (error) {
    return next(error);
  }
  };
}

export const authenticate = crearAuthenticate({ exigirTerminos: true });
export const authenticateSinTerminos = crearAuthenticate({ exigirTerminos: false });
