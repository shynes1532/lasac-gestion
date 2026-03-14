// ============================================================
// LASAC APP - Definiciones de tipos del sistema
// ============================================================

// --- Enums como union types ---

export type Sucursal = 'Ushuaia' | 'Rio Grande'
export type SucursalUsuario = 'Ushuaia' | 'Rio Grande' | 'Ambas'
export type TipoOperacion = '0KM' | 'Plan de Ahorro' | 'Usado'
export type EstadoActual = 'gestoria' | 'alistamiento' | 'entrega' | 'cerrada'
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
  estado_anterior: string
  estado_nuevo: string
  fecha: string
  usuario_id: string
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
  estado_actual: EstadoActual
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
}
