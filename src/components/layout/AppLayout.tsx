import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Sidebar } from './Sidebar'
import { Loader2, AlertTriangle, LogOut } from 'lucide-react'

export function AppLayout() {
  const { user, perfil, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-action" />
      </div>
    )
  }

  // No session at all → login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Session exists but no profile in usuarios table
  if (!perfil) {
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
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-action text-white rounded-lg hover:bg-action-hover transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
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
