// ============================================================
// Validators - LASAC APP / Liendo Automotores
// ============================================================

/**
 * Valida un DNI argentino (7 u 8 dígitos numéricos).
 */
export function isValidDNI(dni: string): boolean {
  const cleaned = dni.replace(/\./g, "").trim();
  return /^\d{7,8}$/.test(cleaned);
}

/**
 * Valida un CUIL/CUIT argentino.
 * Formato: XX-XXXXXXXX-X (11 dígitos).
 * Acepta con o sin guiones.
 */
export function isValidCUIL(cuil: string): boolean {
  const cleaned = cuil.replace(/-/g, "").trim();

  if (!/^\d{11}$/.test(cleaned)) {
    return false;
  }

  // Validar prefijo (20, 23, 24, 27, 30, 33, 34)
  const prefijo = parseInt(cleaned.slice(0, 2), 10);
  const prefijosValidos = [20, 23, 24, 27, 30, 33, 34];
  if (!prefijosValidos.includes(prefijo)) {
    return false;
  }

  // Validar dígito verificador
  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(cleaned[i], 10) * multiplicadores[i];
  }

  const resto = suma % 11;
  const digitoCalculado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  const digitoVerificador = parseInt(cleaned[10], 10);

  return digitoCalculado === digitoVerificador;
}

/**
 * Valida un VIN (Vehicle Identification Number).
 * 17 caracteres alfanuméricos, sin I, O ni Q.
 */
export function isValidVIN(vin: string): boolean {
  const cleaned = vin.trim().toUpperCase();
  if (cleaned.length !== 17) {
    return false;
  }
  // VIN no puede contener I, O, Q
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned);
}

/**
 * Valida un número de teléfono argentino.
 * Acepta formatos:
 *   - 2964123456
 *   - 02964123456
 *   - 5492964123456
 *   - +54 9 2964 12-3456
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");

  // Solo dígitos
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Número local (10 dígitos sin prefijo internacional)
  if (cleaned.length === 10 && !cleaned.startsWith("0")) {
    return true;
  }

  // Número con 0 adelante (11 dígitos)
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return true;
  }

  // Número con 54 (12 dígitos)
  if (cleaned.length === 12 && cleaned.startsWith("54")) {
    return true;
  }

  // Número con 549 (13 dígitos, celular)
  if (cleaned.length === 13 && cleaned.startsWith("549")) {
    return true;
  }

  return false;
}

/**
 * Valida un email con regex estándar.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(trimmed);
}
