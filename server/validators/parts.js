import { z } from "zod";

// T043: validación de refacciones (contrato inventory.md, FR-011, RN-8).
// precios: ≥ 0 con hasta 2 decimales, como cadena según el contrato.
// El stock actual y el código no viajan en el PATCH (R-05, inmutabilidad).

const PRECIO = /^\d+(\.\d{1,2})?$/;

/** Mensaje en español para las claves extra del cuerpo. */
function mensajeClavesExtra(problema, contexto) {
  if (problema.code === z.ZodIssueCode.unrecognized_keys) {
    return {
      message: `No se admiten campos adicionales: ${problema.keys.join(", ")}.`,
    };
  }
  return contexto.defaultError;
}

export const partCreateSchema = z
  .object(
    {
      partCode: z
        .string({ required_error: "El código es obligatorio." })
        .trim()
        .min(1, "El código es obligatorio.")
        .max(50, "El código no puede superar los 50 caracteres."),
      name: z
        .string({ required_error: "El nombre es obligatorio." })
        .trim()
        .min(1, "El nombre es obligatorio.")
        .max(100, "El nombre no puede superar los 100 caracteres."),
      category: z
        .string({ required_error: "La categoría es obligatoria." })
        .trim()
        .min(1, "La categoría es obligatoria.")
        .max(50, "La categoría no puede superar los 50 caracteres."),
      brand: z
        .string()
        .trim()
        .max(50, "La marca no puede superar los 50 caracteres.")
        .optional()
        .nullable(),
      stockCurrent: z
        .number()
        .int("El stock inicial debe ser un número entero.")
        .min(0, "El stock inicial no puede ser negativo.")
        .optional(),
      stockMin: z
        .number({ required_error: "El stock mínimo es obligatorio." })
        .int("El stock mínimo debe ser un número entero.")
        .min(0, "El stock mínimo no puede ser negativo."),
      purchasePrice: z
        .string()
        .trim()
        .regex(
          PRECIO,
          "El precio de compra debe ser un número mayor o igual a cero con hasta 2 decimales.",
        )
        .optional()
        .nullable(),
      salePrice: z
        .string()
        .trim()
        .regex(
          PRECIO,
          "El precio de venta debe ser un número mayor o igual a cero con hasta 2 decimales.",
        )
        .optional()
        .nullable(),
    },
    { errorMap: mensajeClavesExtra },
  )
  .strict();

export const partPatchSchema = z
  .object(
    {
      name: z
        .string()
        .trim()
        .min(1, "El nombre no puede quedar vacío.")
        .max(100, "El nombre no puede superar los 100 caracteres.")
        .optional(),
      category: z
        .string()
        .trim()
        .min(1, "La categoría no puede quedar vacía.")
        .max(50, "La categoría no puede superar los 50 caracteres.")
        .optional(),
      brand: z
        .string()
        .trim()
        .max(50, "La marca no puede superar los 50 caracteres.")
        .nullable()
        .optional(),
      stockMin: z
        .number()
        .int("El stock mínimo debe ser un número entero.")
        .min(0, "El stock mínimo no puede ser negativo.")
        .optional(),
      purchasePrice: z
        .string()
        .trim()
        .regex(
          PRECIO,
          "El precio de compra debe ser un número mayor o igual a cero con hasta 2 decimales.",
        )
        .optional()
        .nullable(),
      salePrice: z
        .string()
        .trim()
        .regex(
          PRECIO,
          "El precio de venta debe ser un número mayor o igual a cero con hasta 2 decimales.",
        )
        .optional()
        .nullable(),
    },
    { errorMap: mensajeClavesExtra },
  )
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: "Debes indicar al menos un campo para actualizar.",
  });

/**
 * Movimientos de inventario (T059, contrato inventory.md, RN-7, RN-8):
 * - `movementType`: solo `IN` o `ADJUSTMENT`; un `OUT` manual → 400
 *   VALIDATION_ERROR (las salidas son automáticas al usarse en una orden).
 * - `quantity`: entero ≠ 0; en `ADJUSTMENT` lleva signo (+ suma, − resta).
 * - `reason`: obligatorio ≥ 10 en `ADJUSTMENT`; prohibido en `IN`.
 */
export const movementCreateSchema = z
  .object(
    {
      movementType: z.enum(["IN", "ADJUSTMENT"], {
        errorMap: (problema, contexto) => {
          if (problema.code === z.ZodIssueCode.invalid_enum_value) {
            return {
              message:
                "El tipo debe ser IN o ADJUSTMENT: las salidas (OUT) solo se generan automáticamente.",
            };
          }
          if (
            problema.code === z.ZodIssueCode.invalid_type &&
            problema.received === "undefined"
          ) {
            return { message: "El tipo de movimiento es obligatorio." };
          }
          return contexto.defaultError;
        },
      }),
      quantity: z
        .number({ required_error: "La cantidad es obligatoria." })
        .int("La cantidad debe ser un número entero.")
        .refine((valor) => valor !== 0, {
          message: "La cantidad no puede ser cero.",
        }),
      reason: z
        .string()
        .trim()
        .max(200, "El motivo no puede superar los 200 caracteres.")
        .optional()
        .nullable(),
    },
    { errorMap: mensajeClavesExtra },
  )
  .strict()
  .superRefine((datos, contexto) => {
    if (datos.movementType === "ADJUSTMENT") {
      if ((datos.reason ?? "").length < 10) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "El motivo del ajuste debe tener al menos 10 caracteres.",
        });
      }
    } else if (datos.reason != null && datos.reason !== "") {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "En una entrada (IN) no se admite motivo.",
      });
    }
  });
