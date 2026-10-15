-- T004: tabla de tickets (Ticket de data-model.md, Sprint 4, FR-009 a FR-011).
-- order_id UNIQUE: un ticket por orden (FR-011); reabrir o reimprimir devuelve el
-- mismo ticket y folio, sin duplicados.
-- El folio se deriva del id (TCK-{id:06d}) al servirlo: sin columna ni contador
-- (R-05). El desglose NO se almacena: se calcula desde la orden y sus pagos (RN-10).
-- issued_by: quien emitio el comprobante. Sin DELETE.
CREATE TABLE IF NOT EXISTS tickets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  issued_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tickets_order_id (order_id),
  CONSTRAINT fk_tickets_order FOREIGN KEY (order_id) REFERENCES service_orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tickets_issued_by FOREIGN KEY (issued_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
