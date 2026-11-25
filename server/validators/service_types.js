import { z } from "zod";

// T046: validación del catálogo de tipos de servicio (Sprint 7,
// contracts/service-types.md, RN-12). Cada intervalo es un entero mayor que 0
// (días ≤ 3650, km ≤ 1,000,000) y se exige al menos uno.

const nombre = z
  .string({
    required_error: "El nombre del tipo de servicio es obligatorio.",
    invalid_type_error: "El nombre del tipo de servicio debe ser texto.",
  })
  .trim()
  .min(1, "El nombre del tipo de servicio es obligatorio.")
  .max(100, "El nombre del tipo de servicio no puede superar los 100 caracteres.");

const intervalo = (rotulo, maximo) =>
  z
    .number({ invalid_type_error: `${rotulo} debe ser un número.` })
    .int(`${rotulo} debe ser un número entero.`)
    .min(1, `${rotulo} debe ser mayor que cero.`)
    .max(maximo, `${rotulo} no puede ser mayor que ${maximo.toLocaleString("en-US")}.`);

const dias = intervalo("El intervalo en días", 3650);
const kilometros = intervalo("El intervalo en kilómetros", 1000000);

const MENSAJE_SIN_INTERVALO = "Indica al menos un intervalo, en días o en kilómetros.";

export const serviceTypeCreateSchema = z
  .object({
    name: nombre,
    intervalDays: dias.nullable().optional(),
    intervalKm: kilometros.nullable().optional(),
  })
  .strict()
  .refine((valor) => valor.intervalDays != null || valor.intervalKm != null, {
    message: MENSAJE_SIN_INTERVALO,
    path: ["intervalDays"],
  });

/**
 * Actualización parcial. Que quede al menos un intervalo depende del registro
 * guardado, así que esa regla final se comprueba en el servicio.
 */
export const serviceTypePatchSchema = z
  .object({
    name: nombre.optional(),
    intervalDays: dias.nullable().optional(),
    intervalKm: kilometros.nullable().optional(),
    active: z
      .boolean({ invalid_type_error: "El estado debe ser verdadero o falso." })
      .optional(),
  })
  .strict()
  .refine((valor) => Object.keys(valor).length > 0, {
    message: "Debes enviar al menos un campo a actualizar.",
  });

export const serviceTypeQuerySchema = z.object({
  active: z.enum(["true", "false"], { errorMap: () => ({ message: "El filtro active debe ser true o false." }) }).optional(),
});

export { MENSAJE_SIN_INTERVALO };
