import { useState, useRef, useEffect } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas } from '../../hooks/useNotificaciones'
import { Badge } from '../ui/Badge'
import type { Notificacion } from '../../lib/types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const prioridadColor: Record<string, 'gray' | 'yellow' | 'orange' | 'red'> = {
  baja: 'gray',
  normal: 'gray',
  alta: 'orange',
  critica: 'red',
}

const tipoRoute: Record<string, string> = {
  nuevo_alistamiento: '/alistamiento',
  aprobado_pdi: '/entrega',
  rechazado_pdi: '/alistamiento',
  alerta_csi: '/entrega',
  entrega_manana: '/entrega',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data: notificaciones, noLeidas } = useNotificaciones()
  const marcarLeida = useMarcarLeida()
  const marcarTodas = useMarcarTodasLeidas()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleNotifClick = (notif: Notificacion) => {
    if (!notif.leida) marcarLeida.mutate(notif.id)
    setOpen(false)
    const route = tipoRoute[notif.tipo]
    if (route && notif.operacion_id) {
      navigate(`${route}/${notif.operacion_id}`)
    } else if (route) {
      navigate(route)
    }
  }

  const recientes = (notificaciones || []).slice(0, 15)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-action rounded-full">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-bg-secondary border border-border rounded-xl shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Notificaciones</h3>
            {noLeidas > 0 && (
              <button
                onClick={() => marcarTodas.mutate()}
                className="text-xs text-action hover:text-action-hover flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          {recientes.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-8">Sin notificaciones</p>
          ) : (
            <div>
              {recientes.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-bg-tertiary transition-colors cursor-pointer ${
                    !notif.leida ? 'bg-action/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notif.leida && <div className="mt-1.5 h-2 w-2 rounded-full bg-action shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge color={prioridadColor[notif.prioridad] || 'gray'} size="sm">
                          {notif.tipo.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-text-muted ml-auto">{timeAgo(notif.created_at)}</span>
                      </div>
                      <p className="text-sm text-text-primary line-clamp-2">{notif.mensaje}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
