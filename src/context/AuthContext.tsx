import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario, RolUsuario } from '../lib/types'

// Cliente sin auth para leer perfil (evita problemas de GRANT en role authenticated)
const anonClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface AuthState {
  user: User | null
  session: Session | null
  perfil: Usuario | null
  loading: boolean
  perfilError: string | null
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
    perfilError: null,
  })

  const fetchPerfil = async (userId: string): Promise<{ perfil: Usuario | null; error: string | null }> => {
    try {
      const { data, error } = await anonClient
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('Error al cargar perfil:', error.code, error.message, error.details)
        return { perfil: null, error: `${error.code}: ${error.message}` }
      }
      return { perfil: data as Usuario, error: null }
    } catch (err: any) {
      console.error('fetchPerfil exception:', err)
      return { perfil: null, error: err?.message || 'Error desconocido' }
    }
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        // 1. Get initial session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('getSession error:', error.message)
          if (mounted) setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
          return
        }

        if (session?.user) {
          const { perfil, error: perfilError } = await fetchPerfil(session.user.id)
          if (mounted) setState({ user: session.user, session, perfil, loading: false, perfilError })
        } else {
          if (mounted) setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
        }
      } catch (err: any) {
        console.error('Auth init error:', err)
        if (mounted) setState({ user: null, session: null, perfil: null, loading: false, perfilError: err?.message || 'Error de inicialización' })
      }
    }

    init()

    // 2. Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      // Skip INITIAL_SESSION since we handle it above with getSession
      if (event === 'INITIAL_SESSION') return

      if (session?.user) {
        const { perfil, error: perfilError } = await fetchPerfil(session.user.id)
        if (mounted) setState({ user: session.user, session, perfil, loading: false, perfilError })
      } else {
        if (mounted) setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
      }
    })

    // 3. Safety timeout
    const timeout = setTimeout(() => {
      if (mounted) {
        setState(prev => {
          if (prev.loading) {
            console.warn('Auth timeout: forzando fin de loading después de 4s')
            return { ...prev, loading: false }
          }
          return prev
        })
      }
    }, 4000)

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
    setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
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
  '/dashboard':            ['director', 'calidad'],
  '/operaciones':          ['director', 'gestor', 'asesor_ush', 'asesor_rg', 'calidad'],
  '/gestoria':             ['director', 'gestor'],
  '/alistamiento':         ['director', 'preparador', 'calidad'],
  '/calidad':              ['director', 'calidad'],
  '/entregas-programadas': ['director', 'asesor_ush', 'asesor_rg', 'calidad'],
  '/prendas':              ['director', 'gestor'],
  '/saldos':               ['director', 'gestor'],
  '/entrega':              ['director', 'asesor_ush', 'asesor_rg', 'calidad'],
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
