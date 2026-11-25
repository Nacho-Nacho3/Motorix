import { z } from "zod";

// T024: validación de PATCH /api/settings (Sprint 7, contracts/settings.md,
// FR-001, FR-003). Actualización parcial: solo se aplican las claves enviadas;
// `.strict()` rechaza claves desconocidas y se exige al menos una.

const textoLimitado = (rotulo, max) =>
  z
    .string({ invalid_type_error: `${rotulo} debe ser texto.` })
    .trim()
    .max(max, `${rotulo} no puede superar los ${max} caracteres.`);

const margen = (rotulo, max) =>
  z
    .number({ invalid_type_error: `${rotulo} debe ser un número.` })
    .int(`${rotulo} debe ser un número entero.`)
    .min(0, `${rotulo} no puede ser negativo.`)
    .max(max, `${rotulo} no puede ser mayor que ${max.toLocaleString("en-US")}.`);

const shopSchema = z
  .object({
    name: textoLimitado("El nombre del taller", 100).min(1, "El nombre del taller es obligatorio."),
    address: textoLimitado("La dirección", 200).nullable(),
    phone: textoLimitado("El teléfono", 30).nullable(),
  })
  .partial()
  .strict("La sección del taller solo admite nombre, dirección y teléfono.")
  .refine((valor) => Object.keys(valor).length > 0, "Indica al menos un dato del taller.");

const maintenanceSchema = z
  .object({
    warnDays: margen("El margen en días", 365),
    warnKm: margen("El margen en kilómetros", 20000),
  })
  .partial()
  .strict("La sección de mantenimiento solo admite días y kilómetros.")
  .refine((valor) => Object.keys(valor).length > 0, "Indica al menos un margen.");

export const settingsPatchSchema = z
  .object({
    shop: shopSchema.optional(),
    maintenance: maintenanceSchema.optional(),
  })
  .strict("Solo se admiten las secciones shop y maintenance.")
  .refine(
    (valor) => valor.shop !== undefined || valor.maintenance !== undefined,
    "Indica al menos un dato por cambiar.",
  );
