// ============================================================
// Tipos de dominio del motor de precios + stock por sucursal.
// Refleja las tablas de migrations 011..014 y la salida JSON
// de las funciones calcular_precio_venta / calcular_stock_disponible.
//
// Nota: las sucursales usan la convención del repo
// ('Ushuaia', 'Rio Grande', 'Deposito Central'),
// no la lowercase del prompt original.
// ============================================================

export type SucursalRepuestos =
  | 'Ushuaia'
  | 'Rio Grande'
  | 'Deposito Central'

export type Moneda = 'ARS' | 'USD'

// CF: Consumidor Final · RI: Resp. Inscripto · MT: Monotributo
// EX: Exento · RNI: Resp. No Inscripto
export type CondicionIVA = 'CF' | 'RI' | 'MT' | 'EX' | 'RNI'

export type FamiliaFiscal = 'gravado_normal' | 'exento_19640' | 'no_gravado'

export type TierNombre =
  | 'repuestero'
  | 'taller'
  | 'flota'
  | 'publico'
  | 'interno'

export type FuenteCotizacion =
  | 'bna_vendedor'
  | 'bna_divisa'
  | 'mep'
  | 'oficial_fiat'
  | 'manual'

export type EstadoReserva = 'activa' | 'consumida' | 'cancelada' | 'vencida'

export type EstadoTransferencia =
  | 'solicitada'
  | 'en_transito'
  | 'recibida'
  | 'cancelada'

// ------------------------------------------------------------
// Filas de tablas
// ------------------------------------------------------------

export interface PricingTier {
  id: string
  nombre: TierNombre
  factor_markup: number
  descripcion: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface CotizacionDiaria {
  fecha: string           // YYYY-MM-DD
  fuente: FuenteCotizacion
  valor: number
  cargado_por: string | null
  created_at: string
}

export interface SettingRow {
  clave: string
  valor: unknown          // jsonb arbitrario
  descripcion: string | null
  updated_at: string
  updated_by: string | null
}

export interface HistoricoPrecioRow {
  id: number
  producto_id: string
  precio_lista_anterior: number | null
  precio_lista_nuevo: number | null
  descuento_anterior: number | null
  descuento_nuevo: number | null
  moneda_anterior: Moneda | null
  moneda_nueva: Moneda | null
  motivo: string | null
  cambiado_por: string | null
  created_at: string
}

export interface Cliente {
  id: string
  nombre: string
  cuit: string | null
  condicion_iva: CondicionIVA
  provincia: string
  tier_id: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  observaciones: string | null
  activo: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

// Campos extendidos sobre la tabla repuestos (migration 012).
// Se exponen aparte para que el tipo Repuesto base pueda intersectarse
// (ver lib/types.ts del repo).
export interface RepuestoPricingFields {
  precio_lista: number | null
  descuento_fabricante: number
  moneda: Moneda
  vigencia_desde: string | null
  vigencia_hasta: string | null
  familia_fiscal: FamiliaFiscal
  precio_minimo_autorizado: number | null
  marca: string | null
  discontinuado: boolean
}

export interface StockSucursalRow {
  producto_id: string
  sucursal: SucursalRepuestos
  stock_fisico: number
  ubicacion: string | null
  updated_at: string
}

export interface ReservaStock {
  id: string
  producto_id: string
  sucursal: SucursalRepuestos
  cantidad: number
  cliente_id: string | null
  orden_venta_id: string | null
  estado: EstadoReserva
  vence_en: string | null
  created_at: string
  created_by: string | null
}

export interface TransferenciaStock {
  id: string
  producto_id: string
  sucursal_origen: SucursalRepuestos
  sucursal_destino: SucursalRepuestos
  cantidad: number
  estado: EstadoTransferencia
  fecha_envio: string | null
  fecha_recepcion: string | null
  observacion: string | null
  created_at: string
  created_by: string | null
}

// ------------------------------------------------------------
// Resultados de funciones SQL (jsonb)
// ------------------------------------------------------------

export interface CalculoPrecioResult {
  producto_id: string
  cliente_id: string
  sucursal: SucursalRepuestos | null
  fecha_calculo: string
  moneda_origen: Moneda
  cotizacion_usd: number | null
  fuente_cotiz: FuenteCotizacion | null
  precio_lista: number
  descuento_pct: number
  precio_neto: number
  precio_ars: number
  flete_pct: number
  precio_costo: number
  tier: TierNombre
  factor_markup: number
  precio_markup: number
  iva_rate: number
  precio_final: number
  condicion_iva: CondicionIVA
  familia_fiscal: FamiliaFiscal
  warnings: string[]
}

export interface StockDisponibleSucursal {
  producto_id: string
  sucursal: SucursalRepuestos
  stock_fisico: number
  reservado: number
  en_transito_saliente: number
  en_transito_entrante: number
  disponible: number
  descuenta_reservas: boolean
  descuenta_transito: boolean
}

export interface StockDisponibleAgregado {
  producto_id: string
  sucursal: 'TODAS'
  stock_fisico_total: number
  reservado_total: number
  disponible_total: number
  detalle_por_sucursal: Array<{
    sucursal: SucursalRepuestos
    detalle: StockDisponibleSucursal
  }>
}

export type StockDisponibleResult =
  | StockDisponibleSucursal
  | StockDisponibleAgregado

export function isStockAgregado(
  s: StockDisponibleResult,
): s is StockDisponibleAgregado {
  return s.sucursal === 'TODAS'
}
