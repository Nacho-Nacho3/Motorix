import { z } from "zod";

// T025 (US6): validación de la clave de lectura (D-04, contrato
// notifications.md): formato `TIPO:id:ESTADO` y máximo 100 caracteres.
// El mismo schema se usa en la ruta (validate) y en el servicio.

export const notificationKeySchema = z.object({
  key: z
    .string({
      required_error: "La clave del aviso es obligatoria.",
      invalid_type_error: "La clave del aviso debe ser texto.",
    })
    .min(1, "La clave del aviso no puede estar vacía.")
    .max(100, "La clave del aviso no puede pasar de 100 caracteres.")
    .regex(
      /^[A-Z_]+:\d+:[A-Z_]+$/,
      "La clave debe tener el formato TIPO:id:ESTADO (letras mayúsculas y guion bajo, id numérico).",
    ),
});
