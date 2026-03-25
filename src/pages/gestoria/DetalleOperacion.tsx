// ============================================================
// LASAC APP — DetalleOperacion
// Pipeline 6 pasos: cierre → documentacion → gestoria → alistamiento → calidad → entrega
// ============================================================

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageCircle,
  Flag,
  User,
  Car,
  ChevronRight,
  ExternalLink,
  CheckCheck,
  XCircle,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type {
  Operacion,
  Unidad,
  ContactoCalidad,
  AlistamientoPDI,
  HistorialEstado,
  EstadoActual,
  ConfirmacionCliente,
  Satisfaccion,
  ResultadoO2,
} from '../../lib/types'
import {
  getSemaforoCompromiso,
  getSemaforoRegistro,
  requierePrenda,
  puedeAvanzarPaso2,
} from '../../lib/types'
import {
  COLORES_TIPO,
  TIPO_LABEL,
  ESTADO_LABEL,
  PASOS_PIPELINE,
  waCitacionFirmaRG,
  waCitacionFirmaUSH,
  waConfirmacion2dRG,
  waConfirmacion2dUSH,
  waRecordatorio1h,
  waCartaFelicitaciones,
  waSeguimientoPost,
} from '../../lib/constants'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { notify } from '../../components/ui/Toast'
import { Checkbox } from '../../components/ui/Checkbox'

// ============================================================
// Tipos locales / helpers
// ============================================================

interface PagoSaldo {
  id: string
  operacion_id: string
  monto: number
  forma_pago: 'tarjeta' | 'transferencia' | 'efectivo'
  fecha: string
  observacion: string | null
  created_at: string
}

interface OperacionDetalle extends Operacion {
  unidades: Pick<Unidad, 'modelo' | 'vin_chasis' | 'color' | 'patente_nueva'> | null
  contactos_calidad: ContactoCalidad | null
  alistamiento_pdi: AlistamientoPDI | null
  pagos_saldo: PagoSaldo[]
}

const ESTADO_A_PASO: Record<EstadoActual, number> = {
  cierre: 1,
  documentacion: 2,
  gestoria: 3,
  alistamiento: 4,
  calidad: 5,
  entrega: 6,
  entregado: 6,
  caida: 0,
}

const COLORES_ESTADO_BADGE: Record<EstadoActual, BadgeColor> = {
  cierre: 'blue',
  documentacion: 'yellow',
  gestoria: 'purple',
  alistamiento: 'blue',
  calidad: 'orange',
  entrega: 'yellow',
  entregado: 'green',
  caida: 'red',
}

type BadgeColor = 'gray' | 'yellow' | 'green' | 'blue' | 'red' | 'orange' | 'purple'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function diasRestantes(fechaISO: string): number {
  return Math.round((new Date(fechaISO).getTime() - Date.now()) / 86_400_000)
}

function diasDesde(fechaISO: string): number {
  return Math.round((Date.now() - new Date(fechaISO).getTime()) / 86_400_000)
}

function buildHistorialItem(
  paso: string,
  estadoAnterior: string,
  estadoNuevo: string,
  usuarioId: string,
  usuarioNombre: string,
  motivo?: string,
): HistorialEstado {
  return {
    paso,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    fecha: new Date().toISOString(),
    usuario_id: usuarioId,
    usuario_nombre: usuarioNombre,
    motivo: motivo ?? null,
  }
}

function openWA(telefono: string | null | undefined, mensaje: string) {
  if (!telefono) {
    notify.error('El cliente no tiene teléfono registrado')
    return
  }
  const num = telefono.replace(/\D/g, '')
  const url = `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
  window.open(url, '_blank')
}

// ============================================================
// Componentes internos reutilizables
// ============================================================

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
      {children}
    </h3>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      <span className="text-sm text-text-primary text-right">{value ?? '-'}</span>
    </div>
  )
}

function BlockerBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function WarnBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 text-yellow-400 text-sm">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-bg-card border border-border rounded-xl p-4 ${className}`}>
      {children}
    </div>
  )
}

// ============================================================
// QUERY: cargar operación completa
// ============================================================

async function fetchOperacion(id: string): Promise<OperacionDetalle> {
  const { data, error } = await supabase
    .from('operaciones')
    .select(`
      *,
      unidades ( modelo, vin_chasis, color, patente_nueva ),
      contactos_calidad ( * ),
      alistamiento_pdi ( * ),
      pagos_saldo ( * )
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  // Supabase devuelve arrays en relaciones uno-a-muchos — normalizar a objetos individuales
  const raw = data as any
  if (Array.isArray(raw.unidades)) {
    raw.unidades = raw.unidades[0] ?? null
  }
  if (Array.isArray(raw.contactos_calidad)) {
    raw.contactos_calidad = raw.contactos_calidad[0] ?? null
  }
  if (Array.isArray(raw.alistamiento_pdi)) {
    raw.alistamiento_pdi = raw.alistamiento_pdi[0] ?? null
  }

  return raw as OperacionDetalle
}

// ============================================================
// BARRA DE PROGRESO PIPELINE
// ============================================================

function BarraPipeline({ estadoActual }: { estadoActual: EstadoActual }) {
  if (estadoActual === 'caida') {
    return (
      <div className="flex items-center gap-2 mb-6">
        <Badge color="red" size="md">Operación caída</Badge>
      </div>
    )
  }

  const pasoActual = ESTADO_A_PASO[estadoActual] ?? 0

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {PASOS_PIPELINE.map((paso, idx) => {
        const isCompleto = paso.numero < pasoActual
        const isActivo = paso.numero === pasoActual
        const isPendiente = paso.numero > pasoActual

        return (
          <div key={paso.key} className="flex items-center gap-1 min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-bold transition-all
                  ${isCompleto ? 'bg-green-600 border-green-600 text-white' : ''}
                  ${isActivo ? 'bg-action border-action text-white ring-2 ring-action/40' : ''}
                  ${isPendiente ? 'bg-bg-tertiary border-border text-text-muted' : ''}
                `}
              >
                {isCompleto ? <CheckCircle2 className="h-4 w-4" /> : paso.numero}
              </div>
              <span
                className={`text-xs whitespace-nowrap hidden sm:block
                  ${isActivo ? 'text-text-primary font-medium' : 'text-text-muted'}
                `}
              >
                {paso.label}
              </span>
            </div>
            {idx < PASOS_PIPELINE.length - 1 && (
              <div
                className={`h-px w-6 sm:w-10 shrink-0 mt-[-14px]
                  ${paso.numero < pasoActual ? 'bg-green-600' : 'bg-border'}
                `}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// BANDERAS VIAJERAS
// ============================================================

function BanderasViajeras({ op }: { op: OperacionDetalle }) {
  const semaforo = op.fecha_compromiso ? getSemaforoCompromiso(op.fecha_compromiso) : null
  const semaforoColors = { verde: 'text-green-400', amarillo: 'text-yellow-400', rojo: 'text-red-400' }
  const semaforoEmoji = { verde: '🟢', amarillo: '🟡', rojo: '🔴' }
  const necesitaPrenda = requierePrenda({ forma_pago: op.forma_pago, tipo_operacion: op.tipo_operacion })

  return (
    <div className="flex flex-wrap gap-3 mb-5 p-3 bg-bg-primary border border-border rounded-lg">
      {/* Prenda */}
      {necesitaPrenda && (
        <div className="flex items-center gap-1.5 text-sm">
          <Flag className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-text-muted">Prenda:</span>
          {op.estado_prenda === 'enviada' ? (
            <span className="text-green-400 font-medium">🟢 Enviada</span>
          ) : (
            <span className="text-red-400 font-medium">🔴 Pendiente</span>
          )}
        </div>
      )}

      {/* Compromiso */}
      {op.fecha_compromiso && semaforo && (
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-text-muted">Compromiso:</span>
          <span className={`font-medium ${semaforoColors[semaforo]}`}>
            {semaforoEmoji[semaforo]}{' '}
            {(() => {
              const d = diasRestantes(op.fecha_compromiso)
              if (d < 0) return `${Math.abs(d)} días vencido`
              if (d === 0) return 'Hoy'
              return `${d} días`
            })()}
          </span>
        </div>
      )}

      {/* Vendedor */}
      <div className="flex items-center gap-1.5 text-sm">
        <User className="h-3.5 w-3.5 text-text-muted" />
        <span className="text-text-muted">Asesor:</span>
        <span className="text-text-primary font-medium">
          {(op as any).asesor?.nombre_completo ?? 'Sin asignar'}
        </span>
      </div>
    </div>
  )
}

// ============================================================
// TABS
// ============================================================

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 border-b border-border mb-5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`
            px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer
            ${active === t.id
              ? 'border-action text-action'
              : 'border-transparent text-text-muted hover:text-text-primary'}
          `}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ============================================================
// PASO 1: Cierre
// ============================================================

function Paso1Cierre({
  op,
  onMutate,
}: {
  op: OperacionDetalle
  onMutate: (updates: Partial<Operacion>, historial?: HistorialEstado) => void
}) {
  const { perfil } = useAuth()
  const puedeConfirmar =
    op.estado_paso1 === 'creada' &&
    (perfil?.rol === 'director' || perfil?.rol === 'asesor_ush' || perfil?.rol === 'asesor_rg')

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle>Información del cierre</SectionTitle>
        <InfoRow label="N° EPOD" value={op.nro_epod} />
        <InfoRow label="Tipo" value={TIPO_LABEL[op.tipo_operacion]} />
        <InfoRow label="Forma de pago" value={
          op.forma_pago === 'contado' ? 'Contado'
          : op.forma_pago === 'financiado_banco' ? 'Financiado por banco'
          : op.forma_pago === 'plan_ahorro' ? 'Plan de Ahorro'
          : '-'
        } />
        {op.forma_pago === 'financiado_banco' && (
          <InfoRow label="Banco / Entidad" value={op.banco_entidad} />
        )}
        {op.tipo_operacion === 'plan_ahorro' && (
          <InfoRow label="N° Grupo / Orden" value={op.nro_grupo_orden} />
        )}
        <InfoRow label="Estado paso 1" value={op.estado_paso1} />
      </Card>

      {puedeConfirmar && (
        <Button
          onClick={() =>
            onMutate(
              { estado_actual: 'documentacion', estado_paso1: 'confirmada' },
              buildHistorialItem(
                'cierre',
                'cierre',
                'documentacion',
                perfil!.id,
                perfil!.nombre_completo,
              ),
            )
          }
          className="w-full"
        >
          <ChevronRight className="h-4 w-4" />
          Confirmar y avanzar al Paso 2
        </Button>
      )}

      {op.estado_paso1 === 'confirmada' && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Paso 1 confirmado
        </div>
      )}
    </div>
  )
}

// ============================================================
// PASO 2: Documentación
// ============================================================

function Paso2Documentacion({
  op,
  onMutate,
}: {
  op: OperacionDetalle
  onMutate: (updates: Partial<Operacion>, historial?: HistorialEstado) => void
}) {
  const { perfil } = useAuth()
  const esPlan = op.tipo_operacion === 'plan_ahorro'
  const esFinanciado = op.forma_pago === 'financiado_banco'

  const puedeAvanzar = puedeAvanzarPaso2({
    forma_pago: op.forma_pago,
    tipo_operacion: op.tipo_operacion,
    pago_cliente_completo: op.pago_cliente_completo,
    pago_banco_recibido: op.pago_banco_recibido,
    unidad_en_sucursal: op.unidad_en_sucursal,
  })

  function handleCheck(field: keyof Operacion, value: boolean) {
    onMutate({ [field]: value } as Partial<Operacion>)
  }

  function handleWACitar() {
    const nombre = op.cliente_nombre ?? ''
    const modelo = op.unidades?.modelo ?? 'su vehículo'
    const mensaje =
      op.sucursal === 'Rio Grande'
        ? waCitacionFirmaRG(nombre, modelo)
        : waCitacionFirmaUSH(nombre, modelo)
    openWA(op.cliente_telefono, mensaje)
    if (!op.cliente_citado) {
      onMutate({ cliente_citado: true })
    }
  }

  return (
    <div className="space-y-5">
      {/* Controles financieros — bloquean avance */}
      <Card>
        <SectionTitle>Controles financieros — bloquean avance</SectionTitle>
        <div className="space-y-3">
          <Checkbox
            label="Pago del cliente completo"
            checked={op.pago_cliente_completo}
            onChange={(e) => handleCheck('pago_cliente_completo', e.target.checked)}
          />
          {esFinanciado && (
            <Checkbox
              label="Pago del banco recibido"
              checked={op.pago_banco_recibido ?? false}
              onChange={(e) => handleCheck('pago_banco_recibido', e.target.checked)}
            />
          )}
        </div>
      </Card>

      {/* Controles de carpeta */}
      <Card>
        <SectionTitle>Controles de carpeta</SectionTitle>
        <div className="space-y-3">
          <Checkbox
            label="Carpeta OK"
            checked={op.carpeta_ok}
            onChange={(e) => handleCheck('carpeta_ok', e.target.checked)}
          />
          <Checkbox
            label="Chasis verificado"
            checked={op.chasis_verificado}
            onChange={(e) => handleCheck('chasis_verificado', e.target.checked)}
          />
          <Checkbox
            label="Unidad disponible"
            checked={op.unidad_disponible}
            onChange={(e) => handleCheck('unidad_disponible', e.target.checked)}
          />
          <Checkbox
            label="Papeles preparados"
            checked={op.papeles_preparados}
            onChange={(e) => handleCheck('papeles_preparados', e.target.checked)}
          />
          <div className="flex items-center justify-between gap-3">
            <Checkbox
              label="Cliente citado para firma"
              checked={op.cliente_citado}
              onChange={(e) => handleCheck('cliente_citado', e.target.checked)}
            />
            <Button
              variant="success"
              size="sm"
              onClick={handleWACitar}
              className="shrink-0 bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Citar por WA
            </Button>
          </div>

          {/* Extras plan ahorro */}
          {esPlan && (
            <>
              <Checkbox
                label="Papeles de terminal recibidos"
                checked={op.papeles_terminal_recibidos ?? false}
                onChange={(e) => handleCheck('papeles_terminal_recibidos', e.target.checked)}
              />
              <Checkbox
                label="Firmas adelantadas"
                checked={op.firmas_adelantadas ?? false}
                onChange={(e) => handleCheck('firmas_adelantadas', e.target.checked)}
              />
              <Checkbox
                label="Unidad en sucursal"
                checked={op.unidad_en_sucursal ?? false}
                onChange={(e) => handleCheck('unidad_en_sucursal', e.target.checked)}
              />
            </>
          )}
        </div>
      </Card>

      {/* Botón avanzar */}
      {!puedeAvanzar.ok && (
        <WarnBanner>No se puede avanzar: {puedeAvanzar.motivo}</WarnBanner>
      )}

      {op.estado_actual === 'documentacion' && (
        <Button
          disabled={!puedeAvanzar.ok}
          onClick={() =>
            onMutate(
              { estado_actual: 'gestoria' },
              buildHistorialItem(
                'documentacion',
                'documentacion',
                'gestoria',
                perfil!.id,
                perfil!.nombre_completo,
              ),
            )
          }
          className="w-full"
        >
          <ChevronRight className="h-4 w-4" />
          Avanzar al Paso 3 — Gestoría
        </Button>
      )}
    </div>
  )
}

// ============================================================
// PASO 3: Gestoría
// ============================================================

function Paso3Gestoria({
  op,
  onMutate,
}: {
  op: OperacionDetalle
  onMutate: (updates: Partial<Operacion>, historial?: HistorialEstado) => void
}) {
  const { perfil } = useAuth()

  const semaforoRegistro =
    op.fecha_ingreso_registro ? getSemaforoRegistro(op.fecha_ingreso_registro) : null
  const semaforoColors = { verde: 'text-green-400', amarillo: 'text-yellow-400', rojo: 'text-red-400' }
  const semaforoEmoji = { verde: '🟢', amarillo: '🟡', rojo: '🔴' }

  const puedeAvanzarPDI = true

  function handle(field: keyof Operacion, value: unknown) {
    onMutate({ [field]: value } as Partial<Operacion>)
  }

  return (
    <div className="space-y-5">
      {/* Sub-paso 1: Carpeta registral */}
      <Card>
        <SectionTitle>1 · Carpeta registral</SectionTitle>
        <Checkbox
          label="Carpeta registral lista"
          checked={op.carpeta_registral_lista}
          onChange={(e) => handle('carpeta_registral_lista', e.target.checked)}
        />
      </Card>

      {/* Sub-paso 2: Firma del cliente */}
      <Card>
        <SectionTitle>2 · Firma del cliente</SectionTitle>
        <Checkbox
          label="Cliente firmó la documentación"
          checked={op.cliente_firmo}
          onChange={(e) => handle('cliente_firmo', e.target.checked)}
        />
      </Card>

      {/* Sub-paso 3: Solicitud 02 */}
      <Card>
        <SectionTitle>3 · Solicitud 02</SectionTitle>
        <div className="space-y-3">
          <Checkbox
            label="02 solicitado"
            checked={op.o2_solicitado}
            onChange={(e) => handle('o2_solicitado', e.target.checked)}
          />
          {op.o2_solicitado && (
            <div>
              <label className="text-xs text-text-muted block mb-1">Resultado del 02</label>
              <select
                value={op.resultado_o2 ?? ''}
                onChange={(e) => handle('resultado_o2', e.target.value as ResultadoO2 || null)}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
              >
                <option value="">— Sin resultado —</option>
                <option value="libre">Libre</option>
                <option value="inhibido">Inhibido</option>
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Sub-paso 4: Ingreso al registro */}
      <Card>
        <SectionTitle>4 · Ingreso al Registro</SectionTitle>
        <div className="space-y-3">
          <Checkbox
            label="Ingresado al registro"
            checked={op.ingresado_registro}
            onChange={(e) => handle('ingresado_registro', e.target.checked)}
          />
          <div>
            <label className="text-xs text-text-muted block mb-1">Fecha de ingreso</label>
            <input
              type="date"
              value={op.fecha_ingreso_registro ?? ''}
              onChange={(e) => handle('fecha_ingreso_registro', e.target.value || null)}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50 disabled:opacity-50"
            />
          </div>

          {/* Semáforo tiempo en registro */}
          {op.fecha_ingreso_registro && semaforoRegistro && (
            <div className={`flex items-center gap-1.5 text-sm ${semaforoColors[semaforoRegistro]}`}>
              <Clock className="h-3.5 w-3.5" />
              <span>
                {semaforoEmoji[semaforoRegistro]}{' '}
                {diasDesde(op.fecha_ingreso_registro)} días en registro
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Sub-paso 5: Egreso del registro */}
      <Card>
        <SectionTitle>5 · Egreso del Registro</SectionTitle>
        <div className="space-y-3">
          <Checkbox
            label="Egresado del registro"
            checked={op.egresado_registro}
            onChange={(e) => handle('egresado_registro', e.target.checked)}
          />
          <div>
            <label className="text-xs text-text-muted block mb-1">Fecha de egreso</label>
            <input
              type="date"
              value={op.fecha_egreso_registro ?? ''}
              onChange={(e) => handle('fecha_egreso_registro', e.target.value || null)}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Dominio / Patente</label>
            <input
              type="text"
              placeholder="ABC 123"
              value={op.dominio_patente ?? ''}
              onChange={(e) => handle('dominio_patente', e.target.value || null)}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50 uppercase"
            />
          </div>
        </div>
      </Card>

      {/* Avanzar */}
      {op.estado_actual === 'gestoria' && (
        <>
          {!puedeAvanzarPDI && (
            <WarnBanner>
              Para avanzar: egreso del registro confirmado, dominio/patente cargado y 02 libre.
            </WarnBanner>
          )}
          <Button
            disabled={!puedeAvanzarPDI}
            onClick={() =>
              onMutate(
                { estado_actual: 'alistamiento' },
                buildHistorialItem(
                  'gestoria',
                  'gestoria',
                  'alistamiento',
                  perfil!.id,
                  perfil!.nombre_completo,
                ),
              )
            }
            className="w-full"
          >
            <ChevronRight className="h-4 w-4" />
            Avanzar a PDI / Alistamiento
          </Button>
        </>
      )}
    </div>
  )
}

// ============================================================
// PASO 4: Alistamiento PDI
// ============================================================

function Paso4Alistamiento({
  op,
  onMutate,
}: {
  op: OperacionDetalle
  onMutate: (updates: Partial<Operacion>, historial?: HistorialEstado) => void
}) {
  const { perfil } = useAuth()
  const navigate = useNavigate()

  const pdi = op.alistamiento_pdi
  const items = pdi?.checklist_pdi?.items ?? []
  const criticos = items.filter((i: any) => i.es_critico)
  const criticosOk = criticos.filter((i: any) => i.estado === 'OK')
  const todosOk = criticos.length > 0 && criticosOk.length === criticos.length

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle>Estado del PDI</SectionTitle>
        {pdi ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-bg-tertiary rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${todosOk ? 'bg-green-500' : 'bg-action'}`}
                  style={{ width: criticos.length > 0 ? `${(criticosOk.length / criticos.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm text-text-secondary shrink-0">
                {criticosOk.length}/{criticos.length} críticos OK
              </span>
            </div>

            {todosOk && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCheck className="h-4 w-4" />
                Todos los ítems críticos aprobados
              </div>
            )}

            {pdi.aprobado && (
              <Badge color="green" size="md">PDI Aprobado</Badge>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/alistamiento/${pdi.id}`)}
            >
              <ExternalLink className="h-4 w-4" />
              Ver detalle del PDI
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">PDI aún no iniciado.</p>
        )}
      </Card>

      {op.estado_actual === 'alistamiento' && (
        <>
          {!todosOk && (
            <WarnBanner>
              Para avanzar todos los ítems críticos del PDI deben estar OK.
            </WarnBanner>
          )}
          <Button
            disabled={!todosOk}
            onClick={() =>
              onMutate(
                { estado_actual: 'calidad' },
                buildHistorialItem(
                  'alistamiento',
                  'alistamiento',
                  'calidad',
                  perfil!.id,
                  perfil!.nombre_completo,
                ),
              )
            }
            className="w-full"
          >
            <ChevronRight className="h-4 w-4" />
            Avanzar a Calidad
          </Button>
        </>
      )}
    </div>
  )
}

// ============================================================
// PASO 5: Calidad
// ============================================================

function Paso5Calidad({
  op,
  calidad,
  onMutateCalidad,
  onMutateOp,
}: {
  op: OperacionDetalle
  calidad: ContactoCalidad | null
  onMutateCalidad: (updates: Partial<ContactoCalidad>) => void
  onMutateOp: (updates: Partial<Operacion>, historial?: HistorialEstado) => void
}) {
  const { perfil } = useAuth()

  const nombre = op.cliente_nombre ?? ''
  const modelo = op.unidades?.modelo ?? 'su vehículo'
  const vendedor = (op as any).asesor?.nombre_completo ?? ''

  function handleWA2d() {
    const fecha = calidad?.fecha_entrega_confirmada
      ? formatDate(calidad.fecha_entrega_confirmada)
      : '[FECHA]'
    const hora = '[HORA]'
    const mensaje =
      op.sucursal === 'Rio Grande'
        ? waConfirmacion2dRG(nombre, modelo, fecha, hora, vendedor)
        : waConfirmacion2dUSH(nombre, modelo, fecha, hora, vendedor)
    openWA(op.cliente_telefono, mensaje)
  }

  function handleWA1h() {
    openWA(op.cliente_telefono, waRecordatorio1h(nombre, modelo, vendedor))
  }

  function handleWACarta() {
    openWA(op.cliente_telefono, waCartaFelicitaciones(nombre, modelo))
  }

  function handleWAPost() {
    openWA(op.cliente_telefono, waSeguimientoPost(nombre, modelo))
  }

  const puedeAvanzar = calidad?.carta_enviada === true

  return (
    <div className="space-y-5">
      {/* Momento 1: 2 días antes */}
      <Card>
        <SectionTitle>Momento 1 — Confirmación 2 días antes</SectionTitle>
        <div className="space-y-3">
          <Checkbox
            label="Contacto 2 días antes realizado"
            checked={calidad?.contacto_2d_antes ?? false}
            onChange={(e) => onMutateCalidad({ contacto_2d_antes: e.target.checked })}
          />
          <div>
            <label className="text-xs text-text-muted block mb-1">¿Cliente confirmó?</label>
            <select
              value={calidad?.cliente_confirmo ?? ''}
              onChange={(e) =>
                onMutateCalidad({ cliente_confirmo: (e.target.value as ConfirmacionCliente) || null })
              }
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
            >
              <option value="">— Sin respuesta —</option>
              <option value="si">Sí, confirma</option>
              <option value="no">No confirma</option>
              <option value="reprograma">Quiere reprogramar</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Fecha de entrega confirmada</label>
            <input
              type="date"
              value={calidad?.fecha_entrega_confirmada ?? ''}
              onChange={(e) => onMutateCalidad({ fecha_entrega_confirmada: e.target.value || null })}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
            />
          </div>
          <Button
            variant="success"
            size="sm"
            onClick={handleWA2d}
            className="bg-green-600 hover:bg-green-700"
          >
            <MessageCircle className="h-4 w-4" />
            Confirmar entrega por WA
          </Button>
        </div>
      </Card>

      {/* Momento 2: 1 hora antes */}
      {calidad?.cliente_confirmo === 'si' && (
        <Card>
          <SectionTitle>Momento 2 — Recordatorio 1 hora antes</SectionTitle>
          <div className="space-y-3">
            <Checkbox
              label="Contacto 1 hora antes realizado"
              checked={calidad?.contacto_1h_antes ?? false}
              onChange={(e) => onMutateCalidad({ contacto_1h_antes: e.target.checked })}
            />
            <div>
              <label className="text-xs text-text-muted block mb-1">Resultado</label>
              <select
                value={calidad?.resultado_1h ?? ''}
                onChange={(e) =>
                  onMutateCalidad({ resultado_1h: (e.target.value as 'confirma' | 'reprograma') || null })
                }
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
              >
                <option value="">— Sin resultado —</option>
                <option value="confirma">Confirma</option>
                <option value="reprograma">Reprograma</option>
              </select>
            </div>
            <Button
              variant="success"
              size="sm"
              onClick={handleWA1h}
              className="bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              Recordatorio 1 hora por WA
            </Button>
          </div>
        </Card>
      )}

      {/* Momento 3: Carta */}
      {calidad?.resultado_1h === 'confirma' && (
        <Card>
          <SectionTitle>Momento 3 — Carta de felicitaciones</SectionTitle>
          <div className="space-y-3">
            <Checkbox
              label="Carta enviada"
              checked={calidad?.carta_enviada ?? false}
              onChange={(e) => onMutateCalidad({ carta_enviada: e.target.checked })}
            />
            <Button
              variant="success"
              size="sm"
              onClick={handleWACarta}
              className="bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar carta por WA
            </Button>
          </div>
        </Card>
      )}

      {/* Momento 4: Post entrega */}
      {(calidad?.estado_calidad === 'post_2d' || calidad?.estado_calidad === 'cerrado') && (
        <Card>
          <SectionTitle>Momento 4 — Seguimiento post entrega</SectionTitle>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Intentos de contacto (máx 3)</label>
              <input
                type="number"
                min={0}
                max={3}
                value={calidad?.intentos_post ?? 0}
                onChange={(e) => onMutateCalidad({ intentos_post: Number(e.target.value) })}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
              />
            </div>
            <Checkbox
              label="Contacto efectivo logrado"
              checked={calidad?.contacto_efectivo_post ?? false}
              onChange={(e) => onMutateCalidad({ contacto_efectivo_post: e.target.checked })}
            />
            <div>
              <label className="text-xs text-text-muted block mb-1">Satisfacción</label>
              <select
                value={calidad?.satisfaccion ?? ''}
                onChange={(e) =>
                  onMutateCalidad({ satisfaccion: (e.target.value as Satisfaccion) || null })
                }
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
              >
                <option value="">— Sin datos —</option>
                <option value="satisfecho">Satisfecho</option>
                <option value="insatisfecho">Insatisfecho</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Verbatim / comentario</label>
              <textarea
                value={calidad?.verbatim ?? ''}
                onChange={(e) => onMutateCalidad({ verbatim: e.target.value || null })}
                rows={3}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50 resize-none"
                placeholder="Comentarios del cliente..."
              />
            </div>
            {calidad?.satisfaccion === 'insatisfecho' && (
              <BlockerBanner>
                Cliente insatisfecho — el Gerente PV debe contactarlo telefónicamente mañana.
              </BlockerBanner>
            )}
            <Button
              variant="success"
              size="sm"
              onClick={handleWAPost}
              className="bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              Seguimiento post entrega por WA
            </Button>
          </div>
        </Card>
      )}

      {/* Avanzar a Entrega */}
      {op.estado_actual === 'calidad' && (
        <>
          {!puedeAvanzar && (
            <WarnBanner>Para avanzar: carta de felicitaciones enviada.</WarnBanner>
          )}
          <Button
            disabled={!puedeAvanzar}
            onClick={() =>
              onMutateOp(
                { estado_actual: 'entrega' },
                buildHistorialItem(
                  'calidad',
                  'calidad',
                  'entrega',
                  perfil!.id,
                  perfil!.nombre_completo,
                ),
              )
            }
            className="w-full"
          >
            <ChevronRight className="h-4 w-4" />
            Avanzar a Entrega
          </Button>
        </>
      )}
    </div>
  )
}

// ============================================================
// SALDO Y PAGOS PARCIALES
// ============================================================

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function SaldoPagos({
  op,
  pagos,
  onPagoRegistrado,
}: {
  op: OperacionDetalle
  pagos: PagoSaldo[]
  onPagoRegistrado: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [monto, setMonto] = useState('')
  const [forma, setForma] = useState<'tarjeta' | 'transferencia' | 'efectivo' | ''>('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const saldoTotal = op.saldo_cliente ?? 0
  const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0)
  const saldoPendiente = saldoTotal - totalPagado
  const montoNum = parseFloat(monto) || 0

  // Estados del saldo
  const estaPagado = saldoPendiente <= 0
  const tienePagosParciales = pagos.length > 0 && saldoPendiente > 0
  const pctPagado = saldoTotal > 0 ? Math.min(100, Math.round((totalPagado / saldoTotal) * 100)) : 0

  // Validaciones
  const montoExcede = montoNum > saldoPendiente
  const montoInvalido = montoNum <= 0
  const sinFormaPago = !forma
  const requiereConfirmacion = montoNum > 1_000_000

  function pagarTotal() {
    setMonto(String(Math.round(saldoPendiente)))
  }

  async function registrarPago() {
    if (montoInvalido) return notify.error('Ingresá un monto mayor a 0')
    if (montoExcede) return notify.error(`El monto no puede superar el saldo pendiente (${formatMoney(saldoPendiente)})`)
    if (sinFormaPago) return notify.error('Seleccioná la forma de pago')

    // Confirmación para montos grandes
    if (requiereConfirmacion && !confirmando) {
      setConfirmando(true)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('pagos_saldo').insert({
        operacion_id: op.id,
        monto: montoNum,
        forma_pago: forma,
        fecha: new Date().toISOString().split('T')[0],
        observacion: obs.trim() || null,
      })
      if (error) throw error

      const nuevoTotalPagado = totalPagado + montoNum
      if (nuevoTotalPagado >= saldoTotal) {
        await supabase.from('operaciones').update({ saldo_pagado: true }).eq('id', op.id)
      }

      notify.success(`Pago de ${formatMoney(montoNum)} registrado`)
      setMonto('')
      setObs('')
      setForma('')
      setShowForm(false)
      setConfirmando(false)
      onPagoRegistrado()
    } catch (err: any) {
      notify.error(err?.message || 'Error al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  if (!saldoTotal || saldoTotal <= 0) return null

  const badgeColor = estaPagado
    ? 'bg-green-100 text-green-700'
    : tienePagosParciales
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700'
  const badgeText = estaPagado ? 'PAGADO' : tienePagosParciales ? 'PAGO PARCIAL' : 'DEBE SALDO'
  const borderColor = estaPagado ? 'border-green-500/50' : tienePagosParciales ? 'border-yellow-500/50' : 'border-red-500/50'

  return (
    <Card className={borderColor}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {estaPagado
            ? <CheckCircle2 className="h-4 w-4 text-green-400" />
            : <AlertTriangle className="h-4 w-4 text-red-400" />
          }
          <h3 className="text-sm font-semibold text-text-primary">Saldo del cliente</h3>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
          {badgeText}
        </span>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-bg-secondary rounded-lg">
          <p className="text-xs text-text-muted">Total</p>
          <p className="text-sm font-bold">{formatMoney(saldoTotal)}</p>
        </div>
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <p className="text-xs text-text-muted">Pagado</p>
          <p className="text-sm font-bold text-green-600">{formatMoney(totalPagado)}</p>
        </div>
        <div className={`text-center p-2 rounded-lg ${estaPagado ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-text-muted">Pendiente</p>
          <p className={`text-sm font-bold ${estaPagado ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(Math.max(0, saldoPendiente))}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-bg-tertiary rounded-full h-2.5">
          <div
            className={`rounded-full h-2.5 transition-all ${estaPagado ? 'bg-green-500' : tienePagosParciales ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${pctPagado}%` }}
          />
        </div>
        <span className="text-xs text-text-muted font-medium">{pctPagado}%</span>
      </div>

      {/* Historial de pagos */}
      {pagos.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-text-muted font-semibold mb-2">
            Historial de pagos ({pagos.length}):
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {pagos.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-bg-secondary rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted w-5 text-center font-mono">{i + 1}</span>
                  <span className="text-text-muted">{formatDate(p.fecha)}</span>
                  <span className="capitalize bg-bg-tertiary px-1.5 py-0.5 rounded text-text-secondary">{p.forma_pago}</span>
                  {p.observacion && (
                    <span className="text-text-muted italic truncate max-w-[120px]">{p.observacion}</span>
                  )}
                </div>
                <span className="font-semibold text-green-600">+ {formatMoney(Number(p.monto))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón registrar pago */}
      {!estaPagado && !showForm && (
        <Button size="sm" onClick={() => setShowForm(true)} fullWidth>
          Registrar pago
        </Button>
      )}

      {/* Formulario de pago */}
      {showForm && (
        <div className="border-2 border-action/30 rounded-lg p-4 space-y-3 mt-2 bg-bg-secondary">
          <p className="text-xs font-semibold text-action uppercase tracking-wider">Nuevo pago</p>

          {/* Monto */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Monto a pagar *</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={monto}
                onChange={e => { setMonto(e.target.value); setConfirmando(false) }}
                placeholder="0"
                min="1"
                max={saldoPendiente}
                className={`flex-1 text-sm border-2 rounded-lg px-3 py-2 bg-bg-primary text-text-primary font-semibold ${
                  montoExcede ? 'border-red-500' : monto ? 'border-action' : 'border-border'
                }`}
              />
              <button
                type="button"
                onClick={pagarTotal}
                className="text-xs px-3 py-2 bg-action/10 text-action rounded-lg hover:bg-action/20 transition-colors whitespace-nowrap cursor-pointer font-medium"
              >
                Pagar total
              </button>
            </div>
            {montoExcede && (
              <p className="text-xs text-red-500 mt-1">
                El monto no puede superar {formatMoney(saldoPendiente)}
              </p>
            )}
            {montoNum > 0 && !montoExcede && (
              <p className="text-xs text-text-muted mt-1">
                Quedaría pendiente: {formatMoney(saldoPendiente - montoNum)}
              </p>
            )}
          </div>

          {/* Forma de pago */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Forma de pago *</label>
            <select
              value={forma}
              onChange={e => setForma(e.target.value as any)}
              className={`w-full text-sm border-2 rounded-lg px-3 py-2 bg-bg-primary text-text-primary ${
                sinFormaPago && monto ? 'border-red-400' : 'border-border'
              }`}
            >
              <option value="">Seleccionar...</option>
              <option value="transferencia">Transferencia bancaria</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          {/* Observación */}
          <div>
            <label className="text-xs text-text-muted block mb-1">Observación (opcional)</label>
            <input
              type="text"
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Ej: Seña inicial, 2da cuota, saldo final..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-bg-primary text-text-primary"
            />
          </div>

          {/* Confirmación para montos > $1M */}
          {confirmando && (
            <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-3 text-xs text-yellow-800">
              <p className="font-semibold mb-1">Confirmar pago de {formatMoney(montoNum)}</p>
              <p>Este monto es mayor a $1.000.000. ¿Estás seguro?</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setShowForm(false); setConfirmando(false); setMonto(''); setForma('') }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={registrarPago}
              loading={saving}
              disabled={montoInvalido || montoExcede || sinFormaPago}
            >
              {confirmando ? 'Sí, confirmar pago' : 'Registrar pago'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// PASO 6: Entrega
// ============================================================

function Paso6Entrega({
  op,
  onMutate,
}: {
  op: OperacionDetalle
  onMutate: (updates: Partial<Operacion>, historial?: HistorialEstado) => void
}) {
  const { perfil } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleEntregada(checked: boolean) {
    if (checked) {
      setConfirmOpen(true)
    } else {
      onMutate({ unidad_entregada: false, fecha_entrega_real: null })
    }
  }

  function confirmarEntrega() {
    const hoy = new Date().toISOString().split('T')[0]
    const dias = diasDesde(op.created_at)
    const diffCompromiso = op.fecha_compromiso
      ? Math.round((new Date(op.fecha_compromiso).getTime() - new Date(hoy).getTime()) / 86_400_000)
      : null

    onMutate(
      {
        unidad_entregada: true,
        fecha_entrega_real: hoy,
        estado_actual: 'entregado',
        dias_totales: dias,
        diferencia_compromiso: diffCompromiso,
      },
      buildHistorialItem(
        'entrega',
        'entrega',
        'entregado',
        perfil!.id,
        perfil!.nombre_completo,
      ),
    )
    setConfirmOpen(false)
  }

  return (
    <div className="space-y-5">
      {/* Confirmación modal inline */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold">Confirmar entrega</h3>
            </div>
            <p className="text-sm text-text-secondary">
              ¿Confirmás la entrega? Esto cierra la operación y no puede deshacerse.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={confirmarEntrega}>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar entrega
              </Button>
            </div>
          </div>
        </div>
      )}

      {op.estado_actual !== 'entregado' && (
        <Card>
          <SectionTitle>Registro de entrega</SectionTitle>
          <div className="space-y-3">
            <Checkbox
              label="Unidad entregada al cliente"
              checked={op.unidad_entregada}
              onChange={(e) => handleEntregada(e.target.checked)}
            />
            <div>
              <label className="text-xs text-text-muted block mb-1">Fecha de entrega real</label>
              <input
                type="date"
                value={op.fecha_entrega_real ?? ''}
                onChange={(e) => onMutate({ fecha_entrega_real: e.target.value || null })}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50"
              />
            </div>
            <Checkbox
              label="Entrega con incidente"
              checked={op.entrega_con_incidente}
              onChange={(e) => onMutate({ entrega_con_incidente: e.target.checked })}
            />
            {op.entrega_con_incidente && (
              <div>
                <label className="text-xs text-text-muted block mb-1">Detalle del incidente</label>
                <textarea
                  value={op.detalle_incidente ?? ''}
                  onChange={(e) => onMutate({ detalle_incidente: e.target.value || null })}
                  rows={3}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/50 resize-none"
                  placeholder="Describí el incidente..."
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Resumen de cierre (entregado) */}
      {op.estado_actual === 'entregado' && (
        <Card>
          <SectionTitle>Resumen de cierre</SectionTitle>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-400">Operación cerrada exitosamente</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Entregado el {op.fecha_entrega_real ? formatDate(op.fecha_entrega_real) : '-'}
                </p>
              </div>
            </div>

            <InfoRow
              label="Días totales de la operación"
              value={op.dias_totales != null ? `${op.dias_totales} días` : '-'}
            />
            <InfoRow
              label="Diferencia vs compromiso"
              value={
                op.diferencia_compromiso != null ? (
                  <span className={op.diferencia_compromiso >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {op.diferencia_compromiso >= 0
                      ? `${op.diferencia_compromiso} días antes`
                      : `${Math.abs(op.diferencia_compromiso)} días demorado`}
                  </span>
                ) : '-'
              }
            />
            <InfoRow label="Dominio / Patente" value={op.dominio_patente} />
          </div>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// TIMELINE
// ============================================================

function Timeline({ historial }: { historial: HistorialEstado[] }) {
  if (historial.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-8">
        No hay cambios de estado registrados.
      </p>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
      <div className="space-y-4">
        {[...historial].reverse().map((item, idx) => (
          <div key={idx} className="flex gap-4 relative">
            <div className="relative z-10 mt-1.5 shrink-0">
              <div className="h-2.5 w-2.5 rounded-full bg-action border-2 border-bg-card" />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-text-muted capitalize">{item.paso}</span>
                <span className="text-text-muted">·</span>
                <span className="text-text-secondary">{item.estado_anterior}</span>
                <span className="text-text-muted">→</span>
                <span className="text-text-primary font-medium">{item.estado_nuevo}</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{formatDateTime(item.fecha)}</p>
              {item.usuario_nombre && (
                <p className="text-xs text-text-muted mt-0.5">Por: {item.usuario_nombre}</p>
              )}
              {item.motivo && (
                <p className="text-xs text-text-secondary mt-0.5 italic">Motivo: {item.motivo}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function DetalleOperacion() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'paso' | 'timeline'>('paso')

  // --- Query ---
  const {
    data: op,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['operacion', id],
    queryFn: () => fetchOperacion(id!),
    enabled: !!id,
  })

  // --- Mutation: actualizar operacion ---
  const mutOp = useMutation({
    mutationFn: async ({
      updates,
      historial,
    }: {
      updates: Partial<Operacion>
      historial?: HistorialEstado
    }) => {
      if (!op) throw new Error('Sin operación cargada')

      const payload: Record<string, unknown> = { ...updates }

      if (historial) {
        const histActual: HistorialEstado[] = Array.isArray(op.historial_estados)
          ? op.historial_estados
          : []
        payload.historial_estados = [...histActual, historial]
      }

      const { error } = await supabase
        .from('operaciones')
        .update(payload)
        .eq('id', op.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operacion', id] })
      notify.success('Guardado correctamente')
    },
    onError: (err: Error) => {
      notify.error(err.message || 'Error al guardar')
    },
  })

  // --- Mutation: actualizar contacto_calidad ---
  const mutCalidad = useMutation({
    mutationFn: async (updates: Partial<ContactoCalidad>) => {
      if (!op) throw new Error('Sin operación cargada')

      // Auto-create contactos_calidad if missing
      if (!op.contactos_calidad?.id) {
        const { error: createErr } = await supabase
          .from('contactos_calidad')
          .insert({ operacion_id: op.id, estado_calidad: 'citar_2d', ...updates })
          .select('id')
          .single()
        if (createErr) throw createErr
        return
      }

      const { error } = await supabase
        .from('contactos_calidad')
        .update(updates)
        .eq('id', op.contactos_calidad.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operacion', id] })
      notify.success('Guardado correctamente')
    },
    onError: (err: Error) => {
      notify.error(err.message || 'Error al guardar calidad')
    },
  })

  // Helpers que disparan las mutations
  function handleMutOp(updates: Partial<Operacion>, historial?: HistorialEstado) {
    mutOp.mutate({ updates, historial })
  }

  function handleMutCalidad(updates: Partial<ContactoCalidad>) {
    mutCalidad.mutate(updates)
  }

  // --- Loading / error ---
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse p-6">
        <div className="h-8 w-64 bg-bg-tertiary rounded-lg" />
        <div className="h-6 w-full bg-bg-tertiary rounded-lg" />
        <div className="h-64 w-full bg-bg-tertiary rounded-xl" />
      </div>
    )
  }

  if (isError || !op) {
    return (
      <div className="text-center py-12 space-y-3">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-text-secondary">No se pudo cargar la operación.</p>
        <Button variant="ghost" onClick={() => navigate('/operaciones')}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </div>
    )
  }

  const historial: HistorialEstado[] = Array.isArray(op.historial_estados)
    ? op.historial_estados
    : []

  // Colores tipo operación
  const colorTipo = COLORES_TIPO[op.tipo_operacion]
  const colorEstado = COLORES_ESTADO_BADGE[op.estado_actual] ?? 'gray'

  // Semáforo compromiso
  const semaforo = op.fecha_compromiso ? getSemaforoCompromiso(op.fecha_compromiso) : null
  const semaforoEmoji = { verde: '🟢', amarillo: '🟡', rojo: '🔴' }

  // Paso actual
  const pasoActual = ESTADO_A_PASO[op.estado_actual] ?? 0

  // Tabs disponibles
  const tabs = [
    { id: 'paso' as const, label: pasoActual > 0 ? `Paso ${pasoActual}` : 'Estado actual' },
    { id: 'timeline' as const, label: `Timeline (${historial.length})` },
  ]

  // ---- RENDER ----

  return (
    <div className="min-h-screen space-y-0">
      {/* ---- HEADER ---- */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
        <button
          onClick={() => navigate('/operaciones')}
          className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors cursor-pointer shrink-0 mt-0.5"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-text-primary font-mono">
              {op.numero_operacion}
            </h1>

            {/* Badge tipo operación (con colores custom) */}
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold border"
              style={{
                backgroundColor: colorTipo.bg,
                color: colorTipo.text,
                borderColor: colorTipo.border,
              }}
            >
              {TIPO_LABEL[op.tipo_operacion]}
            </span>

            {/* Badge estado */}
            <Badge color={colorEstado} size="sm">
              {ESTADO_LABEL[op.estado_actual]}
            </Badge>

            {/* Semáforo compromiso */}
            {op.fecha_compromiso && semaforo && (
              <span className="text-sm">
                {semaforoEmoji[semaforo]}
                <span className="text-text-muted text-xs ml-1">
                  {(() => {
                    const d = diasRestantes(op.fecha_compromiso)
                    if (d < 0) return `${Math.abs(d)}d vencido`
                    if (d === 0) return 'Hoy'
                    return `${d}d`
                  })()}
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-text-muted" />
              {op.cliente_nombre ?? 'Sin nombre'}
            </span>
            {op.unidades?.modelo && (
              <span className="flex items-center gap-1">
                <Car className="h-3.5 w-3.5 text-text-muted" />
                {op.unidades.modelo}
                {op.unidades.color ? ` · ${op.unidades.color}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ---- BARRA PIPELINE ---- */}
      <BarraPipeline estadoActual={op.estado_actual} />

      {/* ---- BANDERAS VIAJERAS ---- */}
      <BanderasViajeras op={op} />

      {/* ---- TABS ---- */}
      <TabBar
        tabs={tabs}
        active={activeTab}
        onChange={(id) => setActiveTab(id as 'paso' | 'timeline')}
      />

      {/* ---- CONTENIDO PASO ACTUAL ---- */}
      {activeTab === 'paso' && (
        <div>
          {/* Saldo — visible siempre que haya saldo pendiente */}
          {op.saldo_cliente != null && op.saldo_cliente > 0 && (
            <SaldoPagos
              op={op}
              pagos={op.pagos_saldo ?? []}
              onPagoRegistrado={() => queryClient.invalidateQueries({ queryKey: ['operacion', id] })}
            />
          )}

          {op.estado_actual === 'caida' && (
            <Card>
              <div className="flex items-center gap-3 text-red-400">
                <XCircle className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Operación caída</p>
                  {op.motivo_caida && (
                    <p className="text-sm text-text-muted mt-0.5">Motivo: {op.motivo_caida}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {(op.estado_actual === 'cierre' || op.estado_paso1 === 'creada') &&
            op.estado_actual !== 'caida' && (
              <Paso1Cierre op={op} onMutate={handleMutOp} />
            )}

          {op.estado_actual === 'documentacion' && (
            <Paso2Documentacion op={op} onMutate={handleMutOp} />
          )}

          {op.estado_actual === 'gestoria' && (
            <Paso3Gestoria op={op} onMutate={handleMutOp} />
          )}

          {op.estado_actual === 'alistamiento' && (
            <Paso4Alistamiento op={op} onMutate={handleMutOp} />
          )}

          {op.estado_actual === 'calidad' && (
            <Paso5Calidad
              op={op}
              calidad={op.contactos_calidad}
              onMutateCalidad={handleMutCalidad}
              onMutateOp={handleMutOp}
            />
          )}

          {(op.estado_actual === 'entrega' || op.estado_actual === 'entregado') && (
            <Paso6Entrega op={op} onMutate={handleMutOp} />
          )}
        </div>
      )}

      {/* ---- TIMELINE ---- */}
      {activeTab === 'timeline' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-action" />
            <h3 className="text-sm font-semibold text-text-primary">Historial de estados</h3>
          </div>
          <Timeline historial={historial} />
        </Card>
      )}
    </div>
  )
}
