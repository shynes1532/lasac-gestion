import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Wrench, Truck,
  LogOut, Menu, X, CreditCard, ShieldCheck, DollarSign, Printer, Shield,
  UserCheck, AlertTriangle, PieChart, Archive, ClipboardList, Package,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth, canAccessRoute } from '../../context/AuthContext'
import { NotificationBell } from './NotificationBell'

const navItems = [
  { path: '/recepcion',           label: 'Recepción',    icon: ClipboardList },
  { path: '/dashboard',           label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/operaciones',         label: 'Operaciones',  icon: FileText },
  { path: '/ahorristas',          label: 'Ahorristas',   icon: UserCheck },
  { path: '/cartera',             label: 'Cartera',      icon: PieChart },
  { path: '/mora',                label: 'Mora',         icon: AlertTriangle },
  { path: '/alistamiento',        label: 'PDI',          icon: Wrench },
  { path: '/calidad',             label: 'Calidad',      icon: ShieldCheck },
  { path: '/entregas-programadas',label: 'Entregas pendientes', icon: Truck },
  { path: '/prendas',             label: 'Prendas',      icon: CreditCard },
  { path: '/saldos',              label: 'Saldos',       icon: DollarSign },
  { path: '/stock',                  label: 'Stock',        icon: Truck },
  { path: '/repuestos',             label: 'Repuestos',    icon: Package },
  { path: '/garantias',             label: 'Garantias',    icon: Wrench },
  { path: '/siniestros',            label: 'Siniestros',   icon: AlertTriangle },
  { path: '/calibre',              label: 'Calibre',      icon: Shield },
  { path: '/unidades-entregadas', label: 'Archivo entregadas', icon: Archive },
  { path: '/reportes',            label: 'Reportes',     icon: Printer },
]

export function Sidebar() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const filteredNav = navItems.filter(
    (item) => perfil && canAccessRoute(perfil.rol, item.path)
  )

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-text-primary">LASAC</h1>
        <p className="text-xs text-text-muted">Liendo Automotores</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1">
        {filteredNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-colors duration-200
              ${isActive
                ? 'bg-action/10 text-action'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }
            `}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-border">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-text-primary truncate">{perfil?.nombre_completo}</p>
          <p className="text-xs text-text-muted capitalize">{perfil?.rol?.replace('_', ' ')}</p>
          <p className="text-xs text-text-muted">{perfil?.sucursal}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-text-secondary hover:text-danger hover:bg-danger/10 w-full transition-colors duration-200 cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-bg-secondary border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="text-text-primary cursor-pointer">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-text-primary">LASAC</h1>
        </div>
        <NotificationBell />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-bg-secondary flex flex-col">
            <div className="absolute top-3 right-3">
              <button onClick={() => setMobileOpen(false)} className="text-text-muted cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-bg-secondary border-r border-border">
        {navContent}
      </aside>
    </>
  )
}
