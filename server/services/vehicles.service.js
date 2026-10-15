import * as vehiculos from "../models/vehicle.model.js";
import * as clientes from "../models/client.model.js";
import { AppError, errores } from "../utils/errors.js";

// T046: lógica de negocio de vehículos (RN-1, VV-01 a VV-04, FR-009..FR-011).

function esPropietarioValido(clientId) {
  return Number.isInteger(clientId) && clientId > 0;
}

async function verificarPlacasYVin({ licensePlate, vin, exceptoId = null }) {
  const placa = await vehiculos.buscarPorPlaca(licensePlate, exceptoId);
  if (placa) {
    throw errores.conflict("DUPLICATE_PLATE", "Esas placas ya están registradas.");
  }
  if (vin) {
    const existente = await vehiculos.buscarPorVin(vin, exceptoId);
    if (existente) {
      throw errores.conflict("DUPLICATE_VIN", "Ese VIN ya está registrado.");
    }
  }
}

export async function list({ clientId, q, page, limit } = {}) {
  const pagina = Math.max(1, Number(page) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(limit) || 10));

  const filtroCliente = clientId ? Number(clientId) : null;
  if (filtroCliente && !esPropietarioValido(filtroCliente)) {
    throw errores.validation([
      { field: "clientId", message: "Selecciona un propietario válido." },
    ]);
  }

  const { vehicles, total } = await vehiculos.listar({
    clientId: filtroCliente,
    q: q ? String(q).trim() : "",
    pagina,
    porPagina,
  });

  return { vehicles, total };
}

export async function getById(id) {
  const vehicle = await vehiculos.buscarPorId(id);
  if (!vehicle) {
    throw errores.notFound("VEHICLE_NOT_FOUND", "Vehículo no encontrado.");
  }
  return { vehicle };
}

export async function create(datos) {
  // RN-1: sin propietario no se guarda (400 CLIENT_REQUIRED).
  if (!esPropietarioValido(datos.clientId)) {
    throw new AppError(
      400,
      "CLIENT_REQUIRED",
      "El vehículo debe tener un propietario.",
    );
  }

  const cliente = await clientes.buscarPorId(datos.clientId);
  if (!cliente) {
    throw errores.notFound("CLIENT_NOT_FOUND", "Cliente no encontrado.");
  }

  await verificarPlacasYVin(datos);

  return vehiculos.crear({
    ...datos,
    currentMileage: datos.currentMileage ?? 0,
    vin: datos.vin || null,
  });
}

export async function update(id, datos) {
  const existente = await vehiculos.buscarPorId(id);
  if (!existente) {
    throw errores.notFound("VEHICLE_NOT_FOUND", "Vehículo no encontrado.");
  }

  if (Object.keys(datos).length === 0) {
    throw errores.validation([
      { field: "(cuerpo)", message: "Debes enviar al menos un campo a actualizar." },
    ]);
  }

  await verificarPlacasYVin({
    licensePlate: datos.licensePlate ?? existente.licensePlate,
    vin: datos.vin !== undefined ? datos.vin : existente.vin,
    exceptoId: id,
  });

  // Solo se envía `vin` cuando viene en la petición: si no, no se toca.
  const aActualizar = { ...datos };
  if (datos.vin !== undefined) {
    aActualizar.vin = datos.vin || null;
  }

  return vehiculos.actualizar(id, aActualizar);
}
