import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario, RolUsuario } from '../lib/types'

interface AuthState {
  user: User | null
  session: Session | null
  perfil: Usuario | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    perfil: null,
    loading: true,
  })

  const fetchPerfil = async (userId: string): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) return null
    return data as Usuario
  }

  useEffect(() => {
    let mounted = true

    // Use onAuthStateChange as the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (session?.user) {
        const perfil = await fetchPerfil(session.user.id)
        if (mounted) setState({ user: session.user, session, perfil, loading: false })
      } else {
        if (mounted) setState({ user: null, session: null, perfil: null, loading: false })
      }
    })

    // Safety timeout: if auth takes too long, stop loading
    const timeout = setTimeout(() => {
      if (mounted) {
        setState(prev => prev.loading ? { ...prev, loading: false } : prev)
      }
    }, 5000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setState({ user: null, session: null, perfil: null, loading: false })
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

// Helper para chequear acceso por rol
const roleAccess: Record<string, RolUsuario[]> = {
  '/dashboard': ['director', 'calidad'],
  '/gestoria': ['director', 'gestor'],
  '/alistamiento': ['director', 'preparador', 'calidad'],
  '/entrega': ['director', 'asesor_ush', 'asesor_rg', 'calidad'],
}

export function canAccessRoute(rol: RolUsuario, path: string): boolean {
  // Director accede a todo
  if (rol === 'director') return true

  const basePath = '/' + path.split('/')[1]
  const allowedRoles = roleAccess[basePath]
  if (!allowedRoles) return true
  return allowedRoles.includes(rol)
}

export function getDefaultRoute(rol: RolUsuario): string {
  switch (rol) {
    case 'director': return '/dashboard'
    case 'gestor': return '/gestoria'
    case 'preparador': return '/alistamiento'
    case 'asesor_ush':
    case 'asesor_rg': return '/entrega'
    case 'calidad': return '/dashboard'
    default: return '/dashboard'
  }
}
