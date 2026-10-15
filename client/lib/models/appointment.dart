/// Modelo de cita (contrato: contracts/appointments.md → data.appointment).
class Appointment {
  const Appointment({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.vehicleId,
    required this.vehicleLabel,
    required this.date,
    required this.time,
    required this.reason,
    required this.status,
    this.notes,
    this.createdAt,
    this.updatedAt,
  });

  final int id;
  final int clientId;
  final String clientName;
  final int vehicleId;
  final String vehicleLabel;
  final String date;
  final String time;
  final String reason;
  final String? notes;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
        id: (json['id'] as num).toInt(),
        clientId: (json['clientId'] as num).toInt(),
        clientName: json['clientName'] as String? ?? '',
        vehicleId: (json['vehicleId'] as num).toInt(),
        vehicleLabel: json['vehicleLabel'] as String? ?? '',
        date: json['date'] as String,
        time: json['time'] as String,
        reason: json['reason'] as String,
        notes: json['notes'] as String?,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'clientId': clientId,
        'clientName': clientName,
        'vehicleId': vehicleId,
        'vehicleLabel': vehicleLabel,
        'date': date,
        'time': time,
        'reason': reason,
        'notes': notes,
        'status': status,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
      };

  /// Etiquetas en español de los estados (contrato appointments.md).
  static const Map<String, String> etiquetas = {
    'PENDING': 'Pendiente',
    'CONFIRMED': 'Confirmada',
    'IN_PROGRESS': 'En proceso',
    'COMPLETED': 'Completada',
    'CANCELED': 'Cancelada',
  };

  String get etiquetaEstado => etiquetas[status] ?? status;

  /// true si la cita sigue en un estado activo (se puede editar o cancelar).
  bool get estaCerrada => status == 'COMPLETED' || status == 'CANCELED';
}
