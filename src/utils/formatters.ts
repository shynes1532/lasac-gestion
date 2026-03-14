// ============================================================
// Formatters - LASAC APP / Liendo Automotores
// ============================================================

/**
 * Formatea una fecha a DD/MM/YYYY.
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha a DD/MM/YYYY HH:mm.
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formatea una hora a HH:mm.
 * Acepta formatos como "14:30:00", "14:30", "1430".
 */
export function formatTime(time: string): string {
  const cleaned = time.replace(/[:\s]/g, "");

  if (cleaned.length >= 4) {
    const hours = cleaned.slice(0, 2);
    const minutes = cleaned.slice(2, 4);
    return `${hours}:${minutes}`;
  }

  return time;
}

/**
 * Formatea un teléfono para mostrar en pantalla.
 * Ejemplo: "5492964123456" -> "+54 9 2964 12-3456"
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");

  if (cleaned.startsWith("549") && cleaned.length >= 13) {
    const codigoArea = cleaned.slice(3, 7);
    const parte1 = cleaned.slice(7, 9);
    const parte2 = cleaned.slice(9);
    return `+54 9 ${codigoArea} ${parte1}-${parte2}`;
  }

  if (cleaned.startsWith("54") && cleaned.length >= 12) {
    const codigoArea = cleaned.slice(2, 6);
    const parte1 = cleaned.slice(6, 8);
    const parte2 = cleaned.slice(8);
    return `+54 ${codigoArea} ${parte1}-${parte2}`;
  }

  return phone;
}

/**
 * Calcula la cantidad de días entre dos fechas.
 * Si no se pasa fecha2, usa la fecha actual.
 */
export function diasEntre(fecha1: string, fecha2?: string): number {
  const d1 = new Date(fecha1);
  const d2 = fecha2 ? new Date(fecha2) : new Date();

  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Capitaliza la primera letra de un string.
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
