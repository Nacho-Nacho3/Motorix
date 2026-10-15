import { z } from "zod";

// T060: validación de usuarios (contracts/users.md).
// La política de contraseñas NO vive aquí: se valida en el servicio para
// responder 400 WEAK_PASSWORD (distinto de VALIDATION_ERROR).

const ROLES = ["ADMIN", "RECEPTIONIST", "MECHANIC"];

export const username = z
  .string({ required_error: "El usuario es obligatorio." })
  .trim()
  .min(1, "El usuario es obligatorio.")
  .max(50, "El usuario no puede superar los 50 caracteres.");

export const name = z
  .string({ required_error: "El nombre es obligatorio." })
  .trim()
  .min(1, "El nombre es obligatorio.")
  .max(100, "El nombre no puede superar los 100 caracteres.");

export const email = z
  .string({ required_error: "El correo es obligatorio." })
  .trim()
  .min(1, "El correo es obligatorio.")
  .email("Escribe un correo válido.")
  .max(120, "El correo no puede superar los 120 caracteres.");

// Solo se exige presencia; la política completa (8, mayúscula, minúscula,
// número) se revisa en users.service.js.
export const password = z
  .string({ required_error: "La contraseña es obligatoria." })
  .min(1, "La contraseña es obligatoria.");

export const role = z
  .string({
    required_error: "El rol es obligatorio.",
    invalid_type_error: "El rol debe ser ADMIN, RECEPTIONIST o MECHANIC.",
  })
  .trim()
  .refine((valor) => ROLES.includes(valor), {
    message: "El rol debe ser ADMIN, RECEPTIONIST o MECHANIC.",
  });

export const userCreateSchema = z.object({
  username,
  name,
  email,
  password,
  role,
});

// Todos los campos opcionales, pero debe llegar al menos uno.
export const userUpdateSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    role: role.optional(),
    active: z
      .boolean({ invalid_type_error: "El estado activo debe ser verdadero o falso." })
      .optional(),
    password: password.optional(),
  })
  .refine(
    (datos) =>
      datos.name !== undefined ||
      datos.email !== undefined ||
      datos.role !== undefined ||
      datos.active !== undefined ||
      datos.password !== undefined,
    { message: "Debes enviar al menos un campo a actualizar." },
  );
