import { BookOpen, ClipboardCheck, CloudOff, HardDrive, Home, Settings } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { useOnlineStatus } from '../app/useOnlineStatus'

const navItems = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/inspections', label: 'Vistorias', icon: ClipboardCheck },
  { to: '/library', label: 'Biblioteca', icon: BookOpen },
  { to: '/settings', label: 'Configurações', icon: Settings }
]

export function AppShell({ children }: PropsWithChildren) {
  const online = useOnlineStatus()
  const save = useSaveState()

  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Navegação principal">
        <NavLink to="/" className="brand" aria-label="VG7 Vistorias HVAC">
          <span className="brand__mark">VG7</span>
          <span>
            <strong>Vistorias HVAC</strong>
            <small>Engenharia em campo</small>
          </span>
        </NavLink>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
              >
                <Icon size={21} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <NavLink
            to="/backup"
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
          >
            <HardDrive size={21} aria-hidden="true" />
            <span>Backup</span>
          </NavLink>
        </nav>
        <div className={`connection-state ${online ? '' : 'connection-state--offline'}`}>
          <CloudOff size={18} aria-hidden="true" />
          <div>
            <strong>{online ? 'Dados locais' : 'Modo offline'}</strong>
            <span>{online ? 'Nenhuma nuvem conectada' : 'A vistoria continua disponível'}</span>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header className="mobile-header">
          <NavLink to="/" className="brand brand--mobile">
            <span className="brand__mark">VG7</span>
            <strong>Vistorias HVAC</strong>
          </NavLink>
          <div className={`save-indicator save-indicator--${save.state}`} aria-live="polite">
            {save.state === 'saving' && 'Salvando…'}
            {save.state === 'saved' && 'Salvo'}
            {save.state === 'error' && 'Falha ao salvar'}
            {save.state === 'idle' && (online ? 'Local' : 'Offline')}
          </div>
        </header>

        {save.error && (
          <div className="global-error" role="alert">
            <span>{save.error}</span>
            <button onClick={save.clearError}>Fechar</button>
          </div>
        )}

        <main className="main-content">{children}</main>

        <nav className="bottom-nav" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <Icon size={21} aria-hidden="true" />
                <span>{item.label === 'Configurações' ? 'Ajustes' : item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
