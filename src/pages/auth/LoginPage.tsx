import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Mail, Lock, Car } from 'lucide-react'
import { useAuth, getDefaultRoute } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { notify } from '../../components/ui/Toast'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const { login, resetPassword, user, perfil, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // If already authenticated with profile, redirect to default route
  if (!authLoading && user && perfil) {
    return <Navigate to={getDefaultRoute(perfil.rol)} replace />
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      // onAuthStateChange will update the context and trigger the redirect above
      // Safety: if redirect doesn't happen in 8s, stop the spinner
      setTimeout(() => setLoading(false), 8000)
    } catch (err: any) {
      notify.error(err.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : err.message?.includes('Tiempo de espera')
          ? 'No se pudo conectar con el servidor. Verificá tu conexión a internet.'
          : err.message || 'Error al iniciar sesión')
      setLoading(false)
    }
  }

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) {
      notify.error('Ingresá tu email primero')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email)
      notify.success('Se envió un link de recuperación a tu email')
      setShowReset(false)
    } catch (err: any) {
      notify.error(err.message || 'Error al enviar email de recuperación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-action/10 mb-4">
            <Car className="h-8 w-8 text-action" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">LASAC</h1>
          <p className="text-sm text-text-secondary mt-1">Sistema de Gestión — Liendo Automotores</p>
        </div>

        {/* Card */}
        <div className="bg-bg-secondary rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-6">
            {showReset ? 'Recuperar contraseña' : 'Iniciar sesión'}
          </h2>

          <form onSubmit={showReset ? handleReset : handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@liendoautomotores.com.ar"
              icon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
            />

            {!showReset && (
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                required
                autoComplete="current-password"
              />
            )}

            <Button type="submit" fullWidth loading={loading} size="lg">
              {showReset ? 'Enviar link de recuperación' : 'Ingresar'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowReset(!showReset)}
              className="text-sm text-text-muted hover:text-action transition-colors cursor-pointer"
            >
              {showReset ? 'Volver al login' : 'Olvidé mi contraseña'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          FIAT — Liendo Automotores S.A. — Tierra del Fuego
        </p>
      </div>
    </div>
  )
}
