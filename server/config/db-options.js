// Despliegue: opciones de conexión que solo necesita una base en la nube.
// Sin definirlas, la conexión local se comporta igual que antes.

/** TLS con verificación del certificado cuando `DB_SSL=true`. */
export function opcionesSsl(valor) {
  const texto = String(valor ?? "").trim().toLowerCase();
  if (texto === "" || texto === "false") return undefined;
  if (texto !== "true") {
    // Ante un valor mal escrito no se conecta sin cifrar.
    throw new Error("DB_SSL debe ser «true» o «false».");
  }
  return { minVersion: "TLSv1.2", rejectUnauthorized: true };
}

/** Zona horaria de la sesión (`±HH:MM`) para `CURDATE()` y `NOW()`. */
export function zonaHorariaValida(valor) {
  const texto = String(valor ?? "").trim();
  if (texto === "") return undefined;
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(texto)) {
    throw new Error("DB_TIME_ZONE debe tener el formato ±HH:MM, por ejemplo -06:00.");
  }
  return texto;
}
