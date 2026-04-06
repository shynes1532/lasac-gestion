// ============================================================
// LASAC APP - Definiciones de tipos del sistema
// Pipeline 6 pasos: cierre → doc → gestoria → PDI → calidad → entrega
// ============================================================

// --- Enums como union types ---

export type Sucursal = 'Ushuaia' | 'Rio Grande'
export type SucursalUsuario = 'Ushuaia' | 'Rio Grande' | 'Ambas'

export type TipoOperacion = '0km' | 'usados' | 'plan_ahorro'
export type FormaPago = 'contado' | 'financiado_banco' | 'plan_ahorro'
export type BancoEntidad = 'Santander Río' | 'FIAT Crédito' | 'Galicia' | 'Otro'
export type EstadoPrenda = 'pendiente' | 'enviada'

export type EstadoActual =
  | 'cierre'
  | 'documentacion'
  | 'gestoria'
  | 'alistamiento'
  | 'calidad'
  | 'entrega'
  | 'entregado'
  | 'caida'

export type EstadoPaso1 = 'creada' | 'confirmada' | 'caida'
export type MotivoCaida = 'desiste' | 'no_califica' | 'otra_marca' | 'otro'

export type EstadoPaso2 =
  | 'pagos_pendientes'
  | 'armando_carpeta'
  | 'cliente_citado'
  | 'paso_3'
  | 'papeles_terminal'
  | 'firmas'
  | 'esperando_unidad'
  | 'unidad_llego'

export type EstadoPaso3 =
  | 'preparando_carpeta'
  | 'esperando_firma'
  | 'o2_solicitado'
  | 'en_registro'
  | 'patentado'
  | 'inhibido'

export type ResultadoO2 = 'libre' | 'inhibido'

export type EstadoCalidad = 'citar_2d' | 'confirmar_1h' | 'entregado' | 'post_2d' | 'cerrado'
export type ConfirmacionCliente = 'si' | 'no' | 'reprograma'
export type Satisfaccion = 'satisfecho' | 'insatisfecho'

// Estos se mantienen por compatibilidad con el PDI existente
export type EstadoGestoria = 'ingresado' | 'en_tramite' | 'listo' | 'egresado' | 'suspendido'
export type EstadoAlistamiento = 'pendiente' | 'en_proceso' | 'observado' | 'aprobado' | 'rechazado'
export type EstadoEntrega = 'pendiente' | 'programada' | 'entregada' | 'cerrada'

export type RolUsuario = 'director' | 'asesor_ush' | 'asesor_rg' | 'gestor' | 'preparador' | 'calidad'
export type SeveridadNC = 'critica' | 'mayor' | 'menor'
export type EstadoNC = 'abierta' | 'en_proceso' | 'cerrada'
export type PrioridadNotificacion = 'baja' | 'normal' | 'alta' | 'critica'
export type TipoNotificacion =
  | 'nuevo_alistamiento'
  | 'aprobado_pdi'
  | 'rechazado_pdi'
  | 'alerta_csi'
  | 'compromiso_vence'
  | 'entrega_manana'
  | 'nc_critica_48h'
  | 'general'

export type Semaforo = 'verde' | 'amarillo' | 'rojo'

// --- Tipos JSONB (embebidos) ---

export interface ChecklistDocItem {
  id: number
  nombre: string
  completado: boolean
  observacion: string
}

export interface ChecklistPDIItem {
  id: number
  seccion: string
  item: string
  es_critico: boolean
  estado: 'OK' | 'No OK' | 'NA' | null
  observacion: string
  foto_url: string | null
  validado_por: string | null
  validado_at: string | null
}

export interface NoConformidad {
  id: number
  item_id: number
  descripcion: string
  severidad: SeveridadNC
  estado: EstadoNC
  foto_url: string | null
  accion_requerida: string
  responsable_id: string | null
  fecha_limite: string | null
  fecha_cierre: string | null
  evidencia_cierre: string | null
}

export interface ChecklistEntregaItem {
  id: number
  item: string
  completado: boolean
  observacion: string
}

export interface Compromiso {
  id: number
  descripcion: string
  fecha_limite: string
  cumplido: boolean
  observacion: string
}

export interface HistorialEstado {
  paso: string
  estado_anterior: string
  estado_nuevo: string
  fecha: string
  usuario_id: string
  usuario_nombre?: string
  motivo: string | null
}

// --- Interfaces de tablas ---

export interface Usuario {
  id: string
  email: string
  nombre_completo: string
  rol: RolUsuario
  sucursal: SucursalUsuario
  activo: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Operacion {
  id: string
  numero_operacion: string
  sucursal: Sucursal
  tipo_operacion: TipoOperacion
  forma_pago: FormaPago | null
  estado_actual: EstadoActual

  // Paso 1 — Cierre
  nro_epod: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  fecha_compromiso: string | null
  estado_paso1: EstadoPaso1
  motivo_caida: MotivoCaida | null
  historial_estados: HistorialEstado[]

  // Financiero
  banco_entidad: BancoEntidad | null
  estado_prenda: EstadoPrenda
  fecha_envio_prenda: string | null

  // Plan de Ahorro
  nro_grupo_orden: string | null
  fecha_adjudicacion: string | null
  fecha_arribo_unidad: string | null
  gasto_adjudicacion: number | null
  gasto_patentamiento: number | null

  // Paso 2 — Documentación
  estado_paso2: EstadoPaso2
  pago_cliente_completo: boolean
  pago_banco_recibido: boolean | null
  carpeta_ok: boolean
  chasis_verificado: boolean
  unidad_disponible: boolean
  papeles_preparados: boolean
  cliente_citado: boolean
  papeles_terminal_recibidos: boolean | null
  firmas_adelantadas: boolean | null
  unidad_en_sucursal: boolean | null

  // Paso 3 — Gestoría
  estado_paso3: EstadoPaso3
  carpeta_registral_lista: boolean
  cliente_firmo: boolean
  o2_solicitado: boolean
  resultado_o2: ResultadoO2 | null
  ingresado_registro: boolean
  fecha_ingreso_registro: string | null
  egresado_registro: boolean
  fecha_egreso_registro: string | null
  dominio_patente: string | null

  // Paso 6 — Entrega
  unidad_entregada: boolean
  fecha_entrega_real: string | null
  entrega_con_incidente: boolean
  detalle_incidente: string | null
  dias_totales: number | null
  diferencia_compromiso: number | null

  // Financiero
  valor_unidad: number | null
  valor_credito: number | null
  quebranto_porcentaje: number | null
  quebranto_monto: number | null
  saldo_cliente: number | null
  forma_pago_saldo: 'tarjeta' | 'transferencia' | 'efectivo' | null
  saldo_pagado: boolean
  fecha_cancelacion_total: string | null
  banco_saldo_cancelado: boolean
  banco_fecha_pago: string | null

  // Legado (compatibilidad)
  estado_gestoria: EstadoGestoria
  estado_alistamiento: EstadoAlistamiento
  estado_entrega: EstadoEntrega
  asesor_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Titular {
  id: string
  operacion_id: string
  nombre_apellido: string
  dni_cuil: string
  domicilio: string | null
  localidad: string | null
  telefono: string
  email: string | null
  es_empresa: boolean
  razon_social: string | null
  cuit_empresa: string | null
  created_at: string
  updated_at: string
}

export interface Unidad {
  id: string
  operacion_id: string
  marca: string
  modelo: string
  version: string | null
  color: string | null
  vin_chasis: string
  patente_actual: string | null
  patente_nueva: string | null
  kilometraje: number | null
  anio: number | null
  created_at: string
  updated_at: string
}

export interface GestoriaTramite {
  id: string
  operacion_id: string
  fecha_ingreso: string
  fecha_egreso_estimada: string | null
  fecha_egreso_real: string | null
  gestor_responsable: string | null
  documentacion_completa: boolean
  observaciones: string | null
  checklist_doc: ChecklistDocItem[]
  historial_estados: HistorialEstado[]
  created_at: string
  updated_at: string
}

export interface AlistamientoPDI {
  id: string
  operacion_id: string
  preparador_id: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  checklist_pdi: { items: ChecklistPDIItem[] }
  no_conformidades: NoConformidad[]
  aprobado: boolean | null
  aprobado_por: string | null
  observaciones_tecnicas: string | null
  fotos_evidencia: string[]
  created_at: string
  updated_at: string
}

export interface Entrega {
  id: string
  operacion_id: string
  asesor_id: string | null
  fecha_programada: string
  hora_programada: string | null
  checklist_entrega: ChecklistEntregaItem[]
  acto_entregado_at: string | null
  compromisos: Compromiso[]
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface ContactoCalidad {
  id: string
  operacion_id: string
  contacto_2d_antes: boolean
  cliente_confirmo: ConfirmacionCliente | null
  fecha_entrega_confirmada: string | null
  contacto_1h_antes: boolean
  resultado_1h: 'confirma' | 'reprograma' | null
  carta_enviada: boolean
  intentos_post: number
  contacto_efectivo_post: boolean
  satisfaccion: Satisfaccion | null
  verbatim: string | null
  alerta_gpv: boolean
  estado_calidad: EstadoCalidad
  created_at: string
  updated_at: string
}

export interface EncuestaCSI {
  id: string
  operacion_id: string
  fecha_envio: string | null
  fecha_respuesta: string | null
  p1_proceso_entrega: number
  p2_atencion_asesor: number
  p3_estado_unidad: number
  p4_tiempo_espera: number
  p5_nps: number
  comentarios: string | null
  promedio: number
  alerta_activa: boolean
  contacto_realizado: boolean
  created_at: string
}

export interface Notificacion {
  id: string
  operacion_id: string | null
  destinatario_id: string
  tipo: TipoNotificacion
  mensaje: string
  prioridad: PrioridadNotificacion
  leida: boolean
  created_at: string
}

export interface ModeloFiat {
  id: number
  categoria: string
  nombre: string
  activo: boolean
}

// --- Tipos compuestos para vistas ---

export interface OperacionCompleta extends Operacion {
  titular: Titular | null
  unidad: Unidad | null
  gestoria: GestoriaTramite | null
  alistamiento: AlistamientoPDI | null
  entrega: Entrega | null
  encuesta: EncuestaCSI | null
  calidad: ContactoCalidad | null
  asesor?: Usuario | null
}

// --- Helpers de semáforo ---

export function getSemaforoPaso1(createdAt: string): Semaforo {
  const horas = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (horas < 24) return 'verde'
  if (horas < 48) return 'amarillo'
  return 'rojo'
}

export function getSemaforoPaso2(fechaInicio: string): Semaforo {
  const dias = (Date.now() - new Date(fechaInicio).getTime()) / 86_400_000
  if (dias < 3) return 'verde'
  if (dias < 5) return 'amarillo'
  return 'rojo'
}

export function getSemaforoPaso3(fechaInicio: string): Semaforo {
  const dias = (Date.now() - new Date(fechaInicio).getTime()) / 86_400_000
  if (dias < 5) return 'verde'
  if (dias < 10) return 'amarillo'
  return 'rojo'
}

export function getSemaforoRegistro(fechaIngreso: string): Semaforo {
  const dias = (Date.now() - new Date(fechaIngreso).getTime()) / 86_400_000
  if (dias < 5) return 'verde'
  if (dias < 10) return 'amarillo'
  return 'rojo'
}

export function getSemaforoPDI(fechaInicio: string): Semaforo {
  const dias = (Date.now() - new Date(fechaInicio).getTime()) / 86_400_000
  if (dias < 2) return 'verde'
  if (dias < 4) return 'amarillo'
  return 'rojo'
}

export function getSemaforoCompromiso(fechaCompromiso: string): Semaforo {
  const dias = (new Date(fechaCompromiso).getTime() - Date.now()) / 86_400_000
  if (dias > 10) return 'verde'
  if (dias > 5) return 'amarillo'
  return 'rojo'
}

// ============================================================
// SGA — Planes de Ahorro FIAT Plan
// ============================================================

export type TipoPlan = 'H' | 'E'
export type CodigoPlan = 'B72' | 'B90' | 'M81' | 'M80' | 'B70' | 'B71' | 'B61'
export type VehiculoCodigo = 'AR2' | 'DP1' | 'MB1' | 'FP1' | 'FS1' | 'NT1' | 'FO1' | 'FT1' | 'DT1'
export type EstadoGrupo = 'formando' | 'activo' | 'cerrado' | 'disuelto'
export type EstadoAhorrista = 'activo' | 'agrupado' | 'adjudicado' | 'desadjudicado' | 'entregado' | 'renunciado' | 'rescindido' | 'transferido'
export type TipoAdjudicacion = 'sorteo' | 'licitacion'
export type EstadoCuota = 'pendiente' | 'pagada' | 'vencida' | 'en_mora' | 'bonificada'
export type TipoGestionMora = 'llamada' | 'whatsapp' | 'email' | 'carta_documento' | 'visita' | 'otro'
export type ResultadoGestionMora = 'sin_contacto' | 'promesa_pago' | 'pago_parcial' | 'pago_total' | 'rechazo' | 'otro'

export interface GrupoAhorro {
  id: string
  numero_grupo: string
  tipo_plan: TipoPlan
  modelo: string
  valor_movil: number
  cantidad_integrantes: number
  cantidad_cuotas: number
  cuotas_acto: number
  fecha_formacion: string | null
  estado: EstadoGrupo
  sucursal: Sucursal
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Ahorrista {
  id: string
  // Alta
  numero_solicitud: string
  grupo_id: string | null
  operacion_id: string | null
  nombre_apellido: string
  dni_cuil: string
  domicilio: string | null
  localidad: string | null
  telefono: string | null
  email: string | null
  numero_orden: number | null
  tipo_plan: TipoPlan
  codigo_plan: CodigoPlan
  vehiculo_codigo: VehiculoCodigo
  vehiculo_modelo: string
  valor_movil: number
  cuota_pura: number
  fecha_arranque: string
  nro_recibo_c1: string | null
  es_subite: boolean
  vendedor_id: string | null
  vendedor_nombre: string | null

  // Estado
  estado: EstadoAhorrista
  sucursal: Sucursal

  // Cuotas
  cuotas_pagas: number
  cuotas_impagas_consecutivas: number
  cuotas_impagas_total: number
  en_riesgo_rescision: boolean

  // Adjudicacion
  adjudicado: boolean
  fecha_adjudicacion: string | null
  tipo_adjudicacion: TipoAdjudicacion | null
  monto_licitacion: number | null
  acepto_adjudicacion: boolean | null
  fecha_limite_aceptacion: string | null

  // Integracion (Plan H = 24 cuotas minimo)
  integracion_completa: boolean
  cuotas_integradas: number

  // Gastos
  derecho_admision: number | null
  derecho_adjudicacion: number | null
  gastos_entrega: number | null
  cambio_modelo: boolean
  modelo_elegido: string | null
  diferencia_modelo: number | null

  // Entrega
  vehiculo_retirado: boolean
  fecha_retiro: string | null
  fecha_notificacion_retiro: string | null
  cobra_estadia: boolean

  // Documentación carpeta
  doc_dni: boolean
  doc_domicilio: boolean
  doc_ingresos: boolean
  doc_cbu: boolean
  doc_seguro: boolean
  doc_formulario08: boolean
  doc_ceta: boolean
  doc_veraz: boolean
  doc_garante: boolean
  etapa_adjudicacion: 'aprobado' | 'facturado' | 'esperando_unidad' | 'papeles_listos' | 'certificado_listo' | null

  observaciones: string | null
  created_at: string
  updated_at: string
  // Joins
  grupo?: GrupoAhorro | null
  cuotas?: CuotaAhorro[]
  vendedor?: Usuario | null
}

export interface CuotaAhorro {
  id: string
  ahorrista_id: string
  numero_cuota: number
  monto: number
  valor_movil_vigente: number | null
  fecha_vencimiento: string
  fecha_pago: string | null
  monto_pagado: number
  nro_recibo: string | null
  estado: EstadoCuota
  dias_mora: number
  interes_mora: number
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface GestionMora {
  id: string
  ahorrista_id: string
  cuota_id: string | null
  tipo_gestion: TipoGestionMora
  fecha_gestion: string
  resultado: ResultadoGestionMora
  fecha_promesa: string | null
  monto_prometido: number | null
  observaciones: string | null
  gestionado_por: string | null
  created_at: string
  // Joins
  ahorrista?: Ahorrista | null
}

// ============================================================
// Recepción — Control de ingreso de clientes
// ============================================================

export type AreaRecepcion = 'posventa' | 'administracion' | 'ventas'
export type SubareaPosventa = 'repuestos' | 'taller' | 'siniestro'
export type SubareaAdmin = 'plan' | 'convencional'
export type SubareaVentas = 'plan' | '0km'
export type SubareaRecepcion = SubareaPosventa | SubareaAdmin | SubareaVentas
export type EstadoRecepcion = 'en_espera' | 'atendido' | 'contactado'

export interface Recepcion {
  id: string
  nombre: string
  telefono: string
  area: AreaRecepcion
  subarea: SubareaRecepcion
  notas: string | null
  estado: EstadoRecepcion
  atendido_por: string | null
  contactado_at: string | null
  created_by: string
  sucursal: Sucursal
  created_at: string
  updated_at: string
}

// Requiere prenda?
export function requierePrenda(op: Pick<Operacion, 'forma_pago' | 'tipo_operacion'>): boolean {
  return op.forma_pago === 'financiado_banco' || op.tipo_operacion === 'plan_ahorro'
}

// Puede avanzar de Paso 2 a 3? (siempre permite avanzar, solo devuelve advertencias)
export function puedeAvanzarPaso2(op: Pick<Operacion, 'forma_pago' | 'tipo_operacion' | 'pago_cliente_completo' | 'pago_banco_recibido' | 'unidad_en_sucursal'>): { ok: boolean; advertencias: string[] } {
  const advertencias: string[] = []
  if (!op.pago_cliente_completo) advertencias.push('Pago del cliente pendiente')
  if (op.forma_pago === 'financiado_banco' && !op.pago_banco_recibido)
    advertencias.push('Pago del banco pendiente')
  if (op.tipo_operacion === 'plan_ahorro' && op.unidad_en_sucursal === false)
    advertencias.push('La unidad aún no está en sucursal')
  return { ok: true, advertencias }
}
