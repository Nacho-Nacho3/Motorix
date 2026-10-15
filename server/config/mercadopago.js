// T025: credenciales de Mercado Pago tomadas del entorno (US2, R-04, CA-7).
// Nunca hay secretos en el repositorio: solo se leen `MP_ACCESS_TOKEN` y
// `MP_PUBLIC_KEY` (placeholders en .env.example, valores en .env local).
// Las propiedades son getters para que el estado se lea en cada acceso: si
// el entorno queda sin credenciales, el método pasa a "no disponible" sin
// reiniciar y las pruebas pueden forzar ese modo.

const leerToken = () => (process.env.MP_ACCESS_TOKEN ?? "").trim();

export const mercadoPagoConfig = {
  /** Token de acceso de sandbox del proveedor; cadena vacía si falta. */
  get accessToken() {
    return leerToken();
  },

  /** Clave pública (solo para mostrar el checkout; la app nunca ve tarjetas). */
  get publicKey() {
    return (process.env.MP_PUBLIC_KEY ?? "").trim();
  },

  /**
   * false si el token está vacío: el método Mercado Pago no está disponible
   * y el backend responde 409 MERCADO_PAGO_NOT_CONFIGURED (R-04).
   */
  get configurado() {
    return leerToken().length > 0;
  },
};
