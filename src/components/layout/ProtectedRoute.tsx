import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, canAccessRoute } from '../../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { perfil } = useAuth()
  const location = useLocation()

  if (!perfil) return <Navigate to="/login" replace />

  if (!canAccessRoute(perfil.rol, location.pathname)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-xl font-semibold text-danger mb-2">Acceso denegado</p>
        <p className="text-text-secondary">No tenés permisos para acceder a esta sección.</p>
      </div>
    )
  }

  return <>{children}</>
}
