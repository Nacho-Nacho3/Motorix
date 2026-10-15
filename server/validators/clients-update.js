import { z } from "zod";

import { nombre, telefono, correo } from "./clients.js";

// T054: validación de EDICIÓN de clientes (contrato clients.md → PATCH).
// Todos los campos son opcionales, pero debe llegar al menos uno;
// si llegan, aplican las mismas reglas que en el alta.
export const clientUpdateSchema = z
  .object({
    name: nombre.optional(),
    phone: telefono.optional(),
    email: correo.optional(),
    confirmDuplicatePhone: z.boolean().optional(),
  })
  .refine(
    (datos) =>
      datos.name !== undefined ||
      datos.phone !== undefined ||
      datos.email !== undefined,
    { message: "Debes enviar al menos un campo a actualizar." },
  );
