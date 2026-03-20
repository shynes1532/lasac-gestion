import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, supabaseAnon } from '../lib/supabase'
import type { Usuario, RolUsuario } from '../lib/types'

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
      // Use anon client: the authenticated role lacks SELECT on usuarios
      const { data, error } = await supabaseAnon
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

    // Single source of truth: onAuthStateChange handles EVERYTHING
    // including INITIAL_SESSION (first load) and SIGNED_IN (login).
    // No separate init() to avoid race conditions.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      // On sign out, clear everything immediately
      if (event === 'SIGNED_OUT') {
        if (mounted) setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
        return
      }

      // No session → clear state
      if (!session?.user) {
        if (mounted) setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
        return
      }

      // We have a session — set user + loading while we validate & fetch profile
      if (mounted) setState(prev => ({ ...prev, user: session.user, session, loading: true }))

      // On initial load, validate the stored session is still valid
      if (event === 'INITIAL_SESSION') {
        const { error: userError } = await supabase.auth.getUser()
        if (!mounted) return
        if (userError) {
          console.warn('Sesión expirada, mostrando login:', userError.message)
          // Don't call signOut() here — just clear local state.
          // Avoids race condition if user logs in while this is running.
          setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
          return
        }
      }

      // Fetch profile
      const { perfil, error: perfilError } = await fetchPerfil(session.user.id)
      if (mounted) setState({ user: session.user, session, perfil, loading: false, perfilError })
    })

    // Safety timeout — if nothing fires within 5s, stop loading
    const timeout = setTimeout(() => {
      if (mounted) {
        setState(prev => {
          if (prev.loading) {
            console.warn('Auth timeout: forzando fin de loading después de 5s')
            return { ...prev, loading: false }
          }
          return prev
        })
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
    // Always clear local state even if signOut fails (e.g. network error)
    setState({ user: null, session: null, perfil: null, loading: false, perfilError: null })
    await supabase.auth.signOut().catch(() => {})
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
