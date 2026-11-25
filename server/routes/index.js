import { Router } from "express";
import { rutasAuth } from "./auth.routes.js";
import { rutasClients } from "./clients.routes.js";
import { rutasUsers } from "./users.routes.js";
import { rutasVehicles } from "./vehicles.routes.js";
import { rutasAppointments } from "./appointments.routes.js";
import { rutasServiceOrders } from "./service_orders.routes.js";
import { rutasHistory } from "./history.routes.js";
import { rutasMaintenances } from "./maintenances.routes.js";
import { rutasParts } from "./parts.routes.js";
import { rutasPayments } from "./payments.routes.js";
import { rutasTickets } from "./tickets.routes.js";
import { rutasDashboard } from "./dashboard.routes.js";
import { rutasNotifications } from "./notifications.routes.js";
import { rutasClientNotices } from "./client_notices.routes.js";
import { rutasSettings } from "./settings.routes.js";
import { rutasServiceTypes } from "./service_types.routes.js";
import { rutasTerms } from "./terms.routes.js";
import { rutasAudit } from "./audit.routes.js";
import { rutasReports } from "./reports.routes.js";

// T013: registro central de rutas. Cada historia añade su router aquí.
export const rutas = Router();

rutas.use("/auth", rutasAuth);
rutas.use("/clients", rutasClients);
rutas.use("/users", rutasUsers);
rutas.use("/vehicles", rutasVehicles);
rutas.use("/vehicles", rutasHistory); // T014: GET /api/vehicles/:id/history
rutas.use("/appointments", rutasAppointments);
rutas.use("/service-orders", rutasServiceOrders);
rutas.use("/maintenances", rutasMaintenances); // T027: GET/POST /api/maintenances
rutas.use("/parts", rutasParts); // T048: GET/POST /api/parts y PATCH /api/parts/:id
rutas.use("/service-orders", rutasPayments); // T016: total y pagos de la orden (Sprint 4)
rutas.use("/service-orders", rutasTickets); // T036: ticket de la orden (US3)
rutas.use("/dashboard", rutasDashboard); // T054: panel exclusivo de ADMIN (US5)
rutas.use("/notifications", rutasNotifications); // T015: centro de avisos (Sprint 6)
rutas.use("/client-notices", rutasClientNotices); // T055: clientes por avisar (Sprint 6, US7)
rutas.use("/settings", rutasSettings); // T026: configuración del taller (Sprint 7, US1)
rutas.use("/service-types", rutasServiceTypes); // T049: catálogo de tipos de servicio (Sprint 7, US3)
rutas.use("/terms", rutasTerms); // T072: términos y aviso de privacidad (Sprint 7, US9)
rutas.use("/audit-log", rutasAudit); // T090: bitácora de solo lectura (Sprint 7, US10)
rutas.use("/reports", rutasReports); // T099: reportes de solo lectura (Sprint 7, US4)
