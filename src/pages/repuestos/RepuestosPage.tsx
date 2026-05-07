import { useState, useEffect, useRef } from 'react'
import { Package, Plus, Minus, AlertTriangle, X, History, ScanLine, Camera, Pencil, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useRepuestos, useCrearRepuesto, useRegistrarMovimiento, useMovimientos } from '../../hooks/useRepuestos'
import { useClientes, CLIENTE_MOSTRADOR_ID } from '../../hooks/useClientes'
import { usePrecioVenta, useStockDisponibleAgregado } from '../../hooks/usePricing'
import { formatARS, getPricingBadges } from '../../lib/pricing'
import { Button, Card, SearchInput, EmptyState, notify, Tabs } from '../../components/ui'
import { PedidosSection } from './PedidosSection'
import type { Repuesto } from '../../lib/types'

// ============================================================
// Scanner inline — se abre encima del campo código
// Usa BarcodeDetector en Chrome Android, input manual como fallback
// ============================================================
function InlineScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(true)
  const [error, setError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const hasBarcodeAPI = typeof window !== 'undefined' && 'BarcodeDetector' in window

  const cleanup = () => {
    scanningRef.current = false
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!hasBarcodeAPI) {
      setError('Tu navegador no soporta escaneo automático. Ingresá el código manualmente.')
      return
    }

    let animFrame = 0

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCameraReady(true)
        }

        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf']
        })

        const scanFrame = async () => {
          if (!scanningRef.current || !videoRef.current || videoRef.current.readyState < 2) {
            if (scanningRef.current) animFrame = requestAnimationFrame(scanFrame)
            return
          }
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0 && scanningRef.current) {
              scanningRef.current = false
              const code = barcodes[0].rawValue
              cleanup()
              onScan(code)
              return
            }
          } catch { /* ignore */ }
          if (scanningRef.current) animFrame = requestAnimationFrame(scanFrame)
        }

        animFrame = requestAnimationFrame(scanFrame)
      } catch (err: any) {
        console.error('Camera error:', err)
        setError('No se pudo acceder a la cámara. Verificá los permisos.')
      }
    }

    start()
    return () => { cleanup(); cancelAnimationFrame(animFrame) }
  }, [hasBarcodeAPI])

  return (
    <div className="bg-black rounded-xl overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-action" />
          <span className="text-white text-xs font-bold">Escaneá el código de barras</span>
        </div>
        <button onClick={() => { cleanup(); onClose() }} className="text-white/70 p-1 cursor-pointer">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Camera */}
      {!error ? (
        <div className="relative" style={{ height: '200px' }}>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
          {cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-20 border-2 border-red-500 rounded-lg" />
            </div>
          )}
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-action border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center">
          <p className="text-white/60 text-xs">{error}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Panel de movimiento (ingreso/egreso) para un repuesto existente
// ============================================================
function MovimientoPanel({ repuesto, clienteId, onClose }: { repuesto: Repuesto; clienteId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState('')
  const registrarMov = useRegistrarMovimiento()
  const { data: movimientos } = useMovimientos(repuesto.id)
  const [showHistorial, setShowHistorial] = useState(false)
  const [showEditar, setShowEditar] = useState(false)
  const [editForm, setEditForm] = useState({
    codigo_fiat: repuesto.codigo_fiat,
    descripcion: repuesto.descripcion,
    ubicacion: repuesto.ubicacion || '',
    stock_minimo: repuesto.stock_minimo,
    precio_costo: repuesto.precio_costo?.toString() || '',
    precio_venta: repuesto.precio_venta?.toString() || '',
    // Pricing engine
    marca:                    repuesto.marca ?? '',
    moneda:                   repuesto.moneda ?? 'ARS',
    precio_lista:             repuesto.precio_lista?.toString() ?? '',
    descuento_fabricante:     repuesto.descuento_fabricante?.toString() ?? '0',
    familia_fiscal:           repuesto.familia_fiscal ?? 'gravado_normal',
    precio_minimo_autorizado: repuesto.precio_minimo_autorizado?.toString() ?? '',
    vigencia_desde:           repuesto.vigencia_desde ?? '',
    vigencia_hasta:           repuesto.vigencia_hasta ?? '',
    discontinuado:            repuesto.discontinuado,
  })
  const [saving, setSaving] = useState(false)

  // Pricing en vivo según el cliente seleccionado en la página
  const tienePricing = repuesto.precio_lista != null
  const { data: precio } = usePrecioVenta({
    productoId: repuesto.id,
    clienteId,
    enabled: tienePricing,
  })

  const handleSaveEdit = async () => {
    if (!editForm.codigo_fiat) { notify.error('El código es obligatorio'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('repuestos').update({
        codigo_fiat: editForm.codigo_fiat,
        descripcion: editForm.descripcion || editForm.codigo_fiat,
        ubicacion: editForm.ubicacion || null,
        stock_minimo: editForm.stock_minimo,
        precio_costo: editForm.precio_costo ? Number(editForm.precio_costo) : null,
        precio_venta: editForm.precio_venta ? Number(editForm.precio_venta) : null,
        // Pricing engine
        marca:                    editForm.marca.trim() || null,
        moneda:                   editForm.moneda,
        precio_lista:             editForm.precio_lista ? Number(editForm.precio_lista) : null,
        descuento_fabricante:     editForm.descuento_fabricante ? Number(editForm.descuento_fabricante) : 0,
        familia_fiscal:           editForm.familia_fiscal,
        precio_minimo_autorizado: editForm.precio_minimo_autorizado ? Number(editForm.precio_minimo_autorizado) : null,
        vigencia_desde:           editForm.vigencia_desde || null,
        vigencia_hasta:           editForm.vigencia_hasta || null,
        discontinuado:            editForm.discontinuado,
      }).eq('id', repuesto.id)
      if (error) throw error
      notify.success('Repuesto actualizado')
      queryClient.invalidateQueries({ queryKey: ['repuestos'] })
      queryClient.invalidateQueries({ queryKey: ['precio-venta'] })
      setShowEditar(false)
      onClose()
    } catch (err: any) {
      notify.error(err?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    try {
      await registrarMov.mutateAsync({
        repuesto_id: repuesto.id,
        tipo,
        cantidad,
        motivo: motivo || undefined,
      })
      notify.success(`${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado: ${cantidad} unidades`)
      onClose()
    } catch (err: any) {
      notify.error(err?.message || 'Error al registrar movimiento')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-bg-secondary rounded-t-2xl sm:rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-text-primary">{repuesto.descripcion}</h3>
              <p className="text-xs text-text-muted">
                Código: <span className="font-mono text-action">{repuesto.codigo_fiat}</span> | Stock: <span className="font-bold text-text-primary">{repuesto.stock_actual}</span>
                {repuesto.ubicacion && <> | 📍 {repuesto.ubicacion}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowEditar(!showEditar)}
                className="text-xs text-action hover:text-action/80 underline cursor-pointer">
                Editar
              </button>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bloque de pricing en vivo (solo cuando NO se está editando) */}
        {!showEditar && tienePricing && precio && (
          <div className="px-4 pt-4">
            <div className="bg-bg-primary border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">
                  Precio sugerido
                </span>
                <span className="text-[10px] text-text-muted">
                  {precio.tier} · IVA {Math.round(precio.iva_rate * 100)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-green-400">{formatARS(precio.precio_final)}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-text-muted pt-1 border-t border-border/50">
                <div className="flex justify-between"><span>Lista</span><span className="text-text-secondary">{formatARS(precio.precio_lista)}</span></div>
                <div className="flex justify-between"><span>Neto</span><span className="text-text-secondary">{formatARS(precio.precio_neto)}</span></div>
                <div className="flex justify-between"><span>Costo</span><span className="text-text-secondary">{formatARS(precio.precio_costo)}</span></div>
                <div className="flex justify-between"><span>Markup</span><span className="text-text-secondary">{formatARS(precio.precio_markup)}</span></div>
                {precio.cotizacion_usd && (
                  <div className="flex justify-between col-span-2"><span>USD</span><span className="text-text-secondary">{precio.fuente_cotiz} @ {precio.cotizacion_usd}</span></div>
                )}
              </div>
              {precio.warnings.length > 0 && (
                <p className="text-[10px] text-amber-400/90">⚠ {precio.warnings.join(' · ')}</p>
              )}
            </div>
          </div>
        )}

        {!showEditar && !tienePricing && (
          <div className="px-4 pt-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-200">
              Sin <code>precio_lista</code> FIAT cargado. Usá "Editar" para cargar pricing y activar el motor.
            </div>
          </div>
        )}

        {showEditar ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Pencil className="h-4 w-4 text-action" />
              <h4 className="font-bold text-text-primary text-sm">Editar repuesto</h4>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Código FIAT</label>
              <input type="text" value={editForm.codigo_fiat}
                onChange={e => setEditForm({ ...editForm, codigo_fiat: e.target.value })}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-action/30" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Descripción</label>
              <input type="text" value={editForm.descripcion}
                onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Ubicación</label>
              <input type="text" value={editForm.ubicacion}
                onChange={e => setEditForm({ ...editForm, ubicacion: e.target.value })}
                placeholder="Ej: Estante A3"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Stock mín.</label>
                <input type="number" value={editForm.stock_minimo} min={0}
                  onChange={e => setEditForm({ ...editForm, stock_minimo: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">P. costo</label>
                <input type="number" value={editForm.precio_costo}
                  onChange={e => setEditForm({ ...editForm, precio_costo: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">P. venta</label>
                <input type="number" value={editForm.precio_venta}
                  onChange={e => setEditForm({ ...editForm, precio_venta: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
              </div>
            </div>

            {/* Bloque pricing engine */}
            <div className="pt-3 mt-1 border-t border-border space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">
                Pricing engine (lista FIAT)
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Marca</label>
                  <input type="text" value={editForm.marca}
                    onChange={e => setEditForm({ ...editForm, marca: e.target.value })}
                    placeholder="FIAT, Mopar..."
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Moneda</label>
                  <select value={editForm.moneda}
                    onChange={e => setEditForm({ ...editForm, moneda: e.target.value as 'ARS' | 'USD' })}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none">
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Precio lista *</label>
                  <input type="number" step="0.01" value={editForm.precio_lista}
                    onChange={e => setEditForm({ ...editForm, precio_lista: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Descuento fab. %</label>
                  <input type="number" step="0.1" min={0} max={100} value={editForm.descuento_fabricante}
                    onChange={e => setEditForm({ ...editForm, descuento_fabricante: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Familia fiscal</label>
                <select value={editForm.familia_fiscal}
                  onChange={e => setEditForm({ ...editForm, familia_fiscal: e.target.value as Repuesto['familia_fiscal'] })}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none">
                  <option value="gravado_normal">Gravado normal (IVA 21%)</option>
                  <option value="exento_19640">Exento Ley 19.640 (TDF → IVA 0%)</option>
                  <option value="no_gravado">No gravado (siempre IVA 0%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Precio mínimo autorizado</label>
                <input type="number" step="0.01" value={editForm.precio_minimo_autorizado}
                  onChange={e => setEditForm({ ...editForm, precio_minimo_autorizado: e.target.value })}
                  placeholder="Sin piso (opcional)"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
                <p className="text-[10px] text-text-muted mt-0.5">Por debajo de este valor la venta requiere aprobación del director.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Vigencia desde</label>
                  <input type="date" value={editForm.vigencia_desde}
                    onChange={e => setEditForm({ ...editForm, vigencia_desde: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Vigencia hasta</label>
                  <input type="date" value={editForm.vigencia_hasta}
                    onChange={e => setEditForm({ ...editForm, vigencia_hasta: e.target.value })}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={editForm.discontinuado}
                  onChange={e => setEditForm({ ...editForm, discontinuado: e.target.checked })}
                  className="w-4 h-4" />
                Producto discontinuado
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" fullWidth onClick={() => setShowEditar(false)}>Cancelar</Button>
              <Button fullWidth onClick={handleSaveEdit} loading={saving}>Guardar cambios</Button>
            </div>
          </div>
        ) : !showHistorial ? (
          <div className="p-4 space-y-4">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipo('ingreso')}
                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  tipo === 'ingreso' ? 'bg-green-600 text-white' : 'bg-bg-tertiary text-text-secondary'
                }`}>
                <Plus className="h-4 w-4" /> Ingreso
              </button>
              <button onClick={() => setTipo('egreso')}
                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  tipo === 'egreso' ? 'bg-red-600 text-white' : 'bg-bg-tertiary text-text-secondary'
                }`}>
                <Minus className="h-4 w-4" /> Egreso
              </button>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Cantidad</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="w-12 h-12 rounded-xl bg-bg-tertiary text-text-primary font-bold text-xl cursor-pointer">-</button>
                <input type="number" value={cantidad} min={1}
                  onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-2xl font-bold bg-bg-primary border border-border rounded-xl py-2 text-text-primary focus:outline-none" />
                <button onClick={() => setCantidad(cantidad + 1)}
                  className="w-12 h-12 rounded-xl bg-bg-tertiary text-text-primary font-bold text-xl cursor-pointer">+</button>
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Motivo (opcional)</label>
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Compra proveedor, Venta mostrador, OT-123..."
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
            </div>

            {/* Preview */}
            <div className={`rounded-xl p-3 text-center ${tipo === 'ingreso' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <p className="text-xs text-text-muted">Stock después del movimiento</p>
              <p className="text-2xl font-bold text-text-primary">
                {repuesto.stock_actual} → {tipo === 'ingreso' ? repuesto.stock_actual + cantidad : repuesto.stock_actual - cantidad}
              </p>
              {tipo === 'egreso' && repuesto.stock_actual - cantidad < 0 && (
                <p className="text-xs text-red-400 font-bold mt-1">Stock insuficiente</p>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button onClick={() => setShowHistorial(true)}
                className="p-2.5 bg-bg-tertiary rounded-xl text-text-muted hover:text-text-primary cursor-pointer" title="Ver historial">
                <History className="h-5 w-5" />
              </button>
              <Button fullWidth onClick={handleSubmit} loading={registrarMov.isPending}
                disabled={tipo === 'egreso' && repuesto.stock_actual - cantidad < 0}>
                {tipo === 'ingreso' ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                Registrar {tipo}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-text-primary text-sm">Últimos movimientos</h4>
              <button onClick={() => setShowHistorial(false)} className="text-xs text-action cursor-pointer">← Volver</button>
            </div>
            {!movimientos?.length ? (
              <p className="text-text-muted text-sm text-center py-4">Sin movimientos</p>
            ) : (
              movimientos.map(mov => (
                <div key={mov.id} className="flex items-center gap-3 text-sm border-b border-border/50 pb-2">
                  <span className={`text-lg ${mov.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                    {mov.tipo === 'ingreso' ? '↑' : '↓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium">
                      {mov.tipo === 'ingreso' ? '+' : '-'}{mov.cantidad} → Stock: {mov.stock_posterior}
                    </p>
                    {mov.motivo && <p className="text-xs text-text-muted truncate">{mov.motivo}</p>}
                  </div>
                  <span className="text-xs text-text-muted shrink-0">
                    {new Date(mov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Formulario nuevo repuesto — con scanner integrado en el campo código
// ============================================================
function NuevoRepuestoForm({ codigoInicial, sucursalForzada, onCreated, onClose }: {
  codigoInicial: string
  sucursalForzada?: 'Ushuaia' | 'Rio Grande'
  onCreated: (rep: Repuesto) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    codigo_fiat: codigoInicial,
    descripcion: '',
    ubicacion: '',
    stock_actual: 0,
    stock_minimo: 0,
    precio_costo: '',
    precio_venta: '',
  })
  const [showScanner, setShowScanner] = useState(false)
  const crearRepuesto = useCrearRepuesto()

  const handleSubmit = async () => {
    if (!form.codigo_fiat) {
      notify.error('El código es obligatorio')
      return
    }
    try {
      const rep = await crearRepuesto.mutateAsync({
        codigo_fiat: form.codigo_fiat,
        descripcion: form.descripcion || form.codigo_fiat,
        ubicacion: form.ubicacion || undefined,
        stock_actual: form.stock_actual,
        stock_minimo: form.stock_minimo,
        precio_costo: form.precio_costo ? Number(form.precio_costo) : undefined,
        precio_venta: form.precio_venta ? Number(form.precio_venta) : undefined,
        sucursal: sucursalForzada,
      })
      notify.success(`Repuesto creado${sucursalForzada ? ` en ${sucursalForzada}` : ''}`)
      onCreated(rep)
    } catch (err: any) {
      notify.error(err?.message || 'Error al crear repuesto')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-bg-secondary rounded-t-2xl sm:rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-text-primary">Nuevo repuesto</h3>
            {sucursalForzada && (
              <p className="text-xs text-action mt-0.5">📍 Sucursal: {sucursalForzada}</p>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {/* Código FIAT con botón scanner */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Código FIAT *</label>
            <div className="flex gap-2">
              <input type="text" value={form.codigo_fiat}
                onChange={e => setForm({ ...form, codigo_fiat: e.target.value })}
                placeholder="Ej: 51987654"
                className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-action/30" />
              <button
                onClick={() => setShowScanner(!showScanner)}
                className={`px-3 py-2 rounded-lg font-bold text-sm cursor-pointer transition-colors ${
                  showScanner ? 'bg-red-600 text-white' : 'bg-action/10 text-action hover:bg-action/20'
                }`}
                title="Escanear código de barras"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scanner inline — se abre debajo del campo código */}
          {showScanner && (
            <InlineScanner
              onScan={(code) => {
                setForm(f => ({ ...f, codigo_fiat: code }))
                setShowScanner(false)
                notify.success(`Código escaneado: ${code}`)
              }}
              onClose={() => setShowScanner(false)}
            />
          )}

          <div>
            <label className="block text-xs text-text-muted mb-1">Descripción *</label>
            <input type="text" value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Filtro de aceite motor 1.3"
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Ubicación</label>
            <input type="text" value={form.ubicacion}
              onChange={e => setForm({ ...form, ubicacion: e.target.value })}
              placeholder="Ej: Estante A3"
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Stock inicial</label>
              <input type="number" value={form.stock_actual} min={0}
                onChange={e => setForm({ ...form, stock_actual: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Stock mínimo</label>
              <input type="number" value={form.stock_minimo} min={0}
                onChange={e => setForm({ ...form, stock_minimo: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Precio costo</label>
              <input type="number" value={form.precio_costo}
                onChange={e => setForm({ ...form, precio_costo: e.target.value })}
                placeholder="$"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Precio venta</label>
              <input type="number" value={form.precio_venta}
                onChange={e => setForm({ ...form, precio_venta: e.target.value })}
                placeholder="$"
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" />
            </div>
          </div>
          <Button fullWidth onClick={handleSubmit} loading={crearRepuesto.isPending}>
            Guardar repuesto
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Card de un repuesto (incluye precio sugerido y stock por sucursal)
// ============================================================
function RepuestoCard({
  rep,
  clienteId,
  onClick,
}: {
  rep: Repuesto
  clienteId: string
  onClick: () => void
}) {
  const tienePricing = rep.precio_lista != null

  // Si el repuesto no tiene precio_lista, no llamamos al motor
  // (lanza excepción). Mostramos el precio_venta legacy.
  const { data: precio } = usePrecioVenta({
    productoId: rep.id,
    clienteId,
    enabled: tienePricing,
  })

  const { data: stock } = useStockDisponibleAgregado({
    productoId: rep.id,
  })

  const badges = getPricingBadges({
    vigenciaHasta: rep.vigencia_hasta,
    discontinuado: rep.discontinuado,
    familiaFiscal: rep.familia_fiscal,
    condicionIvaCliente: 'CF', // se refina con cliente seleccionado abajo si querés
    provinciaCliente: 'TDF',
    precioFinal: precio?.precio_final ?? null,
    precioMinimoAutorizado: rep.precio_minimo_autorizado,
  })

  const badgeColors: Record<string, string> = {
    red:    'bg-red-500/20 text-red-300 border-red-500/40',
    gray:   'bg-bg-tertiary text-text-muted border-border',
    green:  'bg-green-500/20 text-green-300 border-green-500/40',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  }

  const bajoStock = rep.stock_actual <= rep.stock_minimo
  const detalle = stock?.detalle_por_sucursal ?? []

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-secondary rounded-xl border border-border p-3 hover:border-action/40 transition-colors cursor-pointer"
    >
      {/* Línea 1: código, ubicación, marca */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-action bg-action/10 px-1.5 py-0.5 rounded">
              {rep.codigo_fiat}
            </span>
            {rep.marca && (
              <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded uppercase">
                {rep.marca}
              </span>
            )}
            {rep.ubicacion && (
              <span className="text-xs text-text-muted">📍 {rep.ubicacion}</span>
            )}
          </div>
          <p className="text-sm text-text-primary mt-1 truncate">{rep.descripcion}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold ${bajoStock ? 'text-amber-400' : 'text-text-primary'}`}>
            {rep.stock_actual}
          </p>
          <p className="text-[10px] text-text-muted">unidades</p>
        </div>
      </div>

      {/* Línea 2: precio y stock por sucursal */}
      <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-border/50">
        <div className="min-w-0">
          {tienePricing ? (
            precio ? (
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-green-400">
                  {formatARS(precio.precio_final)}
                </span>
                <span className="text-[10px] text-text-muted">
                  {precio.tier} · IVA {Math.round(precio.iva_rate * 100)}%
                </span>
                {rep.moneda === 'USD' && precio.cotizacion_usd && (
                  <span className="text-[10px] text-text-muted">
                    USD@{precio.cotizacion_usd}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-text-muted">Calculando…</span>
            )
          ) : rep.precio_venta != null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-text-secondary">
                {formatARS(rep.precio_venta)}
              </span>
              <span className="text-[10px] text-amber-400/80">Sin lista FIAT</span>
            </div>
          ) : (
            <span className="text-xs text-text-muted">Sin precio</span>
          )}
        </div>

        {/* Stock por sucursal — mini */}
        {detalle.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {detalle.map((d) => (
              <span
                key={d.sucursal}
                className="text-[10px] bg-bg-tertiary text-text-secondary px-1.5 py-0.5 rounded"
                title={`Físico ${d.detalle.stock_fisico} · Reservado ${d.detalle.reservado} · Disponible ${d.detalle.disponible}`}
              >
                {d.sucursal === 'Ushuaia' ? 'USH' : d.sucursal === 'Rio Grande' ? 'RG' : 'DC'}: {d.detalle.disponible}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {badges.map((b) => (
            <span
              key={b.type}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColors[b.variant]}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Warnings desde calcular_precio_venta */}
      {precio?.warnings?.length ? (
        <p className="text-[10px] text-amber-400/80 mt-1 truncate">
          ⚠ {precio.warnings.join(' · ')}
        </p>
      ) : null}
    </button>
  )
}

// ============================================================
// Página principal de Repuestos
// ============================================================
export function RepuestosPage() {
  const { perfil } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [selectedRepuesto, setSelectedRepuesto] = useState<Repuesto | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [codigoNuevo, setCodigoNuevo] = useState('')
  const [pageError, setPageError] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState<string>(CLIENTE_MOSTRADOR_ID)
  const [sucursalTab, setSucursalTab] = useState<'Rio Grande' | 'Ushuaia' | 'Todas'>('Rio Grande')
  const [seccion, setSeccion] = useState<'stock' | 'pedidos'>('stock')

  // Si el usuario tiene sucursal específica, no puede cambiar de tab.
  const tabBloqueado = !!(perfil?.sucursal && perfil.sucursal !== 'Ambas')

  const { data: repuestos = [], isLoading, error: queryError } = useRepuestos(busqueda, sucursalTab)
  const { data: clientes = [] } = useClientes()

  useEffect(() => {
    if (queryError) setPageError((queryError as any)?.message || 'Error al cargar repuestos')
  }, [queryError])

  const stockBajo = repuestos.filter(r => r.stock_actual <= r.stock_minimo)

  if (pageError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-text-primary">Repuestos</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 font-bold mb-1">Error al cargar el módulo</p>
          <p className="text-sm text-red-300">{pageError}</p>
          <p className="text-xs text-red-300/60 mt-2">Verificá que la tabla <code>repuestos</code> exista en Supabase (migración 008).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Repuestos</h1>
          <p className="text-sm text-text-secondary">
            {seccion === 'stock' ? 'Stock y movimientos' : 'Pedidos al cliente'}
          </p>
        </div>
        {seccion === 'stock' && (
          <Button onClick={() => { setCodigoNuevo(''); setShowNuevo(true) }}>
            <Plus className="h-4 w-4" />
            Nuevo repuesto
          </Button>
        )}
      </div>

      {/* Tabs principales: Stock | Pedidos */}
      <Tabs
        tabs={[
          { id: 'stock',   label: 'Stock' },
          { id: 'pedidos', label: 'Pedidos' },
        ]}
        activeTab={seccion}
        onChange={(id) => setSeccion(id as 'stock' | 'pedidos')}
      />

      {/* Tabs por sucursal — visible en ambas secciones (Stock y Pedidos).
          Para usuarios atados a una sucursal específica, el filtro lo aplica el hook. */}
      {!tabBloqueado && (
        <Tabs
          tabs={[
            { id: 'Rio Grande', label: 'Río Grande' },
            { id: 'Ushuaia', label: 'Ushuaia' },
            { id: 'Todas', label: 'Todas' },
          ]}
          activeTab={sucursalTab}
          onChange={(id) => setSucursalTab(id as 'Rio Grande' | 'Ushuaia' | 'Todas')}
        />
      )}

      {/* === SECCIÓN PEDIDOS === */}
      {seccion === 'pedidos' && (
        <PedidosSection sucursal={sucursalTab} />
      )}

      {/* === SECCIÓN STOCK === */}
      {seccion === 'stock' && <>

      {/* Selector de cliente — afecta el precio sugerido por tier */}
      <div className="bg-bg-secondary border border-border rounded-xl p-3">
        <label className="text-[11px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5 mb-1">
          <Users className="h-3.5 w-3.5" />
          Cliente para cálculo de precio
        </label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
        >
          {clientes.length === 0 && (
            <option value={CLIENTE_MOSTRADOR_ID}>MOSTRADOR — Consumidor Final (default)</option>
          )}
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.cuit ? `· CUIT ${c.cuit}` : ''} · {c.condicion_iva}/{c.provincia}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-text-primary">{repuestos.length}</p>
          <p className="text-xs text-text-muted">Artículos</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-text-primary">{repuestos.reduce((s, r) => s + r.stock_actual, 0)}</p>
          <p className="text-xs text-text-muted">Unidades total</p>
        </Card>
        <Card className={`p-3 text-center ${stockBajo.length > 0 ? 'border-amber-500/50' : ''}`}>
          <p className={`text-2xl font-bold ${stockBajo.length > 0 ? 'text-amber-400' : 'text-green-400'}`}>{stockBajo.length}</p>
          <p className="text-xs text-text-muted">Stock bajo</p>
        </Card>
      </div>

      {/* Alerta stock bajo */}
      {stockBajo.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-200">{stockBajo.length} repuestos con stock bajo</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {stockBajo.slice(0, 5).map(r => (
              <button key={r.id} onClick={() => setSelectedRepuesto(r)}
                className="text-xs bg-amber-500/20 px-2 py-0.5 rounded text-amber-200 cursor-pointer hover:bg-amber-500/30">
                {r.codigo_fiat} ({r.stock_actual})
              </button>
            ))}
            {stockBajo.length > 5 && <span className="text-xs text-amber-200/60">+{stockBajo.length - 5} más</span>}
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código o descripción..." />

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-16 animate-pulse bg-bg-tertiary">
              <div className="h-4 w-1/3 bg-bg-secondary rounded" />
            </Card>
          ))}
        </div>
      ) : repuestos.length === 0 ? (
        <EmptyState
          icon={<Package className="h-12 w-12" />}
          title="Sin repuestos"
          description={busqueda ? 'No se encontraron repuestos' : 'Creá tu primer repuesto con el botón "Nuevo repuesto"'}
        />
      ) : (
        <div className="space-y-2">
          {repuestos.map(rep => (
            <RepuestoCard
              key={rep.id}
              rep={rep}
              clienteId={clienteId}
              onClick={() => setSelectedRepuesto(rep)}
            />
          ))}
        </div>
      )}

      </>}
      {/* === FIN SECCIÓN STOCK === */}

      {/* Panel de movimiento */}
      {selectedRepuesto && (
        <MovimientoPanel
          repuesto={selectedRepuesto}
          clienteId={clienteId}
          onClose={() => setSelectedRepuesto(null)}
        />
      )}

      {/* Crear nuevo repuesto — sucursal según tab activo (o la del perfil si está atado a una). */}
      {showNuevo && (
        <NuevoRepuestoForm
          codigoInicial={codigoNuevo}
          sucursalForzada={
            tabBloqueado
              ? (perfil!.sucursal as 'Ushuaia' | 'Rio Grande')
              : sucursalTab === 'Todas'
                ? 'Rio Grande'
                : sucursalTab
          }
          onCreated={(rep) => { setShowNuevo(false); setSelectedRepuesto(rep) }}
          onClose={() => setShowNuevo(false)}
        />
      )}
    </div>
  )
}
