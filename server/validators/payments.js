import { z } from "zod";

// T014: validación de pagos (contrato payments.md, US1, Q1, CA-2/RN-14).
// El cuerpo NO admite `status` ni `orderId`: el estado lo determina el
// servicio según el método y la orden viene de la ruta (RN-13). Aquí solo
// viajan método e importe: nunca datos de tarjeta (RN-14).

const IMPORTE = /^\d+(\.\d{1,2})?$/;

/** Mensaje en español para las claves extra del cuerpo. */
function mensajeClavesExtra(problema, contexto) {
  if (problema.code === z.ZodIssueCode.unrecognized_keys) {
    return {
      message: `No se admiten campos adicionales: ${problema.keys.join(", ")}.`,
    };
  }
  return contexto.defaultError;
}

export const paymentCreateSchema = z
  .object(
    {
      // T024 (US2): los 4 métodos del negocio (FR-002, CA-2); el estado lo
      // decide el método (manuales → PAID, MP → PENDING, R-04).
      method: z.enum(["CASH", "CARD", "TRANSFER", "MERCADO_PAGO"], {
        errorMap: () => ({
          message: "Método de pago no válido; usa efectivo, tarjeta, transferencia o Mercado Pago.",
        }),
      }),
      // Opcional: el defecto es el total calculado de la orden; si viene,
      // debe ser exactamente el total (Q1: sin pagos parciales, VN-03).
      amount: z
        .string({
          invalid_type_error: "El importe debe ser una cifra con hasta 2 decimales.",
        })
        .trim()
        .regex(IMPORTE, "El importe debe ser un número mayor o igual a 0.01 con hasta 2 decimales.")
        .refine(
          (valor) => Math.round(Number(valor) * 100) >= 1,
          "El importe debe ser un número mayor o igual a 0.01 con hasta 2 decimales.",
        )
        .optional(),
    },
    { errorMap: mensajeClavesExtra },
  )
  .strict();
