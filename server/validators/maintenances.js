import { z } from "zod";

// T023: validación de mantenimientos (VM-01 a VM-06, contrato maintainments.md).
// vehicleId y los objetivos van opcionales en el esquema: su ausencia se
// responde desde el servicio con VEHICLE_REQUIRED / MAINTENANCE_TARGET_REQUIRED
// (mismo patrón que citas: VA-02). El estado no se admite en el cuerpo (VM-06).

/** Mensaje en español para las claves adicionales del cuerpo (VM-06). */
function mensajeClavesExtra(problema, contexto) {
  if (problema.code === z.ZodIssueCode.unrecognized_keys) {
    return {
      message: `No se admiten campos adicionales: ${problema.keys.join(", ")}. El estado se calcula en el servidor.`,
    };
  }
  return contexto.defaultError;
}

export const maintenanceCreateSchema = z
  .object(
    {
      vehicleId: z
        .number({ required_error: "Debes seleccionar un vehículo." })
        .int("El identificador del vehículo debe ser un número entero.")
        .positive("El identificador del vehículo debe ser un número entero.")
        .optional(),
      nextDueDate: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD.")
        .optional()
        .nullable(),
      nextDueMileage: z
        .number()
        .int("El kilometraje objetivo debe ser un número entero.")
        .min(0, "El kilometraje objetivo no puede ser negativo.")
        .optional()
        .nullable(),
      warnDays: z
        .number()
        .int("La antelación en días debe ser un número entero.")
        .min(0, "La antelación en días no puede ser negativa.")
        .optional(),
      warnKm: z
        .number()
        .int("La antelación en kilómetros debe ser un número entero.")
        .min(0, "La antelación en kilómetros no puede ser negativa.")
        .optional(),
      recommendations: z
        .string()
        .trim()
        .max(1000, "Las recomendaciones no pueden superar los 1000 caracteres.")
        .optional()
        .nullable(),
    },
    { errorMap: mensajeClavesExtra },
  )
  .strict();
