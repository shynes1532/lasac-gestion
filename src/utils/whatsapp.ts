// ============================================================
// WhatsApp Utilities - LASAC APP / Liendo Automotores
// ============================================================

// --- Enums ---

export const WhatsAppTemplate = {
  CONFIRMACION_ENTREGA: 'CONFIRMACION_ENTREGA',
  RECORDATORIO_24H: 'RECORDATORIO_24H',
  BIENVENIDA_POST_ENTREGA: 'BIENVENIDA_POST_ENTREGA',
  ENCUESTA_CSI: 'ENCUESTA_CSI',
  SEGUIMIENTO_T7: 'SEGUIMIENTO_T7',
  AVISO_PENDIENTE: 'AVISO_PENDIENTE',
} as const

export type WhatsAppTemplateType = typeof WhatsAppTemplate[keyof typeof WhatsAppTemplate]

// --- Interfaces ---

export interface ConfirmacionEntregaData {
  nombre: string;
  modelo: string;
  color: string;
  fecha: string;
  hora: string;
  sucursal: string;
  asesor: string;
}

export interface Recordatorio24hData {
  nombre: string;
  fecha: string;
  hora: string;
  modelo: string;
  sucursal: string;
}

export interface BienvenidaPostEntregaData {
  nombre: string;
  modelo: string;
  color: string;
  asesor: string;
}

export interface EncuestaCSIData {
  nombre: string;
  modelo: string;
}

export interface SeguimientoT7Data {
  nombre: string;
  modelo: string;
  asesor: string;
  sucursal: string;
}

export interface AvisoPendienteData {
  nombre: string;
  compromiso: string;
  asesor: string;
  sucursal: string;
}

// --- Función base ---

/**
 * Limpia un número de teléfono argentino y genera un link de WhatsApp.
 *
 * - Quita espacios, guiones, paréntesis y "+".
 * - Si empieza con "0" lo reemplaza por "549".
 * - Si no tiene prefijo "549" lo antepone.
 */
export function cleanPhone(telefono: string): string {
  let cleaned = telefono.replace(/[\s\-\(\)\+]/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "549" + cleaned.slice(1);
  }

  if (!cleaned.startsWith("549")) {
    cleaned = "549" + cleaned;
  }

  return cleaned;
}

export function generateWhatsAppLink(telefono: string, mensaje: string): string {
  const phone = cleanPhone(telefono);
  const encodedMessage = encodeURIComponent(mensaje);
  return `https://wa.me/${phone}?text=${encodedMessage}`;
}

// --- Template functions ---

export function waConfirmacionEntrega(data: ConfirmacionEntregaData): string {
  const { nombre, modelo, color, fecha, hora, sucursal, asesor } = data;
  return (
    `Hola ${nombre}! \u{1F44B} Te confirmamos la entrega de tu ${modelo} ${color} ` +
    `para el d\u00EDa ${fecha} a las ${hora} en nuestra sucursal de ${sucursal}. ` +
    `Tu asesor ser\u00E1 ${asesor}. ` +
    `Por favor tra\u00E9: DNI original, comprobante de seguro vigente. ` +
    `\u00A1Te esperamos! \u{1F697} - Liendo Automotores`
  );
}

export function waRecordatorio24h(data: Recordatorio24hData): string {
  const { nombre, fecha, hora, modelo, sucursal } = data;
  return (
    `Hola ${nombre}! Te recordamos que ma\u00F1ana ${fecha} a las ${hora} ` +
    `es la entrega de tu ${modelo}. ` +
    `Record\u00E1 traer: \u2705 DNI original \u2705 Comprobante de seguro vigente ` +
    `\u2705 Forma de pago del saldo (si aplica). ` +
    `Cualquier consulta escribinos. \u00A1Nos vemos! - Liendo Automotores ${sucursal}`
  );
}

export function waBienvenidaPostEntrega(data: BienvenidaPostEntregaData): string {
  const { nombre, modelo, color, asesor } = data;
  return (
    `\u00A1Felicitaciones ${nombre}! \u{1F389} Ya sos parte de la familia FIAT. ` +
    `Tu ${modelo} ${color} ya es tuyo. ` +
    `Ante cualquier consulta, tu asesor ${asesor} est\u00E1 a disposici\u00F3n. ` +
    `\u00A1Disfrut\u00E1 tu FIAT! \u{1F697} - Liendo Automotores`
  );
}

export function waEncuestaCSI(data: EncuestaCSIData): string {
  const { nombre, modelo } = data;
  return (
    `Hola ${nombre}! Queremos saber c\u00F3mo fue tu experiencia con la entrega de tu ${modelo}. ` +
    `\u00BFPod\u00E9s completar esta breve encuesta? Nos ayuda mucho a mejorar: ` +
    `https://docs.google.com/forms/d/e/1FAIpQLSdW-MGx5YdZ7yPYG28YSM0RB92URIc_4pZo_LBNVg-DFM5qTg/viewform ` +
    `\u00A1Muchas gracias! - Liendo Automotores`
  );
}

export function waSeguimientoT7(data: SeguimientoT7Data): string {
  const { nombre, modelo, asesor, sucursal } = data;
  return (
    `Hola ${nombre}! Ya pas\u00F3 una semana con tu ${modelo}. ` +
    `\u00BFC\u00F3mo viene todo? \u00BFAlguna consulta sobre el veh\u00EDculo? ` +
    `Estamos para ayudarte. - ${asesor}, Liendo Automotores ${sucursal}`
  );
}

export function waAvisoPendiente(data: AvisoPendienteData): string {
  const { nombre, compromiso, asesor, sucursal } = data;
  return (
    `Hola ${nombre}! Te escribimos de Liendo Automotores para recordarte sobre: ${compromiso}. ` +
    `Contactanos para coordinar. - ${asesor}, Liendo Automotores ${sucursal}`
  );
}

// --- Helper: genera link directo desde template ---

export function generateTemplateLink(
  telefono: string,
  template: WhatsAppTemplateType,
  data: ConfirmacionEntregaData | Recordatorio24hData | BienvenidaPostEntregaData | EncuestaCSIData | SeguimientoT7Data | AvisoPendienteData,
): string {
  let mensaje: string;

  switch (template) {
    case WhatsAppTemplate.CONFIRMACION_ENTREGA:
      mensaje = waConfirmacionEntrega(data as ConfirmacionEntregaData);
      break;
    case WhatsAppTemplate.RECORDATORIO_24H:
      mensaje = waRecordatorio24h(data as Recordatorio24hData);
      break;
    case WhatsAppTemplate.BIENVENIDA_POST_ENTREGA:
      mensaje = waBienvenidaPostEntrega(data as BienvenidaPostEntregaData);
      break;
    case WhatsAppTemplate.ENCUESTA_CSI:
      mensaje = waEncuestaCSI(data as EncuestaCSIData);
      break;
    case WhatsAppTemplate.SEGUIMIENTO_T7:
      mensaje = waSeguimientoT7(data as SeguimientoT7Data);
      break;
    case WhatsAppTemplate.AVISO_PENDIENTE:
      mensaje = waAvisoPendiente(data as AvisoPendienteData);
      break;
    default:
      throw new Error(`Template desconocido: ${template}`);
  }

  return generateWhatsAppLink(telefono, mensaje);
}
