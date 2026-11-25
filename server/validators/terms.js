import { z } from "zod";

// T069: validación de términos y condiciones (Sprint 7, contracts/terms.md).

export const termsAcceptSchema = z
  .object({
    version: z
      .number({
        required_error: "Indica la versión de los términos que aceptas.",
        invalid_type_error: "La versión debe ser un número entero.",
      })
      .int("La versión debe ser un número entero.")
      .positive("La versión debe ser un número entero positivo."),
  })
  .strict();

const texto = (rotulo) =>
  z
    .string({
      required_error: `${rotulo} es obligatorio.`,
      invalid_type_error: `${rotulo} debe ser texto.`,
    })
    .max(20000, `${rotulo} no puede superar los 20,000 caracteres.`);

/**
 * Los textos vacíos o idénticos a la versión vigente no son un error de
 * formato: los rechaza el servicio con `TERMS_UNCHANGED`.
 */
export const termsPublishSchema = z
  .object({
    termsText: texto("El texto de los términos"),
    privacyText: texto("El aviso de privacidad"),
  })
  .strict();

const entero = (rotulo, minimo) =>
  z
    .string()
    .regex(/^\d+$/, `${rotulo} debe ser un número entero.`)
    .transform(Number)
    .refine((valor) => valor >= minimo, `${rotulo} debe ser mayor o igual que ${minimo}.`);

/** Parámetros de GET /api/terms/acceptances; `pageSize` se limita a 200. */
export const termsAcceptancesQuerySchema = z.object({
  version: entero("La versión", 1).optional(),
  page: entero("La página", 1).optional(),
  pageSize: entero("El tamaño de página", 1).optional(),
});
