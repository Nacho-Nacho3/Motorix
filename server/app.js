import express from "express";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { rutas } from "./routes/index.js";
import { errorHandler, noEncontrado } from "./middlewares/errorHandler.js";

// T013: app Express con montaje de /api, 404 y errorHandler global.
export const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, data: { status: "ok", servicio: "motorix-api" } });
});

app.use("/api", rutas);

app.use(noEncontrado);
app.use(errorHandler);

const esEjecucionDirecta =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (esEjecucionDirecta) {
  app.listen(env.port, () => {
    console.log(`Motorix API escuchando en http://localhost:${env.port}`);
  });
}
