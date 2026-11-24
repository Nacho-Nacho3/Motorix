import { z } from "zod";

// T025 (US6): validación de la clave de lectura (D-04, contrato
// notifications.md): formato `TIPO:id:ESTADO` y máximo 100 caracteres.
// El mismo schema se usa en la ruta (validate) y en el servicio.

export const notificationKeySchema = z.object({
  key: z
    .string({
      required_error: "La clave del aviso es obligatoria.",
      invalid_type_error: "La clave del aviso debe ser texto.",
    })
    .min(1, "La clave del aviso no puede estar vacía.")
    .max(100, "La clave del aviso no puede pasar de 100 caracteres.")
    .regex(
      /^[A-Z_]+:\d+:[A-Z_]+$/,
      "La clave debe tener el formato TIPO:id:ESTADO (letras mayúsculas y guion bajo, id numérico).",
    ),
});

// T054 (US7, P-9, D-07): cuerpo de POST /api/client-notices. `type` es uno de
// los cuatro motivos (la columna es VARCHAR, la validación vive aquí) y la
// nota es opcional con tope de 300 caracteres.
export const MOTIVOS_AVISO = [
  "ORDER_READY",
  "APPOINTMENT_TOMORROW",
  "MAINTENANCE_UPCOMING",
  "MAINTENANCE_OVERDUE",
];

const idNumerico = (rotulo) =>
  z
    .number({
      required_error: `${rotulo} es obligatorio.`,
      invalid_type_error: `${rotulo} debe ser numérico.`,
    })
    .int(`${rotulo} debe ser un entero.`)
    .positive(`${rotulo} debe ser mayor que cero.`);

export const clientNoticeSchema = z.object({
  clientId: idNumerico("El cliente"),
  type: z.enum(MOTIVOS_AVISO, {
    required_error: "El motivo del aviso es obligatorio.",
    invalid_type_error: "El motivo del aviso debe ser texto.",
    message:
      "El motivo debe ser ORDER_READY, APPOINTMENT_TOMORROW, MAINTENANCE_UPCOMING o MAINTENANCE_OVERDUE.",
  }),
  sourceId: idNumerico("El hecho que motiva el aviso"),
  note: z
    .string({ invalid_type_error: "La nota debe ser texto." })
    .max(300, "La nota no puede pasar de 300 caracteres.")
    .nullish(),
});
