import jwt from "jsonwebtoken";
import { env } from "./env.js";

// T012: JWT con vencimiento de 8 horas (R-03).
export function firmarToken(usuario) {
  return jwt.sign(
    {
      sub: String(usuario.id),
      username: usuario.username,
      role: usuario.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verificarToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
