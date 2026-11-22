-- T004: tablas de notificaciones internas (Sprint 6, data-model.md, FR-002,
-- FR-006 y FR-011).
-- notification_reads: unica persistencia del centro de avisos. Guarda QUIEN
-- leyo y QUE clave (D-04: tipo:objeto:estado); el aviso en si no se almacena:
-- se calcula en cada consulta (RN-10). Clave unica (user_id, notification_key)
-- = idempotencia del POST de lectura (P-7) y fuente del unreadCount. user_id
-- con CASCADE: las lecturas solo tienen sentido para su usuario. Sin DELETE:
-- la lectura es un hecho.
-- client_notices: registro de que recepcion contacto a un cliente por un hecho
-- concreto (CA-11, D-07). Clave unica (client_id, notice_type, source_id) =
-- "una vez por hecho" garantizada en la base. source_id es polymorphic (orden,
-- cita o mantenimiento) y se valida en el servicio. notes opcional (D-07).
-- Sin DELETE: evento constancia.
CREATE TABLE IF NOT EXISTS notification_reads (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  notification_key VARCHAR(100) NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notification_reads_user_key (user_id, notification_key),
  CONSTRAINT fk_notification_reads_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_notices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  notice_type VARCHAR(40) NOT NULL,
  source_id INT UNSIGNED NOT NULL,
  notes VARCHAR(300) NULL,
  notified_by INT UNSIGNED NOT NULL,
  notified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_notices_source (client_id, notice_type, source_id),
  KEY idx_client_notices_client (client_id),
  CONSTRAINT fk_client_notices_client FOREIGN KEY (client_id)
    REFERENCES clients (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_client_notices_user FOREIGN KEY (notified_by)
    REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
