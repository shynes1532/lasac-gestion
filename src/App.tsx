import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth, getDefaultRoute } from './context/AuthContext'
import { ToastProvider } from './components/ui'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Loader2 } from 'lucide-react'

// Lazy loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ListaOperaciones = lazy(() => import('./pages/operaciones/ListaOperaciones').then(m => ({ default: m.ListaOperaciones })))
const NuevaOperacion = lazy(() => import('./pages/gestoria/NuevaOperacion').then(m => ({ default: m.NuevaOperacion })))
const DetalleOperacion = lazy(() => import('./pages/gestoria/DetalleOperacion').then(m => ({ default: m.DetalleOperacion })))
const ColaPDI = lazy(() => import('./pages/alistamiento/ColaPDI').then(m => ({ default: m.ColaPDI })))
const DetallePDI = lazy(() => import('./pages/alistamiento/DetallePDI').then(m => ({ default: m.DetallePDI })))
const ListaEntregas = lazy(() => import('./pages/entrega/ListaEntregas').then(m => ({ default: m.ListaEntregas })))
const DetalleEntrega = lazy(() => import('./pages/entrega/DetalleEntrega').then(m => ({ default: m.DetalleEntrega })))
const ControlPrendas = lazy(() => import('./pages/prendas/ControlPrendas').then(m => ({ default: m.ControlPrendas })))
const CalidadPage = lazy(() => import('./pages/calidad/CalidadPage').then(m => ({ default: m.CalidadPage })))
const EntregasProgramadas = lazy(() => import('./pages/entregas/EntregasProgramadas').then(m => ({ default: m.EntregasProgramadas })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-action" />
    </div>
  )
}

function RootRedirect() {
  const { perfil, loading } = useAuth()
  if (loading) return null
  if (!perfil) return <Navigate to="/login" replace />
  return <Navigate to={getDefaultRoute(perfil.rol)} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<RootRedirect />} />

                <Route path="/dashboard" element={
                  <ProtectedRoute><DashboardPage /></ProtectedRoute>
                } />

                {/* Rutas nuevas */}
                <Route path="/operaciones" element={
                  <ProtectedRoute><ListaOperaciones /></ProtectedRoute>
                } />
                <Route path="/operaciones/nueva" element={
                  <ProtectedRoute><NuevaOperacion /></ProtectedRoute>
                } />
                <Route path="/operaciones/:id" element={
                  <ProtectedRoute><DetalleOperacion /></ProtectedRoute>
                } />
                <Route path="/prendas" element={
                  <ProtectedRoute><ControlPrendas /></ProtectedRoute>
                } />
                <Route path="/calidad" element={
                  <ProtectedRoute><CalidadPage /></ProtectedRoute>
                } />
                <Route path="/entregas-programadas" element={
                  <ProtectedRoute><EntregasProgramadas /></ProtectedRoute>
                } />

                {/* Rutas legado — redirigen a nuevas */}
                <Route path="/gestoria" element={<Navigate to="/operaciones" replace />} />
                <Route path="/gestoria/nueva" element={<Navigate to="/operaciones/nueva" replace />} />
                <Route path="/gestoria/:id" element={<Navigate to="/operaciones" replace />} />

                <Route path="/alistamiento" element={
                  <ProtectedRoute><ColaPDI /></ProtectedRoute>
                } />
                <Route path="/alistamiento/:id" element={
                  <ProtectedRoute><DetallePDI /></ProtectedRoute>
                } />

                <Route path="/entrega" element={
                  <ProtectedRoute><ListaEntregas /></ProtectedRoute>
                } />
                <Route path="/entrega/:id" element={
                  <ProtectedRoute><DetalleEntrega /></ProtectedRoute>
                } />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
