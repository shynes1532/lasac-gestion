// ============================================================
// Helpers cliente del motor de precios.
// Llaman a las funciones SQL de migration 014 vía supabase.rpc().
// Vite + React: NO hay Server Actions; los hooks usan estos
// helpers desde tanstack-query (ver src/hooks/usePricing.ts).
// ============================================================

import { supabase } from './supabase'
import type {
  CalculoPrecioResult,
  StockDisponibleResult,
  StockDisponibleSucursal,
  StockDisponibleAgregado,
  SucursalRepuestos,
  CondicionIVA,
  FamiliaFiscal,
} from '../types/pricing'

// ------------------------------------------------------------
// calcular_precio_venta
// ------------------------------------------------------------

export interface GetPrecioVentaParams {
  productoId: string
  clienteId: string
  sucursal?: SucursalRepuestos
  fecha?: string  // YYYY-MM-DD; default = hoy
}

export async function getPrecioVenta(
  params: GetPrecioVentaParams,
): Promise<CalculoPrecioResult> {
  const { data, error } = await supabase.rpc('calcular_precio_venta', {
    p_producto_id: params.productoId,
    p_cliente_id:  params.clienteId,
    p_sucursal:    params.sucursal ?? null,
    p_fecha:       params.fecha ?? new Date().toISOString().slice(0, 10),
  })

  if (error) {
    throw new Error(`calcular_precio_venta: ${error.message}`)
  }
  return data as CalculoPrecioResult
}

// ------------------------------------------------------------
// calcular_stock_disponible
// Sobrecargas para que TS infiera el tipo correcto según
// si se pasó sucursal específica o no.
// ------------------------------------------------------------

export async function getStockDisponible(params: {
  productoId: string
  sucursal: SucursalRepuestos
}): Promise<StockDisponibleSucursal>

export async function getStockDisponible(params: {
  productoId: string
}): Promise<StockDisponibleAgregado>

export async function getStockDisponible(params: {
  productoId: string
  sucursal?: SucursalRepuestos
}): Promise<StockDisponibleResult> {
  const { data, error } = await supabase.rpc('calcular_stock_disponible', {
    p_producto_id: params.productoId,
    p_sucursal:    params.sucursal ?? null,
  })

  if (error) {
    throw new Error(`calcular_stock_disponible: ${error.message}`)
  }
  return data as StockDisponibleResult
}

// ------------------------------------------------------------
// Helpers de display (ver sección 4 del prompt — reglas de UI)
// ------------------------------------------------------------

const ARS_FMT = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatARS(n: number | null | undefined): string {
  if (n == null) return '—'
  return ARS_FMT.format(n)
}

export interface BadgePricing {
  type: 'lista_vencida' | 'discontinuado' | 'exento_aae' | 'requiere_aprobacion'
  label: string
  variant: 'red' | 'gray' | 'green' | 'orange'
}

/**
 * Devuelve los badges aplicables según el resultado del cálculo + flags del producto.
 * No bloquea ninguna acción: el caller decide UX (deshabilitar carrito, requerir aprobación, etc.).
 */
export function getPricingBadges(opts: {
  vigenciaHasta: string | null
  discontinuado: boolean
  familiaFiscal: FamiliaFiscal
  condicionIvaCliente: CondicionIVA
  provinciaCliente: string
  precioFinal: number | null
  precioMinimoAutorizado: number | null
  hoy?: string
}): BadgePricing[] {
  const out: BadgePricing[] = []
  const hoy = opts.hoy ?? new Date().toISOString().slice(0, 10)

  if (opts.vigenciaHasta && opts.vigenciaHasta < hoy) {
    out.push({ type: 'lista_vencida', label: 'Lista vencida', variant: 'red' })
  }

  if (opts.discontinuado) {
    out.push({ type: 'discontinuado', label: 'Discontinuado', variant: 'gray' })
  }

  if (opts.familiaFiscal === 'exento_19640' && opts.provinciaCliente === 'TDF') {
    out.push({ type: 'exento_aae', label: 'Exento AAE', variant: 'green' })
  }

  if (
    opts.precioFinal != null &&
    opts.precioMinimoAutorizado != null &&
    opts.precioFinal < opts.precioMinimoAutorizado
  ) {
    out.push({
      type: 'requiere_aprobacion',
      label: 'Requiere aprobación',
      variant: 'orange',
    })
  }

  return out
}
