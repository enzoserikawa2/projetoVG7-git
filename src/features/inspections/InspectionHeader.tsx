import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { statusProgress } from '../../domain/inspection'
import type { Inspection } from '../../domain/types'
import { Pill } from '../../components/ui'

const steps = [
  { segment: 'basics', label: 'Dados' },
  { segment: 'locations', label: 'Campo' },
  { segment: 'photos', label: 'Fotos' },
  { segment: 'review', label: 'Revisão' },
  { segment: 'report', label: 'Relatório' }
]

export function InspectionHeader({ inspection }: { inspection: Inspection }) {
  const progress = statusProgress(inspection)
  return (
    <div className="inspection-header">
      <div className="inspection-header__top">
        <Link to="/inspections" className="icon-link" aria-label="Voltar às vistorias">
          <ArrowLeft size={21} />
        </Link>
        <div className="inspection-header__identity">
          <span>{inspection.client || 'Cliente ainda não informado'}</span>
          <strong>{inspection.facility || 'Nova vistoria'}</strong>
        </div>
        {inspection.isDemo ? (
          <Pill tone="warning">DEMO</Pill>
        ) : inspection.status === 'finalizada' ? (
          <Pill tone="success">
            <CheckCircle2 size={13} /> Finalizada
          </Pill>
        ) : (
          <Pill>{progress}%</Pill>
        )}
      </div>
      <nav className="inspection-steps" aria-label="Etapas da vistoria">
        {steps.map((step) => (
          <NavLink
            key={step.segment}
            to={`/inspection/${inspection.id}/${step.segment}`}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {step.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
