import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { ScanLine, Package, Plus, Minus, AlertTriangle, X, History, Camera, CameraOff } from 'lucide-react'
import { useRepuestos, useRepuestoPorCodigo, useCrearRepuesto, useRegistrarMovimiento, useMovimientos } from '../../hooks/useRepuestos'
import { Button, Card, SearchInput, EmptyState, notify } from '../../components/ui'
import type { Repuesto } from '../../lib/types'

function BarcodeScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    // Habilitar todos los formatos de código de barras comunes
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
    ]

    const scanner = new Html5Qrcode('barcode-reader', {
      formatsToSupport,
      verbose: false,
    })
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      {
        fps: 15,
        qrbox: { width: 300, height: 150 },
        aspectRatio: 1.5,
        disableFlip: false,
      },
      (decodedText) => {
        if (scannedRef.current) return
        scannedRef.current = true
        setLastScanned(decodedText)
        scanner.stop().catch(() => {})
        onScanRef.current(decodedText)
      },
      () => {} // ignore frame errors
    ).catch((err) => {
      setError('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
      console.error('Scanner error:', err)
    })

    return () => {
      scanner.stop().catch(() => {})
    }
  }, []) // sin deps — se monta una sola vez

  const [manualCode, setManualCode] = useState('')

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      scannerRef.current?.stop().catch(() => {})
      onScanRef.current(manualCode.trim())
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/80">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-action" />
          <span className="text-white font-bold">Escaneá el código de barras</span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {error ? (
          <div className="text-center p-8">
            <CameraOff className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-white/80 text-sm">{error}</p>
          </div>
        ) : (
          <div id="barcode-reader" className="w-full max-w-md" />
        )}
      </div>

      {lastScanned && (
        <div className="px-4 py-2 bg-green-600 text-center">
          <p className="text-white font-bold">Leído: {lastScanned}</p>
        </div>
      )}

      {/* Ingreso manual como fallback */}
      <div className="p-4 bg-black/90 space-y-3">
        <p className="text-white/50 text-xs text-center">
          {error ? 'Ingresá el código manualmente:' : 'Si no escanea, ingresá el código a mano:'}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
            placeholder="Ej: 51987654"
            className="flex-1 px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-action/50"
            autoComplete="off"
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualCode.trim()}
            className="px-4 py-2.5 bg-action text-white rounded-lg font-bold text-sm cursor-pointer disabled:opacity-40"
          >
            Buscar
          </button>
        </div>
      </div>
    </div>
  )
}

function MovimientoPanel({ repuesto, onClose }: { repuesto: Repuesto; onClose: () => void }) {
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState('')
  const registrarMov = useRegistrarMovimiento()
  const { data: movimientos } = useMovimientos(repuesto.id)
  const [showHistorial, setShowHistorial] = useState(false)

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
              <p className="text-xs text-text-muted">Código: {repuesto.codigo_fiat} | Stock: <span className="font-bold text-text-primary">{repuesto.stock_actual}</span></p>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!showHistorial ? (
          <div className="p-4 space-y-4">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTipo('ingreso')}
                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  tipo === 'ingreso'
                    ? 'bg-green-600 text-white'
                    : 'bg-bg-tertiary text-text-secondary'
                }`}
              >
                <Plus className="h-4 w-4" />
                Ingreso
              </button>
              <button
                onClick={() => setTipo('egreso')}
                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  tipo === 'egreso'
                    ? 'bg-red-600 text-white'
                    : 'bg-bg-tertiary text-text-secondary'
                }`}
              >
                <Minus className="h-4 w-4" />
                Egreso
              </button>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Cantidad</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="w-12 h-12 rounded-xl bg-bg-tertiary text-text-primary font-bold text-xl cursor-pointer hover:bg-bg-primary transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={cantidad}
                  onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-2xl font-bold bg-bg-primary border border-border rounded-xl py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
                  min={1}
                />
                <button
                  onClick={() => setCantidad(cantidad + 1)}
                  className="w-12 h-12 rounded-xl bg-bg-tertiary text-text-primary font-bold text-xl cursor-pointer hover:bg-bg-primary transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Compra proveedor, Venta mostrador, OT-123..."
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/30"
              />
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
              <button
                onClick={() => setShowHistorial(true)}
                className="p-2.5 bg-bg-tertiary rounded-xl text-text-muted hover:text-text-primary cursor-pointer"
                title="Ver historial"
              >
                <History className="h-5 w-5" />
              </button>
              <Button
                fullWidth
                onClick={handleSubmit}
                loading={registrarMov.isPending}
                disabled={tipo === 'egreso' && repuesto.stock_actual - cantidad < 0}
              >
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

function NuevoRepuestoForm({ codigoInicial, onCreated, onClose }: {
  codigoInicial: string
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
  const crearRepuesto = useCrearRepuesto()

  const handleSubmit = async () => {
    if (!form.codigo_fiat || !form.descripcion) {
      notify.error('Código y descripción son obligatorios')
      return
    }
    try {
      const rep = await crearRepuesto.mutateAsync({
        codigo_fiat: form.codigo_fiat,
        descripcion: form.descripcion,
        ubicacion: form.ubicacion || undefined,
        stock_actual: form.stock_actual,
        stock_minimo: form.stock_minimo,
        precio_costo: form.precio_costo ? Number(form.precio_costo) : undefined,
        precio_venta: form.precio_venta ? Number(form.precio_venta) : undefined,
      })
      notify.success('Repuesto creado')
      onCreated(rep)
    } catch (err: any) {
      notify.error(err?.message || 'Error al crear repuesto')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-bg-secondary rounded-t-2xl sm:rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-text-primary">Nuevo repuesto</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Código FIAT *</label>
            <input type="text" value={form.codigo_fiat}
              onChange={e => setForm({ ...form, codigo_fiat: e.target.value })}
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-action/30" />
          </div>
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
              <input type="number" value={form.stock_actual}
                onChange={e => setForm({ ...form, stock_actual: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" min={0} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Stock mínimo</label>
              <input type="number" value={form.stock_minimo}
                onChange={e => setForm({ ...form, stock_minimo: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none" min={0} />
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

export function RepuestosPage() {
  const [busqueda, setBusqueda] = useState('')
  const [scanning, setScanning] = useState(false)
  const [codigoEscaneado, setCodigoEscaneado] = useState<string | null>(null)
  const [selectedRepuesto, setSelectedRepuesto] = useState<Repuesto | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [codigoNuevo, setCodigoNuevo] = useState('')

  const { data: repuestos = [], isLoading } = useRepuestos(busqueda)
  const { data: repuestoEscaneado } = useRepuestoPorCodigo(codigoEscaneado)

  // Cuando se escanea un código, buscar en la base
  useEffect(() => {
    if (codigoEscaneado && repuestoEscaneado !== undefined) {
      if (repuestoEscaneado) {
        setSelectedRepuesto(repuestoEscaneado)
        notify.success(`Encontrado: ${repuestoEscaneado.descripcion}`)
      } else {
        // No existe → ofrecer crear
        setCodigoNuevo(codigoEscaneado)
        setShowNuevo(true)
        notify.info('Código no encontrado — creá el repuesto')
      }
      setCodigoEscaneado(null)
    }
  }, [codigoEscaneado, repuestoEscaneado])

  const stockBajo = repuestos.filter(r => r.stock_actual <= r.stock_minimo)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Repuestos</h1>
          <p className="text-sm text-text-secondary">Stock y movimientos con scanner</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setScanning(true)}>
            <Camera className="h-4 w-4" />
            Escanear
          </Button>
          <Button variant="secondary" onClick={() => { setCodigoNuevo(''); setShowNuevo(true) }}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
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
              <button
                key={r.id}
                onClick={() => setSelectedRepuesto(r)}
                className="text-xs bg-amber-500/20 px-2 py-0.5 rounded text-amber-200 cursor-pointer hover:bg-amber-500/30"
              >
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
          description={busqueda ? 'No se encontraron repuestos' : 'Escaneá un código de barras para empezar'}
        />
      ) : (
        <div className="space-y-2">
          {repuestos.map(rep => (
            <button
              key={rep.id}
              onClick={() => setSelectedRepuesto(rep)}
              className="w-full text-left bg-bg-secondary rounded-xl border border-border p-3 hover:border-action/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-action bg-action/10 px-1.5 py-0.5 rounded">{rep.codigo_fiat}</span>
                    {rep.ubicacion && <span className="text-xs text-text-muted">📍 {rep.ubicacion}</span>}
                  </div>
                  <p className="text-sm text-text-primary mt-0.5 truncate">{rep.descripcion}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`text-lg font-bold ${rep.stock_actual <= rep.stock_minimo ? 'text-amber-400' : 'text-text-primary'}`}>
                    {rep.stock_actual}
                  </p>
                  <p className="text-[10px] text-text-muted">unidades</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Scanner */}
      {scanning && (
        <BarcodeScanner
          onScan={(code) => {
            setScanning(false)
            setCodigoEscaneado(code)
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {/* Panel de movimiento */}
      {selectedRepuesto && (
        <MovimientoPanel
          repuesto={selectedRepuesto}
          onClose={() => setSelectedRepuesto(null)}
        />
      )}

      {/* Crear nuevo repuesto */}
      {showNuevo && (
        <NuevoRepuestoForm
          codigoInicial={codigoNuevo}
          onCreated={(rep) => {
            setShowNuevo(false)
            setSelectedRepuesto(rep)
          }}
          onClose={() => setShowNuevo(false)}
        />
      )}
    </div>
  )
}
