import { z } from "zod";

// T010: validación de citas (VA-01, contrato appointments.md).
// clientId y vehicleId van opcionales en el alta: la ausencia se responde
// desde el servicio con CLIENT_REQUIRED / VEHICLE_REQUIRED (VA-02).

export const fecha = z
  .string({ required_error: "La fecha es obligatoria." })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD.");

export const hora = z
  .string({ required_error: "La hora es obligatoria." })
  .trim()
  .regex(/^\d{2}:\d{2}$/, "La hora debe tener el formato HH:MM.");

export const motivo = z
  .string({ required_error: "El motivo es obligatorio." })
  .trim()
  .min(1, "El motivo es obligatorio.")
  .max(150, "El motivo no puede superar los 150 caracteres.");

export const observaciones = z
  .string()
  .trim()
  .max(500, "Las observaciones no pueden superar los 500 caracteres.")
  .optional()
  .nullable();

const ESTADOS_CITA = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
];

const idCliente = z
  .number("El cliente debe ser un identificador válido.")
  .int("El cliente debe ser un identificador válido.")
  .positive("Selecciona un cliente válido.")
  .optional();

const idVehiculo = z
  .number("El vehículo debe ser un identificador válido.")
  .int("El vehículo debe ser un identificador válido.")
  .positive("Selecciona un vehículo válido.")
  .optional();

export const appointmentCreateSchema = z.object({
  clientId: idCliente,
  vehicleId: idVehiculo,
  date: fecha,
  time: hora,
  reason: motivo,
  notes: observaciones,
});

// Edita fecha, hora, motivo, observaciones y/o el estado (contrato PATCH).
export const appointmentUpdateSchema = z
  .object({
    date: fecha.optional(),
    time: hora.optional(),
    reason: motivo.optional(),
    notes: observaciones,
    status: z
      .enum(ESTADOS_CITA, {
        errorMap: () => ({ message: "Estado de cita no válido." }),
      })
      .optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: "Debes enviar al menos un campo a actualizar.",
  });
