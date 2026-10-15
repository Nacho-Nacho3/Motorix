import { z } from "zod";

// T045: validación de vehículos (VV-01 a VV-04, contrato vehicles.md).
const anioMaximo = new Date().getFullYear() + 1;

const marca = z
  .string({ required_error: "La marca es obligatoria." })
  .trim()
  .min(1, "La marca es obligatoria.")
  .max(50, "La marca no puede superar los 50 caracteres.");

const modelo = z
  .string({ required_error: "El modelo es obligatorio." })
  .trim()
  .min(1, "El modelo es obligatorio.")
  .max(50, "El modelo no puede superar los 50 caracteres.");

const year = z
  .number({
    required_error: "El año es obligatorio.",
    invalid_type_error: "El año debe ser un número.",
  })
  .int("El año debe ser un número entero.")
  .min(1900, `El año debe estar entre 1900 y ${anioMaximo}.`)
  .max(anioMaximo, `El año debe estar entre 1900 y ${anioMaximo}.`);

const placas = z
  .string({ required_error: "Las placas son obligatorias." })
  .trim()
  .min(1, "Las placas son obligatorias.")
  .max(20, "Las placas no pueden superar los 20 caracteres.");

const vin = z
  .string()
  .trim()
  .max(20, "El VIN no puede superar los 20 caracteres.")
  .nullable() // VV-03: el VIN es opcional y puede guardarse como NULL
  .optional();

const kilometraje = z
  .number({
    invalid_type_error: "El kilometraje debe ser un número.",
  })
  .int("El kilometraje debe ser un número entero.")
  .min(0, "El kilometraje no puede ser negativo.")
  .optional();

// clientId opcional en el esquema: el servicio responde 400 CLIENT_REQUIRED
// cuando falta (RN-1), para distinguirlo de un error de validación genérico.
export const vehicleCreateSchema = z.object({
  clientId: z
    .number({ invalid_type_error: "Selecciona un propietario válido." })
    .int("Selecciona un propietario válido.")
    .positive("Selecciona un propietario válido.")
    .optional(),
  brand: marca,
  model: modelo,
  year,
  licensePlate: placas,
  vin,
  currentMileage: kilometraje,
});

export const vehicleUpdateSchema = z
  .object({
    brand: marca.optional(),
    model: modelo.optional(),
    year: year.optional(),
    licensePlate: placas.optional(),
    vin,
    currentMileage: kilometraje,
  })
  .refine(
    (datos) =>
      datos.brand !== undefined ||
      datos.model !== undefined ||
      datos.year !== undefined ||
      datos.licensePlate !== undefined ||
      datos.vin !== undefined ||
      datos.currentMileage !== undefined,
    { message: "Debes enviar al menos un campo a actualizar." },
  );
