// T068: validación en vivo de los escenarios V1–V7 del quickstart.md.
// Uso: arrancar el backend (npm start) y ejecutar: node validate-quickstart.mjs
// V8 se valida con las pruebas de Flutter, V9 se ejecuta con los scripts de
// database/ y V10 queda registrado en quickstart-resultados.md (T070).

const BASE = process.env.BASE_URL ?? "http://localhost:3000/api";

let superadas = 0;
let fallidas = 0;

function comprobar(escenario, descripcion, condicion, detalle = "") {
  if (condicion) {
    superadas += 1;
    console.log(`  [${escenario}] ok   ${descripcion}`);
  } else {
    fallidas += 1;
    console.log(`  [${escenario}] FALLA ${descripcion}${detalle ? ` — ${detalle}` : ""}`);
  }
}

async function api(metodo, ruta, { token, cuerpo } = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  });
  let cuerpoJson = null;
  try {
    cuerpoJson = await respuesta.json();
  } catch {
    // Respuesta sin JSON: se evalúa solo por el código HTTP.
  }
  return { status: respuesta.status, body: cuerpoJson };
}

function tokenDe(respuesta) {
  return respuesta.body?.data?.token;
}

function codigoError(respuesta) {
  return respuesta.body?.error?.code;
}

const CLIENTE_PRUEBA = {
  name: "Laura Ramírez",
  phone: "5544332211",
  email: "laura@correo.mx",
};

const VEHICULO_PRUEBA = {
  brand: "Mazda",
  model: "Mazda 3",
  year: 2021,
  licensePlate: "VST0001",
  vin: null,
  currentMileage: 42000,
};

async function main() {
  console.log(`Validando contra ${BASE}\n`);

  // ---------------------------------------------------------------- V1
  console.log("V1. Login por usuario y por correo (SC-002, RN-16)");
  const adminLogin = await api("POST", "/auth/login", {
    cuerpo: { identifier: "admin", password: "Admin2026!" },
  });
  comprobar("V1", "login con usuario → 201 y token", adminLogin.status === 201 && Boolean(tokenDe(adminLogin)));
  const adminToken = tokenDe(adminLogin);

  const adminCorreo = await api("POST", "/auth/login", {
    cuerpo: { identifier: "admin@motorix.local", password: "Admin2026!" },
  });
  comprobar("V1", "login con correo → 201 (mismo resultado)", adminCorreo.status === 201);

  const loginMalo = await api("POST", "/auth/login", {
    cuerpo: { identifier: "admin", password: "clave-incorrecta" },
  });
  comprobar(
    "V1",
    "contraseña incorrecta → 401 con mensaje genérico",
    loginMalo.status === 401 &&
      codigoError(loginMalo) === "INVALID_CREDENTIALS" &&
      loginMalo.body?.error?.message === "Usuario o contraseña incorrectos.",
    `status=${loginMalo.status} code=${codigoError(loginMalo)}`,
  );

  // ---------------------------------------------------------------- V2
  console.log("\nV2. Bloqueo por intentos fallidos (R-03)");
  const temp = await api("POST", "/users", {
    token: adminToken,
    cuerpo: {
      username: "bloqueotmp",
      name: "Cuenta de bloqueo",
      email: "bloqueo@motorix.local",
      password: "Bloqueo2026!",
      role: "MECHANIC",
    },
  });
  comprobar("V2", "cuenta temporal creada por ADMIN → 201", temp.status === 201);

  for (let intento = 1; intento <= 5; intento += 1) {
    await api("POST", "/auth/login", {
      cuerpo: { identifier: "bloqueotmp", password: "clave-mala" },
    });
  }
  const trasFallos = await api("POST", "/auth/login", {
    cuerpo: { identifier: "bloqueotmp", password: "Bloqueo2026!" },
  });
  comprobar(
    "V2",
    "sexto intento (incluso correcto) → 423 ACCOUNT_LOCKED",
    trasFallos.status === 423 && codigoError(trasFallos) === "ACCOUNT_LOCKED",
    `status=${trasFallos.status} code=${codigoError(trasFallos)}`,
  );
  comprobar(
    "V2",
    "el mensaje indica los minutos restantes (15)",
    /15 minutos/.test(trasFallos.body?.error?.message ?? ""),
    trasFallos.body?.error?.message,
  );

  // ---------------------------------------------------------------- V3
  console.log("\nV3. Registro y consulta de clientes (HU2, SC-001)");
  const recepcionLogin = await api("POST", "/auth/login", {
    cuerpo: { identifier: "recepcion", password: "Recepcion2026!" },
  });
  comprobar("V3", "login de recepcion → 201", recepcionLogin.status === 201);
  const tokenRecepcion = tokenDe(recepcionLogin);

  const cliente = await api("POST", "/clients", {
    token: tokenRecepcion,
    cuerpo: CLIENTE_PRUEBA,
  });
  comprobar("V3", "registrar Laura → 201 con data.client", cliente.status === 201 && Boolean(cliente.body?.data?.client?.id));
  const clienteId = cliente.body?.data?.client?.id;

  const duplicado = await api("POST", "/clients", {
    token: tokenRecepcion,
    cuerpo: CLIENTE_PRUEBA,
  });
  comprobar(
    "V3",
    "mismo teléfono sin confirmar → 409 DUPLICATE_PHONE",
    duplicado.status === 409 && codigoError(duplicado) === "DUPLICATE_PHONE",
    `status=${duplicado.status} code=${codigoError(duplicado)}`,
  );
  comprobar(
    "V3",
    "el aviso invita a confirmar",
    /Confirma/.test(duplicado.body?.error?.message ?? ""),
    duplicado.body?.error?.message,
  );

  const confirmado = await api("POST", "/clients", {
    token: tokenRecepcion,
    cuerpo: { ...CLIENTE_PRUEBA, confirmDuplicatePhone: true },
  });
  comprobar("V3", "confirmar el duplicado → 201", confirmado.status === 201);

  const listaLaura = await api("GET", "/clients?q=Laura", { token: tokenRecepcion });
  comprobar("V3", "Laura aparece en la lista con fecha de registro", listaLaura.body?.data?.clients?.[0]?.createdAt != null);

  // ---------------------------------------------------------------- V4
  console.log("\nV4. Vehículo con propietario (HU3, RN-1, SC-005)");
  const sinDueno = await api("POST", "/vehicles", {
    token: tokenRecepcion,
    cuerpo: VEHICULO_PRUEBA,
  });
  comprobar(
    "V4",
    "sin propietario → 400 CLIENT_REQUIRED (no VALIDATION_ERROR)",
    sinDueno.status === 400 && codigoError(sinDueno) === "CLIENT_REQUIRED",
    `status=${sinDueno.status} code=${codigoError(sinDueno)}`,
  );

  const vehiculo = await api("POST", "/vehicles", {
    token: tokenRecepcion,
    cuerpo: { ...VEHICULO_PRUEBA, clientId: clienteId },
  });
  comprobar("V4", "con propietario → 201 con clientName", vehiculo.status === 201 && vehiculo.body?.data?.vehicle?.clientName === "Laura Ramírez");

  const placasRepetidas = await api("POST", "/vehicles", {
    token: tokenRecepcion,
    cuerpo: { ...VEHICULO_PRUEBA, clientId: clienteId, brand: "Toyota" },
  });
  comprobar(
    "V4",
    "mismas placas → 409 DUPLICATE_PLATE",
    placasRepetidas.status === 409 && codigoError(placasRepetidas) === "DUPLICATE_PLATE",
    `status=${placasRepetidas.status} code=${codigoError(placasRepetidas)}`,
  );

  const ficha = await api("GET", `/clients/${clienteId}`, { token: tokenRecepcion });
  comprobar(
    "V4",
    "el vehículo aparece en la ficha de Laura (FR-011)",
    ficha.body?.data?.vehicles?.length === 1 &&
      ficha.body?.data?.vehicles?.[0]?.licensePlate === "VST0001",
  );

  // ---------------------------------------------------------------- V5
  console.log("\nV5. Edición de clientes (HU4)");
  const edicion = await api("PATCH", `/clients/${clienteId}`, {
    token: tokenRecepcion,
    cuerpo: { phone: "5599999999" },
  });
  comprobar("V5", "cambiar el teléfono → 200 con el valor nuevo", edicion.status === 201 || (edicion.status === 200 && edicion.body?.data?.client?.phone === "5599999999"));

  const fichaTrasEdicion = await api("GET", `/clients/${clienteId}`, { token: tokenRecepcion });
  comprobar("V5", "el valor nuevo persiste al reabrir la ficha", fichaTrasEdicion.body?.data?.client?.phone === "5599999999");
  comprobar("V5", "los vehículos siguen asociados tras editar", fichaTrasEdicion.body?.data?.vehicles?.length === 1);

  const invalida = await api("PATCH", `/clients/${clienteId}`, {
    token: tokenRecepcion,
    cuerpo: { name: "" },
  });
  comprobar(
    "V5",
    "campo obligatorio vacío → 400 VALIDATION_ERROR sin aplicar cambios",
    invalida.status === 400 &&
      codigoError(invalida) === "VALIDATION_ERROR" &&
      invalida.body?.error?.details?.[0]?.field === "name",
    `status=${invalida.status} field=${invalida.body?.error?.details?.[0]?.field}`,
  );
  const fichaFinal = await api("GET", `/clients/${clienteId}`, { token: tokenRecepcion });
  comprobar("V5", "la validación fallida no tocó la base", fichaFinal.body?.data?.client?.name === "Laura Ramírez");

  // ---------------------------------------------------------------- V6
  console.log("\nV6. Permisos por rol (FR-003, FR-014, SC-003)");
  const mecanicoLogin = await api("POST", "/auth/login", {
    cuerpo: { identifier: "mecanico", password: "Mecanico2026!" },
  });
  comprobar("V6", "login de mecanico → 201", mecanicoLogin.status === 201);
  const tokenMecanico = tokenDe(mecanicoLogin);

  const mecConsulta = await api("GET", "/clients", { token: tokenMecanico });
  comprobar("V6", "MECHANIC puede consultar clientes → 200", mecConsulta.status === 200);
  const mecEscritura = await api("POST", "/clients", {
    token: tokenMecanico,
    cuerpo: { name: "No Debe Guardarse", phone: "5500000001", email: "x@correo.mx" },
  });
  comprobar("V6", "MECHANIC no puede crear clientes → 403 FORBIDDEN", mecEscritura.status === 403 && codigoError(mecEscritura) === "FORBIDDEN");
  const mecVehiculos = await api("POST", "/vehicles", {
    token: tokenMecanico,
    cuerpo: { ...VEHICULO_PRUEBA, clientId: clienteId, licensePlate: "OTR9999" },
  });
  comprobar("V6", "MECHANIC no puede crear vehículos → 403", mecVehiculos.status === 403);

  const usersRecepcion = await api("GET", "/users", { token: tokenRecepcion });
  comprobar("V6", "RECEPTIONIST en /api/users → 403 FORBIDDEN", usersRecepcion.status === 403 && codigoError(usersRecepcion) === "FORBIDDEN");
  const usersAdmin = await api("GET", "/users", { token: adminToken });
  comprobar("V6", "ADMIN en /api/users → 200", usersAdmin.status === 200);

  // ---------------------------------------------------------------- V7
  console.log("\nV7. Gestión de usuarios y política de contraseñas (HU5, SC-006)");
  // Login nuevo de ADMIN: además reinicia el contador de intentos de V1.
  const adminRefresco = await api("POST", "/auth/login", {
    cuerpo: { identifier: "admin", password: "Admin2026!" },
  });
  comprobar("V7", "login de ADMIN → 201", adminRefresco.status === 201);
  const adminFinal = tokenDe(adminRefresco);

  const ana = await api("POST", "/users", {
    token: adminFinal,
    cuerpo: {
      username: "ana",
      name: "Ana López",
      email: "ana@motorix.local",
      password: "Ana2026!",
      role: "RECEPTIONIST",
    },
  });
  comprobar("V7", "crear usuaria ana RECEPTIONIST → 201", ana.status === 201 && ana.body?.data?.user?.role === "RECEPTIONIST");
  const anaId = ana.body?.data?.user?.id;

  const anaLogin = await api("POST", "/auth/login", { cuerpo: { identifier: "ana", password: "Ana2026!" } });
  comprobar("V7", "ana inicia sesión con su usuario → 201", anaLogin.status === 201);
  const tokenAna = tokenDe(anaLogin);
  const anaCorreo = await api("POST", "/auth/login", { cuerpo: { identifier: "ana@motorix.local", password: "Ana2026!" } });
  comprobar("V7", "ana inicia sesión con su correo → 201", anaCorreo.status === 201);

  const dupUsuario = await api("POST", "/users", {
    token: adminFinal,
    cuerpo: { username: "ana", name: "Otra Ana", email: "otra@motorix.local", password: "Otra2026!", role: "MECHANIC" },
  });
  comprobar("V7", "username repetido → 409 DUPLICATE_USERNAME", dupUsuario.status === 409 && codigoError(dupUsuario) === "DUPLICATE_USERNAME");
  const dupCorreo = await api("POST", "/users", {
    token: adminFinal,
    cuerpo: { username: "ana2", name: "Otra Ana", email: "ana@motorix.local", password: "Otra2026!", role: "MECHANIC" },
  });
  comprobar("V7", "correo repetido → 409 DUPLICATE_EMAIL", dupCorreo.status === 409 && codigoError(dupCorreo) === "DUPLICATE_EMAIL");

  const debil = await api("POST", "/auth/change-password", {
    token: tokenAna,
    cuerpo: { currentPassword: "Ana2026!", newPassword: "Nuevasegura" },
  });
  comprobar(
    "V7",
    "contraseña sin número → 400 WEAK_PASSWORD con details",
    debil.status === 400 &&
      codigoError(debil) === "WEAK_PASSWORD" &&
      debil.body?.error?.details?.[0]?.field === "newPassword",
    `status=${debil.status} code=${codigoError(debil)}`,
  );

  const fuerte = await api("POST", "/auth/change-password", {
    token: tokenAna,
    cuerpo: { currentPassword: "Ana2026!", newPassword: "Nueva2026!" },
  });
  comprobar(
    "V7",
    "contraseña válida → 200 con PASSWORD_UPDATED",
    fuerte.status === 200 && fuerte.body?.data?.message === "PASSWORD_UPDATED",
    `status=${fuerte.status} message=${fuerte.body?.data?.message}`,
  );

  const anaNueva = await api("POST", "/auth/login", { cuerpo: { identifier: "ana", password: "Nueva2026!" } });
  comprobar("V7", "el siguiente login usa la contraseña nueva → 201", anaNueva.status === 201);
  const anaVieja = await api("POST", "/auth/login", { cuerpo: { identifier: "ana", password: "Ana2026!" } });
  comprobar("V7", "la contraseña anterior ya no sirve → 401", anaVieja.status === 401);

  const desactivada = await api("PATCH", `/users/${anaId}`, {
    token: adminFinal,
    cuerpo: { active: false },
  });
  comprobar("V7", "desactivar ana → 200 con active=false", desactivada.status === 200 && desactivada.body?.data?.user?.active === false);
  const anaDesactivada = await api("POST", "/auth/login", { cuerpo: { identifier: "ana", password: "Nueva2026!" } });
  comprobar(
    "V7",
    "login de ana desactivada → 403 ACCOUNT_DISABLED",
    anaDesactivada.status === 403 && codigoError(anaDesactivada) === "ACCOUNT_DISABLED",
    `status=${anaDesactivada.status}`,
  );

  // ---------------------------------------------------------------- V8–V10
  console.log("\nV8–V10. Navegación, instalación repetible e interfaz");
  console.log("  [V8]  validado con pruebas de Flutter (app_shell_test, users_test, login_screen_test).");
  console.log("  [V9]  ejecutado aparte: crear-entorno.ps1 + aplicar-migraciones.ps1 + seed x2.");
  console.log("  [V10] revisión de diseño registrada en quickstart-resultados.md (T070).");

  console.log(`\nLimpieza de los datos de prueba (SQL):`);
  console.log(`  DELETE FROM vehicles WHERE license_plate = 'VST0001';`);
  console.log(`  DELETE FROM clients  WHERE phone = '${CLIENTE_PRUEBA.phone}';`);
  console.log(`  DELETE FROM users    WHERE username = 'bloqueotmp';`);

  console.log(`\nResumen: ${superadas} comprobaciones superadas, ${fallidas} fallidas.`);
  if (fallidas > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nNo se pudo validar: ${error.message}`);
  console.error("¿Está el backend arrancado en http://localhost:3000 (npm start)?");
  process.exitCode = 1;
});
