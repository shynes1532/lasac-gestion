import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Sidebar } from './Sidebar'
import { Loader2, AlertTriangle, LogOut, RefreshCw } from 'lucide-react'

function LoadingScreen() {
  const { retryInit } = useAuth()
  const [showRetry, setShowRetry] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowRetry(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-bg-primary gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-action" />
      <p className="text-sm text-text-secondary">Cargando...</p>
      {showRetry && (
        <button
          onClick={retryInit}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-action border border-border rounded-lg hover:border-action transition-colors cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  )
}

export function AppLayout() {
  const { user, perfil, loading, perfilError, logout, retryInit } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  // No session at all → login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Session exists but no profile — could be a connection error or missing row
  if (!perfil) {
    // If there was a connection/timeout error, show retry option
    if (perfilError && (perfilError.includes('Tiempo de espera') || perfilError.includes('Failed to fetch') || perfilError.includes('NetworkError') || perfilError.includes('network'))) {
      return (
        <div className="h-screen flex items-center justify-center bg-bg-primary p-4">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <p className="text-xl font-semibold text-text-primary mb-2">Error de conexión</p>
            <p className="text-text-secondary mb-6">
              No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá de nuevo.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={retryInit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-action text-white rounded-lg hover:bg-action-hover transition-colors cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </button>
              <button
                onClick={() => logout()}
                className="inline-flex items-center gap-2 px-4 py-2 text-text-secondary border border-border rounded-lg hover:border-action hover:text-action transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )
    }

    // No profile row in usuarios table
    const sql = `INSERT INTO usuarios (id, email, nombre_completo, rol, sucursal, activo)\nVALUES (\n  '${user.id}',\n  '${user.email}',\n  'Tu Nombre Aqui',  -- cambiar\n  'director',         -- cambiar si corresponde\n  'Ambas',            -- cambiar si corresponde\n  true\n);`
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary p-4">
        <div className="text-center max-w-lg">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
          <p className="text-xl font-semibold text-text-primary mb-2">Perfil no encontrado</p>
          <p className="text-text-secondary mb-4">
            Tu cuenta de auth existe pero no tiene fila en la tabla <code className="bg-bg-tertiary px-1 rounded text-sm">usuarios</code>.
          </p>
          <div className="text-left bg-bg-secondary border border-border rounded-lg p-4 mb-4">
            <p className="text-xs text-text-muted mb-1 font-medium">Tu UUID (copia esto):</p>
            <p className="text-sm font-mono text-action break-all select-all">{user.id}</p>
          </div>
          <div className="text-left bg-bg-secondary border border-border rounded-lg p-4 mb-6">
            <p className="text-xs text-text-muted mb-2 font-medium">Pegá este SQL en Supabase → SQL Editor:</p>
            <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap break-all select-all">{sql}</pre>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={retryInit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-action text-white rounded-lg hover:bg-action-hover transition-colors cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-4 py-2 text-text-secondary border border-border rounded-lg hover:border-action hover:text-action transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!perfil.activo) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <p className="text-xl font-semibold text-danger mb-2">Cuenta deshabilitada</p>
          <p className="text-text-secondary">Contactá al administrador del sistema.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <main className="lg:pl-60 pt-14 lg:pt-0">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
