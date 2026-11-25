// T059: cálculo puro del «próximo servicio» (Sprint 7, US8, research P-5).
// Entre los tipos de servicio con intervalo se toma el intervalo en días más
// corto y el de kilómetros más corto. Sin efectos secundarios.

/** Fecha local `YYYY-MM-DD` a partir de un Date. */
function aTexto(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Interpreta `YYYY-MM-DD` o un Date como fecha local (sin desfase de zona). */
function aFechaLocal(valor) {
  if (valor instanceof Date) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  const [anio, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Menor valor positivo de la lista o `null`. */
function minimo(valores) {
  const validos = valores.filter((valor) => Number.isFinite(valor) && valor > 0);
  return validos.length > 0 ? Math.min(...validos) : null;
}

/**
 * @param {{ tipos: Array<{intervalDays: number|null, intervalKm: number|null}>,
 *   fechaBase: string|Date, kilometrajeBase: number|null }} datos
 * @returns {{ date: string|null, mileage: number|null }}
 */
export function calcularProximoServicio({ tipos = [], fechaBase, kilometrajeBase }) {
  const dias = minimo(tipos.map((tipo) => tipo.intervalDays));
  const km = minimo(tipos.map((tipo) => tipo.intervalKm));

  let date = null;
  if (dias !== null && fechaBase) {
    const fecha = aFechaLocal(fechaBase);
    fecha.setDate(fecha.getDate() + dias);
    date = aTexto(fecha);
  }

  const mileage =
    km !== null && kilometrajeBase !== null && kilometrajeBase !== undefined
      ? Number(kilometrajeBase) + km
      : null;

  return { date, mileage };
}
