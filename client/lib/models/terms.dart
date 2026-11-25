/// Versión vigente de los términos y del aviso de privacidad (Sprint 7, US9,
/// contracts/terms.md).
class TermsVersion {
  const TermsVersion({
    required this.version,
    required this.termsText,
    required this.privacyText,
    this.publishedAt,
    this.accepted = false,
  });

  final int version;
  final String termsText;
  final String privacyText;
  final String? publishedAt;

  /// Si el usuario de la sesión ya aceptó esta versión.
  final bool accepted;

  factory TermsVersion.fromJson(Map<String, dynamic> json) => TermsVersion(
        version: (json['version'] as num).toInt(),
        termsText: json['termsText'] as String? ?? '',
        privacyText: json['privacyText'] as String? ?? '',
        publishedAt: json['publishedAt'] as String?,
        accepted: json['accepted'] as bool? ?? false,
      );
}

/// Constancia de aceptación de un usuario.
class TermsAcceptance {
  const TermsAcceptance({
    required this.userId,
    required this.username,
    required this.name,
    this.acceptedAt,
  });

  final int userId;
  final String username;
  final String name;
  final String? acceptedAt;

  factory TermsAcceptance.fromJson(Map<String, dynamic> json) => TermsAcceptance(
        userId: (json['userId'] as num).toInt(),
        username: json['username'] as String? ?? '',
        name: json['name'] as String? ?? '',
        acceptedAt: json['acceptedAt'] as String?,
      );
}

/// Usuario activo que aún no acepta la versión consultada.
class TermsPendingUser {
  const TermsPendingUser({
    required this.userId,
    required this.username,
    required this.name,
  });

  final int userId;
  final String username;
  final String name;

  factory TermsPendingUser.fromJson(Map<String, dynamic> json) => TermsPendingUser(
        userId: (json['userId'] as num).toInt(),
        username: json['username'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );
}

/// Página de aceptaciones de una versión más los usuarios pendientes.
class TermsAcceptancesPage {
  const TermsAcceptancesPage({
    required this.version,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.items,
    required this.pendingUsers,
  });

  final int version;
  final int page;
  final int pageSize;
  final int total;
  final List<TermsAcceptance> items;
  final List<TermsPendingUser> pendingUsers;

  int get totalPaginas => total == 0 ? 1 : ((total + pageSize - 1) ~/ pageSize);

  factory TermsAcceptancesPage.fromJson(Map<String, dynamic> json) =>
      TermsAcceptancesPage(
        version: (json['version'] as num).toInt(),
        page: (json['page'] as num?)?.toInt() ?? 1,
        pageSize: (json['pageSize'] as num?)?.toInt() ?? 50,
        total: (json['total'] as num?)?.toInt() ?? 0,
        items: [
          for (final e in (json['items'] as List? ?? const []))
            TermsAcceptance.fromJson(Map<String, dynamic>.from(e as Map)),
        ],
        pendingUsers: [
          for (final e in (json['pendingUsers'] as List? ?? const []))
            TermsPendingUser.fromJson(Map<String, dynamic>.from(e as Map)),
        ],
      );
}
