import 'package:flutter_test/flutter_test.dart';

import 'package:motorix_client/models/audit_entry.dart';
import 'package:motorix_client/utils/date_format.dart';

// Hallazgo H-05 del Sprint 7: la interfaz muestra fechas legibles y la bitácora
// no expone claves técnicas.

AuditEntry _entrada(String? detalle) => AuditEntry.fromJson({
      'id': 1,
      'createdAt': '2026-11-25T09:58:17',
      'userId': 1,
      'actor': 'admin',
      'action': 'SETTINGS_UPDATED',
      'detail': detalle,
    });

void main() {
  group('fechaHoraLegible', () {
    test('convierte una fecha ISO a dd/mm/aaaa hh:mm', () {
      expect(fechaHoraLegible('2026-11-25T09:58:17'), '25/11/2026 09:58');
      expect(fechaHoraLegible('2026-01-02 23:05:00'), '02/01/2026 23:05');
    });

    test('devuelve vacío con null y no altera un texto que no es fecha', () {
      expect(fechaHoraLegible(null), '');
      expect(fechaHoraLegible(''), '');
      expect(fechaHoraLegible('sin fecha registrada'), 'sin fecha registrada');
    });
  });

  group('AuditEntry.detalleLegible', () {
    test('traduce las claves de la configuración y conserva los valores', () {
      expect(
        _entrada('campo: shop.name; anterior: Taller Motorix; nuevo: Taller Evidencia')
            .detalleLegible,
        'campo: Nombre del taller; anterior: Taller Motorix; nuevo: Taller Evidencia',
      );
      expect(
        _entrada('campo: maintenance.warn_km; anterior: 500; nuevo: 800').detalleLegible,
        'campo: Kilómetros de antelación; anterior: 500; nuevo: 800',
      );
    });

    test('traduce el cambio de rol, el rol de un alta y el método de pago', () {
      expect(
        _entrada('campo: role; anterior: MECHANIC; nuevo: ADMIN').detalleLegible,
        'campo: Rol; anterior: Mecánico; nuevo: Administrador',
      );
      expect(_entrada('rol: RECEPTIONIST').detalleLegible, 'rol: Recepción');
      expect(
        _entrada('orden: 5; método: MERCADO_PAGO; importe: 100.00').detalleLegible,
        'orden: 5; método: Mercado Pago; importe: 100.00',
      );
    });

    test('no traduce valores escritos por una persona que parecen una clave', () {
      expect(
        _entrada('campo: shop.name; anterior: ADMIN; nuevo: role').detalleLegible,
        'campo: Nombre del taller; anterior: ADMIN; nuevo: role',
      );
    });

    test('un detalle vacío o desconocido se muestra tal cual', () {
      expect(_entrada(null).detalleLegible, '');
      expect(_entrada('usuario: mecanico').detalleLegible, 'usuario: mecanico');
      expect(_entrada('algo sin formato').detalleLegible, 'algo sin formato');
    });

    test('la fecha del registro usa el mismo formato', () {
      expect(_entrada(null).fechaLegible, '25/11/2026 09:58');
    });
  });
}
