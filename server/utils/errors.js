// Error de aplicación con código HTTP y código de negocio (Principio VI).
export class AppError extends Error {
  /**
   * @param {number} status Código HTTP
   * @param {string} code Código de negocio, p. ej. INVALID_CREDENTIALS
   * @param {string} message Mensaje en español para la interfaz
   * @param {Array<{field: string, message: string}>} [details] Detalles de validación
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = true;
  }
}

export const errores = {
  validation: (details) =>
    new AppError(400, "VALIDATION_ERROR", "Datos inválidos. Revisa los campos indicados.", details),
  unauthorized: (message = "Debes iniciar sesión para continuar.") =>
    new AppError(401, "UNAUTHORIZED", message),
  invalidCredentials: () =>
    new AppError(401, "INVALID_CREDENTIALS", "Usuario o contraseña incorrectos."),
  forbidden: (message = "No tienes permisos para realizar esta acción.") =>
    new AppError(403, "FORBIDDEN", message),
  accountDisabled: () =>
    new AppError(403, "ACCOUNT_DISABLED", "La cuenta está desactivada. Contacta al administrador."),
  notFound: (code, message) => new AppError(404, code, message),
  conflict: (code, message) => new AppError(409, code, message),
  locked: (retryAfterMinutes) =>
    new AppError(
      423,
      "ACCOUNT_LOCKED",
      `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${retryAfterMinutes} minutos.`,
    ),
  appointmentNotFound: () =>
    new AppError(404, "APPOINTMENT_NOT_FOUND", "La cita solicitada no existe."),
  serviceOrderNotFound: () =>
    new AppError(404, "SERVICE_ORDER_NOT_FOUND", "La orden de servicio solicitada no existe."),
  orderItemNotFound: () =>
    new AppError(404, "ORDER_ITEM_NOT_FOUND", "El registro indicado no existe o no pertenece a la orden."),
  vehicleRequired: () =>
    new AppError(400, "VEHICLE_REQUIRED", "Debes seleccionar un vehículo."),
  vehicleClientMismatch: () =>
    new AppError(400, "VEHICLE_CLIENT_MISMATCH", "El vehículo seleccionado no pertenece al cliente indicado."),
  mechanicRequired: () =>
    new AppError(400, "MECHANIC_REQUIRED", "Debes asignar un mecánico a la orden."),
  mechanicNotFound: () =>
    new AppError(404, "MECHANIC_NOT_FOUND", "El mecánico indicado no existe."),
  invalidMechanic: () =>
    new AppError(400, "INVALID_MECHANIC", "El usuario indicado no es un mecánico activo."),
  mileageLowerThanPrevious: () =>
    new AppError(
      400,
      "MILEAGE_LOWER_THAN_PREVIOUS",
      "El kilometraje de entrada no puede ser menor que el registrado previamente.",
    ),
  invalidStatusTransition: (mensaje = "Ese cambio de estado no está permitido.") =>
    new AppError(400, "INVALID_STATUS_TRANSITION", mensaje),
  appointmentClosed: () =>
    new AppError(400, "APPOINTMENT_CLOSED", "La cita ya está completada o cancelada y no se puede modificar."),
  orderDelivered: () =>
    new AppError(400, "ORDER_DELIVERED", "La orden ya fue entregada; solo el administrador puede corregirla."),
  // T002: códigos nuevos del Sprint 3 (contracts/README.md).
  partNotFound: () =>
    new AppError(404, "PART_NOT_FOUND", "La refacción solicitada no existe."),
  partRequired: () =>
    new AppError(400, "PART_REQUIRED", "Debes seleccionar una refacción."),
  partCodeDuplicated: () =>
    new AppError(400, "PART_CODE_DUPLICATED", "Ese código de refacción ya está registrado en el catálogo."),
  stockInsufficient: () =>
    new AppError(
      400,
      "STOCK_INSUFFICIENT",
      "No hay existencias suficientes; el stock nunca puede quedar por debajo de cero.",
    ),
  maintenanceTargetRequired: () =>
    new AppError(
      400,
      "MAINTENANCE_TARGET_REQUIRED",
      "Debes indicar la fecha o el kilometraje del próximo mantenimiento.",
    ),
  // T002: códigos nuevos del Sprint 4 (contracts/README.md).
  paymentNotFound: () =>
    new AppError(404, "PAYMENT_NOT_FOUND", "El pago solicitado no existe o no pertenece a la orden."),
  paymentAmountMismatch: () =>
    new AppError(
      400,
      "PAYMENT_AMOUNT_MISMATCH",
      "El importe debe ser exactamente el total de la orden; no se aceptan pagos parciales.",
    ),
  orderAlreadyPaid: () =>
    new AppError(400, "ORDER_ALREADY_PAID", "La orden ya tiene un pago pagado; no se admite otro cobro."),
  pendingPaymentExists: () =>
    new AppError(
      409,
      "PENDING_PAYMENT_EXISTS",
      "Hay un pago pendiente de Mercado Pago; sincronízalo o cancélalo antes de registrar otro.",
    ),
  orderNotPayable: () =>
    new AppError(
      400,
      "ORDER_NOT_PAYABLE",
      "La orden debe estar terminada o entregada para registrar un pago.",
    ),
  invalidPaymentTransition: (mensaje = "Ese cambio de estado del pago no está permitido.") =>
    new AppError(409, "INVALID_PAYMENT_TRANSITION", mensaje),
  mercadoPagoNotConfigured: () =>
    new AppError(
      409,
      "MERCADO_PAGO_NOT_CONFIGURED",
      "Mercado Pago no está disponible en este entorno: faltan las credenciales del proveedor.",
    ),
  mercadoPagoError: (mensaje = "Mercado Pago no respondió. Intenta verificar el estado de nuevo.") =>
    new AppError(
      502,
      "MERCADO_PAGO_ERROR",
      mensaje,
    ),
  ticketNotFound: () =>
    new AppError(404, "TICKET_NOT_FOUND", "La orden aún no tiene ticket; genera el comprobante primero."),
  orderNotFinished: () =>
    new AppError(
      400,
      "ORDER_NOT_FINISHED",
      "La orden debe estar terminada o entregada para generar el ticket.",
    ),
  internal: () => new AppError(500, "INTERNAL_ERROR", "Error interno del servidor."),
};
