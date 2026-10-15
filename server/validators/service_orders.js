import { z } from "zod";

// T026: validación de órdenes de servicio (VS-06, contrato service-orders.md).
// clientId, vehicleId y mechanicId van opcionales en el alta: la ausencia se
// responde desde el servicio con CLIENT_REQUIRED / VEHICLE_REQUIRED /
// MECHANIC_REQUIRED (mismo patrón que las citas).

export const kilometraje = z
  .number({
    required_error: "El kilometraje de entrada es obligatorio.",
    invalid_type_error: "El kilometraje de entrada debe ser un número.",
  })
  .int("El kilometraje de entrada debe ser un número entero.")
  .min(0, "El kilometraje de entrada no puede ser negativo.");

export const problemaReportado = z
  .string({ required_error: "El problema reportado es obligatorio." })
  .trim()
  .min(1, "El problema reportado es obligatorio.")
  .max(500, "El problema reportado no puede superar los 500 caracteres.");

// Solo ADMIN lo envía; el servicio decide si corrige (RN-4, VS-03).
export const motivoCorreccion = z
  .string()
  .trim()
  .min(10, "El motivo de la corrección debe tener al menos 10 caracteres.")
  .max(300, "El motivo de la corrección no puede superar los 300 caracteres.")
  .optional()
  .nullable();

const idPositivo = (mensaje) =>
  z
    .number(mensaje)
    .int(mensaje)
    .positive(mensaje)
    .optional();

export const orderCreateSchema = z.object({
  clientId: idPositivo("Selecciona un cliente válido."),
  vehicleId: idPositivo("Selecciona un vehículo válido."),
  mechanicId: idPositivo("Selecciona un mecánico válido."),
  entryMileage: kilometraje,
  reportedProblem: problemaReportado,
  mileageCorrectionReason: motivoCorreccion,
});

// Edición base: problema reportado y/o reasignación del mecánico (Q2).
export const orderUpdateSchema = z
  .object({
    reportedProblem: problemaReportado.optional(),
    mechanicId: idPositivo("Selecciona un mecánico válido."),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: "Debes enviar al menos un campo a actualizar.",
  });

// Trabajo de la orden (US5/US7): diagnóstico, observaciones y
// recomendaciones; al menos uno obligatorio (contrato /work).
export const workUpdateSchema = z
  .object({
    diagnosis: z
      .string()
      .trim()
      .min(1, "El diagnóstico no puede quedar vacío.")
      .max(1000, "El diagnóstico no puede superar los 1000 caracteres.")
      .optional(),
    observations: z
      .string()
      .trim()
      .min(1, "Las observaciones no pueden quedar vacías.")
      .max(1000, "Las observaciones no pueden superar los 1000 caracteres.")
      .optional(),
    recommendations: z
      .string()
      .trim()
      .min(1, "Las recomendaciones no pueden quedar vacías.")
      .max(1000, "Las recomendaciones no pueden superar los 1000 caracteres.")
      .optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: "Debes enviar al menos un campo a actualizar.",
  });

export const serviceCreateSchema = z.object({
  description: z
    .string({
      required_error: "La descripción del servicio es obligatoria.",
    })
    .trim()
    .min(1, "La descripción del servicio es obligatoria.")
    .max(200, "La descripción del servicio no puede superar los 200 caracteres."),
  unitPrice: z
    .number({
      invalid_type_error: "El precio unitario debe ser un número.",
    })
    .min(0, "El precio unitario no puede ser negativo.")
    .optional(),
});

export const laborCreateSchema = z.object({
  concept: z
    .string({ required_error: "El concepto de mano de obra es obligatorio." })
    .trim()
    .min(1, "El concepto de mano de obra es obligatorio.")
    .max(200, "El concepto de mano de obra no puede superar los 200 caracteres."),
  hours: z
    .number({
      required_error: "Las horas de mano de obra son obligatorias.",
      invalid_type_error: "Las horas deben ser un número.",
    })
    .positive("Las horas deben ser mayores a 0.")
    .max(999.99, "Las horas no pueden superar las 999.99."),
  hourlyRate: z
    .number({
      invalid_type_error: "La tarifa por hora debe ser un número.",
    })
    .min(0, "La tarifa por hora no puede ser negativa.")
    .optional(),
});

// T067: cambio de estado (máquina R-02). La validez del salto se decide en
// el servicio con INVALID_STATUS_TRANSITION.
export const statusUpdateSchema = z.object({
  status: z.enum(
    [
      "RECEIVED",
      "DIAGNOSIS",
      "IN_REPAIR",
      "WAITING_PART",
      "FINISHED",
      "DELIVERED",
    ],
    {
      errorMap: () => ({ message: "Estado de orden no válido." }),
    },
  ),
});

// T069: alta de refacción en la orden (contrato order-parts.md, VO-02).
// `partId` va opcional en zod a propósito: su ausencia responde
// 400 PART_REQUIRED desde el servicio (mismo patrón que CLIENT_REQUIRED).
export const orderPartCreateSchema = z
  .object({
    partId: z
      .number({ invalid_type_error: "La refacción indicada no es válida." })
      .int("La refacción indicada no es válida.")
      .positive("La refacción indicada no es válida.")
      .optional(),
    quantity: z
      .number({
        required_error: "La cantidad es obligatoria.",
        invalid_type_error: "La cantidad debe ser un número.",
      })
      .int("La cantidad debe ser un número entero.")
      .positive("La cantidad debe ser un número entero mayor que cero."),
  })
  .strict();
