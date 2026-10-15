import { z } from "zod";

// T034: validación de clientes (VC-01, contrato clients.md).
// name, phone y email son obligatorios; ninguno es único.
// Se exportan los campos para reutilizarlos en la edición (T054).
export const nombre = z
  .string({ required_error: "El nombre es obligatorio." })
  .trim()
  .min(1, "El nombre es obligatorio.")
  .max(100, "El nombre no puede superar los 100 caracteres.");

export const telefono = z
  .string({ required_error: "El teléfono es obligatorio." })
  .trim()
  .min(1, "El teléfono es obligatorio.")
  .max(20, "El teléfono no puede superar los 20 caracteres.");

export const correo = z
  .string({ required_error: "El correo es obligatorio." })
  .trim()
  .min(1, "El correo es obligatorio.")
  .email("Escribe un correo válido.")
  .max(120, "El correo no puede superar los 120 caracteres.");

export const clientCreateSchema = z.object({
  name: nombre,
  phone: telefono,
  email: correo,
  confirmDuplicatePhone: z.boolean().optional(),
});

