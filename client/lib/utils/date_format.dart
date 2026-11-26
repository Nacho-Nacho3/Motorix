/// Fecha y hora legibles para la interfaz: `2026-11-25T09:58:17` se muestra como
/// `25/11/2026 09:58`. Los textos que no tengan ese formato se devuelven tal
/// cual y `null` como cadena vacía.
String fechaHoraLegible(String? iso) {
  if (iso == null) return '';
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}').hasMatch(iso)) return iso;
  return '${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)} '
      '${iso.substring(11, 16)}';
}
