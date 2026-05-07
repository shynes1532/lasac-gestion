// ============================================================
// Hooks de tanstack-query para el motor de precios + stock.
// Pensados para usarse desde RepuestosPage, listados y carrito.
// ============================================================

import { useQuery } from '@tanstack/react-query'
import {
  getPrecioVenta,
  getStockDisponible,
} from '../lib/pricing'
import type {
  CalculoPrecioResult,
  StockDisponibleSucursal,
  StockDisponibleAgregado,
  SucursalRepuestos,
} from '../types/pricing'

// ------------------------------------------------------------
// Precio de venta
// ------------------------------------------------------------

interface UsePrecioVentaParams {
  productoId: string | null | undefined
  clienteId:  string | null | undefined
  sucursal?:  SucursalRepuestos
  fecha?:     string
  /** Si false, no dispara la query. Default: true cuando hay producto + cliente. */
  enabled?: boolean
}

export function usePrecioVenta(params: UsePrecioVentaParams) {
  const enabled = (params.enabled ?? true)
    && !!params.productoId
    && !!params.clienteId

  return useQuery<CalculoPrecioResult>({
    queryKey: [
      'precio-venta',
      params.productoId,
      params.clienteId,
      params.sucursal ?? null,
      params.fecha ?? null,
    ],
    queryFn: () =>
      getPrecioVenta({
        productoId: params.productoId!,
        clienteId:  params.clienteId!,
        sucursal:   params.sucursal,
        fecha:      params.fecha,
      }),
    enabled,
    staleTime: 60_000,        // precios estables al minuto
  })
}

// ------------------------------------------------------------
// Stock disponible — modo sucursal específica
// ------------------------------------------------------------

export function useStockDisponible(params: {
  productoId: string | null | undefined
  sucursal:   SucursalRepuestos
  enabled?:   boolean
}) {
  const enabled = (params.enabled ?? true) && !!params.productoId

  return useQuery<StockDisponibleSucursal>({
    queryKey: ['stock-disponible', params.productoId, params.sucursal],
    queryFn: () =>
      getStockDisponible({
        productoId: params.productoId!,
        sucursal:   params.sucursal,
      }),
    enabled,
    staleTime: 30_000,
  })
}

// ------------------------------------------------------------
// Stock disponible — modo agregado (todas las sucursales)
// ------------------------------------------------------------

export function useStockDisponibleAgregado(params: {
  productoId: string | null | undefined
  enabled?:   boolean
}) {
  const enabled = (params.enabled ?? true) && !!params.productoId

  return useQuery<StockDisponibleAgregado>({
    queryKey: ['stock-disponible-agregado', params.productoId],
    queryFn: () =>
      getStockDisponible({ productoId: params.productoId! }),
    enabled,
    staleTime: 30_000,
  })
}
