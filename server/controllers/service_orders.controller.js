import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/service_orders.service.js";
import * as inventario from "../services/inventory.service.js";
import { AppError, errores } from "../utils/errors.js";

// T028: controladores de órdenes de servicio (delgados; la lógica vive en services/).

/** Convierte el :id de la ruta a entero o responde 404 SERVICE_ORDER_NOT_FOUND. */
function idDeRuta(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(
      404,
      "SERVICE_ORDER_NOT_FOUND",
      "La orden de servicio solicitada no existe.",
    );
  }
  return id;
}

export async function list(req, res, next) {
  try {
    const resultado = await servicio.list(
      {
        status: req.query.status,
        mechanicId: req.query.mechanicId,
        vehicleId: req.query.vehicleId,
        q: req.query.q,
        page: req.query.page,
        limit: req.query.limit,
      },
      req.user,
    );
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const resultado = await servicio.getById(
      idDeRuta(req.params.id),
      req.user,
    );
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const order = await servicio.create(req.body, req.user);
    creado(res, { order });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const order = await servicio.update(
      idDeRuta(req.params.id),
      req.body,
      req.user,
    );
    ok(res, { order });
  } catch (error) {
    next(error);
  }
}

/** Selector de mecánicos activos para asignar la orden (Q2). */
export async function mechanics(_req, res, next) {
  try {
    const mechanics = await servicio.listarMecanicos();
    ok(res, { mechanics });
  } catch (error) {
    next(error);
  }
}

/** Convierte un id de item (servicio/mano de obra) o responde 404. */
function idItemDeRuta(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw errores.orderItemNotFound();
  }
  return id;
}

/** T058: diagnóstico de la orden (ADMIN o el mecánico asignado). */
export async function work(req, res, next) {
  try {
    const order = await servicio.registrarTrabajo(
      idDeRuta(req.params.id),
      req.body,
      req.user,
    );
    ok(res, { order });
  } catch (error) {
    next(error);
  }
}

/** T058: agrega un servicio realizado a la orden. */
export async function addService(req, res, next) {
  try {
    const service = await servicio.agregarServicio(
      idDeRuta(req.params.id),
      req.body,
      req.user,
    );
    creado(res, { service });
  } catch (error) {
    next(error);
  }
}

/** T058: elimina un servicio capturado por error. */
export async function removeService(req, res, next) {
  try {
    await servicio.eliminarServicio(
      idDeRuta(req.params.id),
      idItemDeRuta(req.params.serviceId),
      req.user,
    );
    ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

/** T058: agrega mano de obra a la orden. */
export async function addLabor(req, res, next) {
  try {
    const labor = await servicio.agregarManoDeObra(
      idDeRuta(req.params.id),
      req.body,
      req.user,
    );
    creado(res, { labor });
  } catch (error) {
    next(error);
  }
}

/** T058: elimina una fila de mano de obra capturada por error. */
export async function removeLabor(req, res, next) {
  try {
    await servicio.eliminarManoDeObra(
      idDeRuta(req.params.id),
      idItemDeRuta(req.params.laborId),
      req.user,
    );
    ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

/** T067: cambio de estado con la máquina de estados (R-02). */
export async function changeStatus(req, res, next) {
  try {
    const order = await servicio.cambiarEstado(
      idDeRuta(req.params.id),
      req.body.status,
      req.user,
    );
    ok(res, { order });
  } catch (error) {
    next(error);
  }
}

// T069: refacciones de la orden (contracts/order-parts.md, US7).

export async function listParts(req, res, next) {
  try {
    const resultado = await inventario.listarRefaccionesOrden(
      idDeRuta(req.params.id),
      req.user,
    );
    ok(res, resultado); // { parts, total }
  } catch (error) {
    next(error);
  }
}

export async function addPart(req, res, next) {
  try {
    const orderPart = await inventario.agregarRefaccionOrden(
      idDeRuta(req.params.id),
      req.body,
      req.user,
    );
    creado(res, { orderPart });
  } catch (error) {
    next(error);
  }
}
