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
  EstadoGrupo,
  EstadoAhorrista,
  EstadoCuota,
  TipoGestionMora,
  ResultadoGestionMora,
  TipoPlan,
  CodigoPlan,
  VehiculoCodigo,
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
// SGA — Planes de Ahorro FIAT Plan
// ============================================================

// --- Tipos de plan ---
export const TIPOS_PLAN: { value: TipoPlan; label: string; cuotas: number; integrantes: number; pct_cuota: number; integracion_minima: number }[] = [
  { value: 'H', label: 'Plan H — 84 cuotas', cuotas: 84, integrantes: 168, pct_cuota: 1.19, integracion_minima: 24 },
  { value: 'E', label: 'Plan E — 50 cuotas', cuotas: 50, integrantes: 100, pct_cuota: 2.0, integracion_minima: 0 },
]

// --- Códigos de condición del plan ---
export const CODIGOS_PLAN: { value: CodigoPlan; label: string }[] = [
  { value: 'B72', label: 'B72 — 70/30 Sin diferimiento' },
  { value: 'B90', label: 'B90 — 90/10 Sin diferimiento' },
  { value: 'M81', label: 'M81 — 80/20 Sin diferimiento' },
  { value: 'M80', label: 'M80 — 80/20 Cuota variable' },
  { value: 'B70', label: 'B70 — 70/30 Sin diferimientos' },
  { value: 'B71', label: 'B71 — 70/30 Cuota variable' },
  { value: 'B61', label: 'B61 — 60/40 84 Cuota variable' },
]

// --- Catálogo de vehículos con precios vigentes (04/03/2026) ---
export const CATALOGO_VEHICULOS: {
  codigo: VehiculoCodigo
  modelo: string
  condiciones: { codigo_plan: CodigoPlan; plan: string; precio_lista: number; cuota1_susc: number; cuota2_sin_iva: number; cuota2_sellado_tdf: number }[]
}[] = [
  {
    codigo: 'AR2', modelo: 'ARGO DRIVE 1.3L MT',
    condiciones: [
      { codigo_plan: 'B72', plan: '70/30 Sin diferimiento', precio_lista: 29930000, cuota1_susc: 279596, cuota2_sin_iva: 296579, cuota2_sellado_tdf: 327447 },
    ],
  },
  {
    codigo: 'DP1', modelo: 'CRONOS DRIVE 1.3L MT5 PACK PLUS',
    condiciones: [
      { codigo_plan: 'B72', plan: '70/30 Sin diferimiento', precio_lista: 37210000, cuota1_susc: 347603, cuota2_sin_iva: 347362, cuota2_sellado_tdf: 372946 },
      { codigo_plan: 'B90', plan: '90/10 Sin diferimiento', precio_lista: 37210000, cuota1_susc: 446919, cuota2_sin_iva: 449258, cuota2_sellado_tdf: 487634 },
      { codigo_plan: 'M81', plan: '80/20 Sin diferimiento', precio_lista: 37210000, cuota1_susc: 397261, cuota2_sin_iva: 408988, cuota2_sellado_tdf: 447364 },
    ],
  },
  {
    codigo: 'MB1', modelo: 'MOBI TREKKING 1.0',
    condiciones: [
      { codigo_plan: 'M80', plan: '80/20 Cuota variable', precio_lista: 27210000, cuota1_susc: 232399, cuota2_sin_iva: 236341, cuota2_sellado_tdf: 255050 },
    ],
  },
  {
    codigo: 'FP1', modelo: 'PULSE DRIVE 1.3L MT',
    condiciones: [
      { codigo_plan: 'B70', plan: '70/30 Sin diferimientos', precio_lista: 36860000, cuota1_susc: 344334, cuota2_sin_iva: 365249, cuota2_sellado_tdf: 403264 },
    ],
  },
  {
    codigo: 'FS1', modelo: 'STRADA FREEDOM CD 1.3 8V MT',
    condiciones: [
      { codigo_plan: 'B70', plan: '70/30 Sin diferimientos', precio_lista: 37710000, cuota1_susc: 352274, cuota2_sin_iva: 409179, cuota2_sellado_tdf: 448071 },
    ],
  },
  {
    codigo: 'NT1', modelo: 'TORO FREEDOM T270 AT6 4X2',
    condiciones: [
      { codigo_plan: 'B71', plan: '70/30 Cuota variable', precio_lista: 47490000, cuota1_susc: 399272, cuota2_sin_iva: 475903, cuota2_sellado_tdf: 524881 },
    ],
  },
  {
    codigo: 'FO1', modelo: 'FIORINO ENDURANCE 1.4L MT',
    condiciones: [
      { codigo_plan: 'B70', plan: '70/30 Sin diferimientos', precio_lista: 29460000, cuota1_susc: 275206, cuota2_sin_iva: 319661, cuota2_sellado_tdf: 350044 },
    ],
  },
  {
    codigo: 'FT1', modelo: 'FASTBACK TURBO 270 AT6',
    condiciones: [
      { codigo_plan: 'B71', plan: '70/30 Cuota variable', precio_lista: 45540000, cuota1_susc: 382878, cuota2_sin_iva: 416760, cuota2_sellado_tdf: 463727 },
    ],
  },
  {
    codigo: 'DT1', modelo: 'TITANO FREEDOM MT 4W',
    condiciones: [
      { codigo_plan: 'B61', plan: '60/40 84 Cuota variable', precio_lista: 58540000, cuota1_susc: 421864, cuota2_sin_iva: 487409, cuota2_sellado_tdf: 527659 },
    ],
  },
]

// --- Estados ---
export const ESTADOS_GRUPO: Record<EstadoGrupo, { label: string; color: string }> = {
  formando:  { label: 'Formando', color: 'bg-blue-100 text-blue-800' },
  activo:    { label: 'Activo', color: 'bg-green-100 text-green-800' },
  cerrado:   { label: 'Cerrado', color: 'bg-gray-100 text-gray-800' },
  disuelto:  { label: 'Disuelto', color: 'bg-red-100 text-red-800' },
}

export const ESTADOS_AHORRISTA: Record<EstadoAhorrista, { label: string; color: string }> = {
  activo:       { label: 'Activo', color: 'bg-green-100 text-green-800' },
  agrupado:     { label: 'Agrupado', color: 'bg-cyan-100 text-cyan-800' },
  adjudicado:   { label: 'Adjudicado', color: 'bg-blue-100 text-blue-800' },
  desadjudicado: { label: 'Desadjudicado', color: 'bg-gray-100 text-gray-800' },
  entregado:    { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  renunciado:   { label: 'Renunciado', color: 'bg-orange-100 text-orange-800' },
  rescindido:   { label: 'Rescindido', color: 'bg-red-100 text-red-800' },
  transferido:  { label: 'Transferido', color: 'bg-purple-100 text-purple-800' },
}

export const ESTADOS_CUOTA: Record<EstadoCuota, { label: string; color: string }> = {
  pendiente:  { label: 'Pendiente', color: 'bg-gray-100 text-gray-800' },
  pagada:     { label: 'Pagada', color: 'bg-green-100 text-green-800' },
  vencida:    { label: 'Vencida', color: 'bg-orange-100 text-orange-800' },
  en_mora:    { label: 'En Mora', color: 'bg-red-100 text-red-800' },
  bonificada: { label: 'Bonificada', color: 'bg-blue-100 text-blue-800' },
}

export const TIPOS_GESTION_MORA: { value: TipoGestionMora; label: string }[] = [
  { value: 'llamada', label: 'Llamada telefónica' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'carta_documento', label: 'Carta documento' },
  { value: 'visita', label: 'Visita' },
  { value: 'otro', label: 'Otro' },
]

export const RESULTADOS_GESTION_MORA: { value: ResultadoGestionMora; label: string }[] = [
  { value: 'sin_contacto', label: 'Sin contacto' },
  { value: 'promesa_pago', label: 'Promesa de pago' },
  { value: 'pago_parcial', label: 'Pago parcial' },
  { value: 'pago_total', label: 'Pago total' },
  { value: 'rechazo', label: 'Rechazo' },
  { value: 'otro', label: 'Otro' },
]

// --- Reglas de negocio FIAT Plan ---
export const REGLAS_FIAT_PLAN = {
  DERECHO_ADMISION_PCT: 2.5,          // % del valor móvil al suscribir
  DERECHO_ADJUDICACION_PCT: 2.0,      // % + IVA del valor móvil al adjudicarse
  CUOTAS_RESCISION: 3,                // 3 cuotas impagas = rescisión
  DIAS_ACEPTAR_ADJUDICACION: 5,       // 5 días para aceptar
  DIAS_RETIRAR_VEHICULO: 15,          // 15 días para retirar o cobra estadía
  INTEGRACION_PLAN_H: 24,             // 24 cuotas mínimo para retirar en Plan H
  SELLADO_CONTRATO_PCT: 3,            // 3% valor factura (sellado TDF)
  ARANCEL_INSCRIPCION_PCT: 1,         // 1% valor auto (registro automotor)
  ARANCEL_PRENDA_PCT: 0.1,            // 0.1% contrato prendario
  SELLADO_PRENDA_PCT: 1.2,            // 1.2% contrato prendario
} as const

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
