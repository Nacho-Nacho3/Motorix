import * as clientes from "../models/client.model.js";
import { errores } from "../utils/errors.js";

// T035: lógica de negocio de clientes (HU2/HU4).

export async function list({ q, page, limit } = {}) {
  const pagina = Math.max(1, Number(page) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(limit) || 10));

  const { clients, total } = await clientes.listar({
    q: q ? String(q).trim() : "",
    pagina,
    porPagina,
  });

  return { clients, total };
}

export async function getById(id) {
  const client = await clientes.buscarPorId(id);
  if (!client) {
    throw errores.notFound("CLIENT_NOT_FOUND", "Cliente no encontrado.");
  }
  const vehicles = await clientes.vehiculosDeCliente(id);
  return { client, vehicles };
}

export async function create({ confirmDuplicatePhone, ...valores }) {
  const duplicado = await clientes.buscarPorTelefono(valores.phone);
  if (duplicado && !confirmDuplicatePhone) {
    throw errores.conflict(
      "DUPLICATE_PHONE",
      "Ya existe un cliente con ese teléfono. Confirma para guardar de todos modos.",
    );
  }
  return clientes.crear(valores);
}

export async function update(id, { confirmDuplicatePhone, ...valores }) {
  const existente = await clientes.buscarPorId(id);
  if (!existente) {
    throw errores.notFound("CLIENT_NOT_FOUND", "Cliente no encontrado.");
  }

  if (valores.phone !== undefined) {
    const duplicado = await clientes.buscarPorTelefono(valores.phone, id);
    if (duplicado && !confirmDuplicatePhone) {
      throw errores.conflict(
        "DUPLICATE_PHONE",
        "Ya existe otro cliente con ese teléfono. Confirma para guardar de todos modos.",
      );
    }
  }

  if (Object.keys(valores).length === 0) {
    throw errores.validation([
      { field: "(cuerpo)", message: "Debes enviar al menos un campo a actualizar." },
    ]);
  }

  return clientes.actualizar(id, valores);
}
