-- T003: tabla de pagos (Payment de data-model.md, Sprint 4, FR-001 a FR-005).
-- RN-13: todo pago pertenece a una orden (order_id NOT NULL, sin pagos huérfanos).
-- RN-14: sin columnas de tarjeta ni datos sensibles; external_reference guarda solo
-- la referencia del proveedor (Mercado Pago).
-- amount > 0 se valida en backend y aqui con CHECK (Q1: importe = total, sin parciales).
-- status: PENDING/PAID/REJECTED/CANCELLED; la maquina de estados vive en el backend
-- (payments.service.js); un solo PAID y un solo PENDING por orden se validan en
-- transaccion con bloqueo de fila (VN-04/VN-05).
-- created_by: quien registro el cobro. Sin DELETE (libro de auditoria).
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('CASH','CARD','TRANSFER','MERCADO_PAGO') NOT NULL,
  status ENUM('PENDING','PAID','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  external_reference VARCHAR(100) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (amount > 0),
  KEY idx_payments_order_id (order_id),
  KEY idx_payments_status (status),
  KEY idx_payments_external_reference (external_reference),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES service_orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
