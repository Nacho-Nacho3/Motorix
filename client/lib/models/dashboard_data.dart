// Modelos del panel de control (US5/US6) contra
// specs/004-pagos-tickets-dashboard/contracts/dashboard.md: el resumen de los
// 8 indicadores y el detalle de las 4 secciones viajan en la MISMA respuesta.
import 'appointment.dart';
import 'service_order.dart';

/// Resumen del panel de control (contrato: `summary`).
///
/// Los 8 indicadores del taller (FR-012, CA-6) llegan calculados por el
/// backend en cada consulta (RN-10): aquí solo se representan, con sus
/// etiquetas en español para las tarjetas del panel. Las secciones de
/// detalle (US6) están en `DetallePanel`, del MISMO JSON de la misma
/// respuesta (SC-007).
class ResumenPanel {
  const ResumenPanel({
    required this.vehiclesAttended,
    required this.vehiclesInRepair,
    required this.ordersPending,
    required this.ordersFinished,
    required this.nextAppointments,
    required this.upcomingMaintenances,
    required this.overdueMaintenances,
    required this.lowStockCount,
  });

  final int vehiclesAttended;
  final int vehiclesInRepair;
  final int ordersPending;
  final int ordersFinished;
  final int nextAppointments;
  final int upcomingMaintenances;
  final int overdueMaintenances;
  final int lowStockCount;

  /// Etiquetas en español de los 8 indicadores, en orden de presentación
  /// (FR-012). La clave es el campo del contrato `summary`.
  static const etiquetas = <String, String>{
    'vehiclesAttended': 'Vehículos atendidos',
    'vehiclesInRepair': 'Vehículos en reparación',
    'ordersPending': 'Órdenes pendientes',
    'ordersFinished': 'Órdenes terminadas',
    'nextAppointments': 'Próximas citas',
    'upcomingMaintenances': 'Mantenimientos próximos',
    'overdueMaintenances': 'Mantenimientos vencidos',
    'lowStockCount': 'Refacciones con stock bajo',
  };

  /// Indicadores como (etiqueta en español, valor) en orden de presentación.
  List<(String, int)> get indicadores => [
        (etiquetas['vehiclesAttended']!, vehiclesAttended),
        (etiquetas['vehiclesInRepair']!, vehiclesInRepair),
        (etiquetas['ordersPending']!, ordersPending),
        (etiquetas['ordersFinished']!, ordersFinished),
        (etiquetas['nextAppointments']!, nextAppointments),
        (etiquetas['upcomingMaintenances']!, upcomingMaintenances),
        (etiquetas['overdueMaintenances']!, overdueMaintenances),
        (etiquetas['lowStockCount']!, lowStockCount),
      ];

  /// Suma de los 8 contadores: 0 = taller aún sin actividad (escenario 3).
  int get totalActividad => vehiclesAttended +
      vehiclesInRepair +
      ordersPending +
      ordersFinished +
      nextAppointments +
      upcomingMaintenances +
      overdueMaintenances +
      lowStockCount;

  factory ResumenPanel.fromJson(Map<String, dynamic> json) => ResumenPanel(
        vehiclesAttended: _entero(json['vehiclesAttended']),
        vehiclesInRepair: _entero(json['vehiclesInRepair']),
        ordersPending: _entero(json['ordersPending']),
        ordersFinished: _entero(json['ordersFinished']),
        nextAppointments: _entero(json['nextAppointments']),
        upcomingMaintenances: _entero(json['upcomingMaintenances']),
        overdueMaintenances: _entero(json['overdueMaintenances']),
        lowStockCount: _entero(json['lowStockCount']),
      );
}

int _entero(dynamic valor) => (valor as num?)?.toInt() ?? 0;

/// Orden reciente del panel (contrato `recentOrders`, US6 T062).
class OrdenReciente {
  const OrdenReciente({
    required this.id,
    required this.clientName,
    required this.vehicleLabel,
    required this.status,
    required this.total,
    required this.updatedAt,
  });

  final int id;
  final String clientName;
  final String vehicleLabel;
  final String status;

  /// Total calculado por el backend con la fórmula R-03 (2 decimales).
  final String total;
  final String updatedAt;

  String get etiquetaEstado => ServiceOrder.etiquetas[status] ?? status;

  factory OrdenReciente.fromJson(Map<String, dynamic> json) => OrdenReciente(
        id: _entero(json['id']),
        clientName: json['clientName'] as String? ?? '',
        vehicleLabel: json['vehicleLabel'] as String? ?? '',
        status: json['status'] as String? ?? '',
        total: json['total'] as String? ?? '0.00',
        updatedAt: json['updatedAt'] as String? ?? '',
      );
}

/// Cita próxima del panel (contrato `nextAppointments`, US6 T062).
class CitaProxima {
  const CitaProxima({
    required this.id,
    required this.clientName,
    required this.vehicleLabel,
    required this.appointmentDate,
    required this.appointmentTime,
    required this.reason,
    required this.status,
  });

  final int id;
  final String clientName;
  final String vehicleLabel;
  final String appointmentDate;
  final String appointmentTime;
  final String reason;
  final String status;

  String get etiquetaEstado => Appointment.etiquetas[status] ?? status;

  /// Hora sin los segundos ('10:00:00' → '10:00') para la tarjeta compacta.
  String get horaCorta => appointmentTime.length >= 5
      ? appointmentTime.substring(0, 5)
      : appointmentTime;

  factory CitaProxima.fromJson(Map<String, dynamic> json) => CitaProxima(
        id: _entero(json['id']),
        clientName: json['clientName'] as String? ?? '',
        vehicleLabel: json['vehicleLabel'] as String? ?? '',
        appointmentDate: json['appointmentDate'] as String? ?? '',
        appointmentTime: json['appointmentTime'] as String? ?? '',
        reason: json['reason'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );
}

/// Mantenimiento del panel (contrato `maintenances.*`, US6 T062): llega con
/// los días y kilómetros restantes ya calculados por el backend con la MISMA
/// regla que la lista del módulo (RN-10).
class MantenimientoDetalle {
  const MantenimientoDetalle({
    required this.id,
    required this.vehicleLabel,
    required this.clientName,
    required this.nextDueDate,
    required this.nextDueMileage,
    required this.daysRemaining,
    required this.mileageRemaining,
  });

  final int id;
  final String vehicleLabel;
  final String clientName;
  final String? nextDueDate;
  final int? nextDueMileage;
  final int? daysRemaining;
  final int? mileageRemaining;

  factory MantenimientoDetalle.fromJson(Map<String, dynamic> json) =>
      MantenimientoDetalle(
        id: _entero(json['id']),
        vehicleLabel: json['vehicleLabel'] as String? ?? '',
        clientName: json['clientName'] as String? ?? '',
        nextDueDate: json['nextDueDate'] as String?,
        nextDueMileage: (json['nextDueMileage'] as num?)?.toInt(),
        daysRemaining: (json['daysRemaining'] as num?)?.toInt(),
        mileageRemaining: (json['mileageRemaining'] as num?)?.toInt(),
      );
}

/// Refacción en alerta (contrato `lowStockParts`, US6 T062).
class RefaccionAlerta {
  const RefaccionAlerta({
    required this.id,
    required this.partCode,
    required this.name,
    required this.stockCurrent,
    required this.stockMin,
  });

  final int id;
  final String partCode;
  final String name;
  final int stockCurrent;
  final int stockMin;

  factory RefaccionAlerta.fromJson(Map<String, dynamic> json) =>
      RefaccionAlerta(
        id: _entero(json['id']),
        partCode: json['partCode'] as String? ?? '',
        name: json['name'] as String? ?? '',
        stockCurrent: _entero(json['stockCurrent']),
        stockMin: _entero(json['stockMin']),
      );
}

/// Detalle de las 4 secciones del panel, en la MISMA respuesta que el
/// `summary` (SC-007, RN-10). Con el taller vacío, todas las listas vienen
/// vacías y cada sección muestra su estado vacío.
class DetallePanel {
  const DetallePanel({
    required this.ordenes,
    required this.citas,
    required this.mantenimientosPorVencer,
    required this.mantenimientosVencidos,
    required this.alertasStock,
  });

  /// Últimas 5 órdenes por fecha de actualización.
  final List<OrdenReciente> ordenes;

  /// Próximas 5 citas vigentes.
  final List<CitaProxima> citas;

  /// Próximos 5 mantenimientos (orden de urgencia del módulo).
  final List<MantenimientoDetalle> mantenimientosPorVencer;

  /// Mantenimientos vencidos, todos.
  final List<MantenimientoDetalle> mantenimientosVencidos;

  /// Refacciones con stock bajo, todas.
  final List<RefaccionAlerta> alertasStock;

  factory DetallePanel.fromJson(Map<String, dynamic> json) {
    final mantenimientos =
        (json['maintenances'] as Map?)?.cast<String, dynamic>() ??
            <String, dynamic>{};
    return DetallePanel(
      ordenes: _lista(json['recentOrders'], OrdenReciente.fromJson),
      citas: _lista(json['nextAppointments'], CitaProxima.fromJson),
      mantenimientosPorVencer:
          _lista(mantenimientos['upcoming'], MantenimientoDetalle.fromJson),
      mantenimientosVencidos:
          _lista(mantenimientos['overdue'], MantenimientoDetalle.fromJson),
      alertasStock: _lista(json['lowStockParts'], RefaccionAlerta.fromJson),
    );
  }
}

/// Convierte una lista de objetos del contrato; cualquier forma distinta a
/// lista u objeto se trata como vacía (el panel nunca se rompe por un dato).
List<T> _lista<T>(dynamic valor, T Function(Map<String, dynamic>) deJson) {
  if (valor is! List) return <T>[];
  return valor
      .map((fila) => deJson((fila as Map).cast<String, dynamic>()))
      .toList();
}
