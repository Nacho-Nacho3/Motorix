// T010: sobre de respuesta único {"ok":true,"data"} / {"ok":false,"error"}.
export function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function creado(res, data) {
  return ok(res, data, 201);
}

export function fallo(res, status, code, message, details) {
  const error = { code, message };
  if (details && details.length > 0) error.details = details;
  return res.status(status).json({ ok: false, error });
}
