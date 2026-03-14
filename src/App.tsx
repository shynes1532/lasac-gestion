import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth, getDefaultRoute } from './context/AuthContext'
import { ToastProvider } from './components/ui'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { ListaOperaciones } from './pages/gestoria/ListaOperaciones'
import { NuevaOperacion } from './pages/gestoria/NuevaOperacion'
import { DetalleOperacion } from './pages/gestoria/DetalleOperacion'
import { ColaPDI } from './pages/alistamiento/ColaPDI'
import { DetallePDI } from './pages/alistamiento/DetallePDI'
import { ListaEntregas } from './pages/entrega/ListaEntregas'
import { DetalleEntrega } from './pages/entrega/DetalleEntrega'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

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
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<RootRedirect />} />

              <Route path="/dashboard" element={
                <ProtectedRoute><DashboardPage /></ProtectedRoute>
              } />

              <Route path="/gestoria" element={
                <ProtectedRoute><ListaOperaciones /></ProtectedRoute>
              } />
              <Route path="/gestoria/nueva" element={
                <ProtectedRoute><NuevaOperacion /></ProtectedRoute>
              } />
              <Route path="/gestoria/:id" element={
                <ProtectedRoute><DetalleOperacion /></ProtectedRoute>
              } />

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
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
