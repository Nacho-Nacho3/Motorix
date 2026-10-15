import { z } from "zod";

// T022: política de contraseña del MVP (RN-17 / FR-005).
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const MENSAJE_POLITICA =
  "Debe tener 8 caracteres como mínimo y al menos una mayúscula, una minúscula y un número.";

export const loginSchema = z.object({
  identifier: z
    .string({ required_error: "El usuario o correo es obligatorio." })
    .trim()
    .min(1, "El usuario o correo es obligatorio."),
  password: z
    .string({ required_error: "La contraseña es obligatoria." })
    .min(1, "La contraseña es obligatoria."),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: "La contraseña actual es obligatoria." })
    .min(1, "La contraseña actual es obligatoria."),
  newPassword: z
    .string({ required_error: "La contraseña nueva es obligatoria." })
    .min(1, "La contraseña nueva es obligatoria."),
});

export function cumplePoliticaPassword(password) {
  return PASSWORD_REGEX.test(password);
}

/**
 * Requisito que falta para cumplir la política, o `null` si la cumple.
 * Se aplica en los servicios (no en zod) porque el contrato exige responder
 * 400 WEAK_PASSWORD con `details` indicando el requisito faltante, mientras
 * que los errores de zod responden VALIDATION_ERROR.
 */
export function requisitoFaltantePassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    return "La contraseña es obligatoria.";
  }
  if (password.length < 8) return "Debe tener 8 caracteres como mínimo.";
  if (!/[A-Z]/.test(password)) return "Debe incluir al menos una mayúscula.";
  if (!/[a-z]/.test(password)) return "Debe incluir al menos una minúscula.";
  if (!/\d/.test(password)) return "Debe incluir al menos un número.";
  return null;
}
