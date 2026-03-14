import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Sidebar } from './Sidebar'
import { Loader2 } from 'lucide-react'

export function AppLayout() {
  const { user, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-action" />
      </div>
    )
  }

  if (!user || !perfil) {
    return <Navigate to="/login" replace />
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
