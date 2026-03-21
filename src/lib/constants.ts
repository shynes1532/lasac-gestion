import type {
  EstadoGestoria,
  EstadoAlistamiento,
  EstadoActual,
  TipoOperacion,
  Sucursal,
  RolUsuario,
  ChecklistDocItem,
  ChecklistPDIItem,
  BancoEntidad,
  FormaPago,
  Semaforo,
} from './types'

// ============================================================
// Tipos de operación
// ============================================================

export const TIPOS_OPERACION: { value: TipoOperacion; label: string }[] = [
  { value: '0km', label: '0 KM' },
  { value: 'usados', label: 'Usado' },
  { value: 'plan_ahorro', label: 'Plan de Ahorro' },
]

export const FORMAS_PAGO: { value: FormaPago; label: string }[] = [
  { value: 'contado', label: 'Contado' },
  { value: 'financiado_banco', label: 'Financiado por Banco' },
  { value: 'plan_ahorro', label: 'Plan de Ahorro' },
]

export const BANCOS: BancoEntidad[] = ['Santander Río', 'FIAT Crédito', 'Galicia', 'Otro']

// ============================================================
// Sucursales con info de contacto
// ============================================================

export const SUCURSALES_SELECT: { value: Sucursal; label: string }[] = [
  { value: 'Ushuaia', label: 'Ushuaia' },
  { value: 'Rio Grande', label: 'Río Grande' },
]

export const SUCURSALES_CONFIG = {
  'Rio Grande': {
    nombre: 'Río Grande',
    direccion: 'Av. San Martín 2599, Río Grande, Tierra del Fuego',
    ventas: '(02964) 15-487924',
    postventa: '(02964) 15-465050',
    horario_lv: '09:30 a 12:30hs y 15:00 a 20:00hs',
    horario_sab: '09:30 a 13:00hs',
  },
  'Ushuaia': {
    nombre: 'Ushuaia',
    direccion: 'Leopoldo Lugones 1950, Ushuaia, Tierra del Fuego',
    direccion_postventa: 'Piedrabuena 256, Ushuaia, Tierra del Fuego',
    ventas: '(02901) 15-487924',
    postventa: '(02901) 15-559933',
    horario_lv: '09:30 a 12:30hs y 15:00 a 20:00hs',
    horario_sab: '09:30 a 13:00hs',
  },
} as const

// ============================================================
// Colores consistentes por tipo de operación
// ============================================================

export const COLORES_TIPO: Record<TipoOperacion | 'demorada', { bg: string; text: string; border: string }> = {
  '0km':        { bg: '#E6F1FB', text: '#0C447C', border: '#85B7EB' },
  'usados':     { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  'plan_ahorro':{ bg: '#EEEDFE', text: '#3C3489', border: '#AFA9EC' },
  'demorada':   { bg: '#FCEBEB', text: '#791F1F', border: '#F09595' },
}

// ============================================================
// Labels de tipo de operación
// ============================================================

export const TIPO_LABEL: Record<TipoOperacion, string> = {
  '0km': '0 KM',
  'usados': 'Usado',
  'plan_ahorro': 'Plan de Ahorro',
}

// ============================================================
// Semáforo
// ============================================================

export const SEMAFORO_EMOJI: Record<Semaforo, string> = {
  verde: '🟢',
  amarillo: '🟡',
  rojo: '🔴',
}

export const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: 'text-green-600',
  amarillo: 'text-yellow-500',
  rojo: 'text-red-600',
}

// ============================================================
// Pipeline 6 pasos
// ============================================================

export const PASOS_PIPELINE = [
  { numero: 1, key: 'cierre',        label: 'Cierre comercial',       rol: 'Asesor' },
  { numero: 2, key: 'documentacion', label: 'Documentación y pagos',  rol: 'Gestor' },
  { numero: 3, key: 'gestoria',      label: 'Gestoría y patentamiento',rol: 'Gestor' },
  { numero: 4, key: 'alistamiento',  label: 'Preparación PDI',        rol: 'Preparador' },
  { numero: 5, key: 'calidad',       label: 'Calidad y contacto',     rol: 'Calidad' },
  { numero: 6, key: 'entrega',       label: 'Entrega de la unidad',   rol: 'Asesor' },
] as const

export const COLORES_ESTADO: Record<EstadoActual, string> = {
  cierre:        'bg-sky-100 text-sky-800',
  documentacion: 'bg-yellow-100 text-yellow-800',
  gestoria:      'bg-purple-100 text-purple-800',
  alistamiento:  'bg-blue-100 text-blue-800',
  calidad:       'bg-orange-100 text-orange-800',
  entrega:       'bg-amber-100 text-amber-800',
  entregado:     'bg-green-100 text-green-800',
  caida:         'bg-red-100 text-red-800',
}

export const ESTADO_LABEL: Record<EstadoActual, string> = {
  cierre:        'Cierre',
  documentacion: 'Documentación',
  gestoria:      'Gestoría',
  alistamiento:  'Alistamiento PDI',
  calidad:       'Calidad',
  entrega:       'Entrega',
  entregado:     'Entregado',
  caida:         'Caída',
}

// ============================================================
// Roles
// ============================================================

export const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'director', label: 'Director' },
  { value: 'asesor_ush', label: 'Asesor Ushuaia' },
  { value: 'asesor_rg', label: 'Asesor Río Grande' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'preparador', label: 'Preparador' },
  { value: 'calidad', label: 'Calidad' },
]

// ============================================================
// Estados legado (PDI)
// ============================================================

export const ESTADOS_GESTORIA: Record<EstadoGestoria, { label: string; color: string }> = {
  ingresado:  { label: 'Ingresado', color: 'bg-blue-100 text-blue-800' },
  en_tramite: { label: 'En trámite', color: 'bg-yellow-100 text-yellow-800' },
  listo:      { label: 'Listo', color: 'bg-green-100 text-green-800' },
  egresado:   { label: 'Egresado', color: 'bg-gray-100 text-gray-800' },
  suspendido: { label: 'Suspendido', color: 'bg-red-100 text-red-800' },
}

export const ESTADOS_ALISTAMIENTO: Record<EstadoAlistamiento, { label: string; color: string }> = {
  pendiente:  { label: 'Pendiente', color: 'bg-gray-100 text-gray-800' },
  en_proceso: { label: 'En proceso', color: 'bg-blue-100 text-blue-800' },
  observado:  { label: 'Observado', color: 'bg-orange-100 text-orange-800' },
  aprobado:   { label: 'Aprobado', color: 'bg-green-100 text-green-800' },
  rechazado:  { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
}

// ============================================================
// Template Checklist Documentación 0KM
// ============================================================

export const CHECKLIST_DOC_0KM: ChecklistDocItem[] = [
  { id: 1, nombre: 'Solicitud de inscripción inicial (F01)', completado: false, observacion: '' },
  { id: 2, nombre: 'Factura de venta original', completado: false, observacion: '' },
  { id: 3, nombre: 'Certificado de fabricación / importación', completado: false, observacion: '' },
  { id: 4, nombre: 'CETA (Certificado de Transferencia Automotor)', completado: false, observacion: '' },
  { id: 5, nombre: 'DNI titular (frente y dorso)', completado: false, observacion: '' },
  { id: 6, nombre: 'CUIL / CUIT titular', completado: false, observacion: '' },
  { id: 7, nombre: 'Comprobante de domicilio', completado: false, observacion: '' },
  { id: 8, nombre: 'Formulario 08 firmado', completado: false, observacion: '' },
  { id: 9, nombre: 'Seguro automotor vigente', completado: false, observacion: '' },
  { id: 10, nombre: 'Verificación policial', completado: false, observacion: '' },
  { id: 11, nombre: 'Pago de aranceles registrales', completado: false, observacion: '' },
  { id: 12, nombre: 'Declaración jurada de datos personales', completado: false, observacion: '' },
  { id: 13, nombre: 'Poder notarial (si corresponde)', completado: false, observacion: '' },
  { id: 14, nombre: 'Constancia de AFIP (monotributo o resp. inscripto)', completado: false, observacion: '' },
]

// ============================================================
// Template Checklist PDI (Pre-Delivery Inspection)
// ============================================================

export const CHECKLIST_PDI_TEMPLATE: ChecklistPDIItem[] = [
  { id: 1, seccion: 'Inspección Pre-Entrega', item: 'Revisión mecánica / PDI', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 2, seccion: 'Inspección Pre-Entrega', item: 'Check de recalls / actualizaciones técnicas', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 3, seccion: 'Inspección Pre-Entrega', item: 'Accesorios colocados según pedido', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 4, seccion: 'Inspección Pre-Entrega', item: 'Patente colocada', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 5, seccion: 'Inspección Pre-Entrega', item: 'Combustible cargado', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 6, seccion: 'Inspección Pre-Entrega', item: 'Lavado y estética final', es_critico: false, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 7, seccion: 'Inspección Pre-Entrega', item: 'Prueba de batería (carga y arranque, < 7 días antes)', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
  { id: 8, seccion: 'Inspección Pre-Entrega', item: 'Revisión de neumáticos (cocada mínima 4mm)', es_critico: true, estado: null, observacion: '', foto_url: null, validado_por: null, validado_at: null },
]

// ============================================================
// Templates WhatsApp
// ============================================================

export function waCitacionFirmaRG(nombre: string, modelo: string): string {
  return `Estimado/a ${nombre}, ¡buenas noticias!

Le informamos que la documentación de su vehículo ${modelo} ya está lista para la firma.

Lo/a esperamos en nuestra sucursal:

📍 Liendo Automotores – Río Grande
Av. San Martín 2599, Río Grande, Tierra del Fuego

🕒 Horarios de atención:
Lunes a Viernes de 09:30 a 12:30hs y 15:00 a 20:00hs
Sábados de 9:30 a 13:00hs

Por favor, traiga su DNI original. Ante cualquier consulta no dude en contactarnos.

¡Gracias por elegirnos! 🚗`
}

export function waCitacionFirmaUSH(nombre: string, modelo: string): string {
  return `Estimado/a ${nombre}, ¡buenas noticias!

Le informamos que la documentación de su vehículo ${modelo} ya está lista para la firma.

Lo/a esperamos en nuestra sucursal:

📍 Liendo Automotores – Ushuaia
Leopoldo Lugones 1950, Ushuaia, Tierra del Fuego

🕒 Horarios de atención:
Lunes a Viernes de 09:30 a 12:30hs y 15:00 a 20:00hs
Sábados de 9:30 a 13:00hs

Por favor, traiga su DNI original. Ante cualquier consulta no dude en contactarnos.

¡Gracias por elegirnos! 🚗`
}

export function waConfirmacion2dRG(nombre: string, modelo: string, fechaEntrega: string, horaEntrega: string, vendedor: string): string {
  return `Estimado/a ${nombre}, desde Liendo Automotores le confirmamos que la entrega de su ${modelo} está programada para el día ${fechaEntrega} a las ${horaEntrega}.

Su asesor ${vendedor} será el responsable de realizar la entrega técnica de su vehículo.

📍 Liendo Automotores – Río Grande
Av. San Martín 2599, Río Grande, Tierra del Fuego

🕒 Duración estimada: 45 minutos

Recuerde traer su DNI original.

Le pedimos que confirme su asistencia respondiendo este mensaje. Ante cualquier inconveniente, comuníquese al (02964) 15-487924.

¡Lo/a esperamos!`
}

export function waConfirmacion2dUSH(nombre: string, modelo: string, fechaEntrega: string, horaEntrega: string, vendedor: string): string {
  return `Estimado/a ${nombre}, desde Liendo Automotores le confirmamos que la entrega de su ${modelo} está programada para el día ${fechaEntrega} a las ${horaEntrega}.

Su asesor ${vendedor} será el responsable de realizar la entrega técnica de su vehículo.

📍 Liendo Automotores – Ushuaia
Leopoldo Lugones 1950, Ushuaia, Tierra del Fuego

🕒 Duración estimada: 45 minutos

Recuerde traer su DNI original.

Le pedimos que confirme su asistencia respondiendo este mensaje. Ante cualquier inconveniente, comuníquese al (02901) 15-559933.

¡Lo/a esperamos!`
}

export function waRecordatorio1h(nombre: string, modelo: string, vendedor: string): string {
  return `¡Hola ${nombre}! Le recordamos que en 1 hora lo/a esperamos para la entrega de su ${modelo}.

Su asesor ${vendedor} ya lo/a está esperando. 🚗

¿Confirma que viene en horario?`
}

export function waCartaFelicitaciones(nombre: string, modelo: string): string {
  return `Estimado/a ${nombre},

En nombre de todo el equipo de Liendo Automotores, queremos felicitarlo/a por su nuevo ${modelo}. 🎉

Es un placer para nosotros haberlo/a acompañado en este proceso. Queremos que sepa que estamos a su disposición para cualquier consulta o necesidad que tenga con su vehículo.

Le recordamos que nuestro equipo de Post Venta estará en contacto para acompañarlo/a con el plan de mantenimiento programado de su vehículo.

Próximamente recibirá una breve encuesta de satisfacción de FIAT Argentina. Su opinión es muy valiosa para seguir mejorando.

¡Gracias por elegir Liendo Automotores! 🚗✨

Atentamente,
Equipo Liendo Automotores
Concesionario Oficial FIAT – Tierra del Fuego`
}

export function waSeguimientoPost(nombre: string, modelo: string): string {
  return `Estimado/a ${nombre}, desde Liendo Automotores queremos saber cómo está con su ${modelo}. 🚗

¿Cómo fue su experiencia de compra?
¿Tiene alguna duda sobre el funcionamiento del vehículo?
¿Hay algo en lo que podamos ayudarlo/a?

Estuvimos intentando comunicarnos telefónicamente. Por favor, respóndanos por este medio o indíquenos un horario conveniente para llamarlo/a.

Su opinión nos ayuda a mejorar. ¡Gracias por confiar en nosotros!`
}
