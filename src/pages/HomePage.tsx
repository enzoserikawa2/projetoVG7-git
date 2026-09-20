import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardPlus,
  Download,
  HardDrive,
  PlayCircle,
  Settings
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, PageTitle, Pill } from '../components/ui'
import { db } from '../db/database'
import { createInspection } from '../db/repository'
import { DEMO_IDS } from '../db/seed'
import { formatDateTime } from '../domain/ids'
import { useSaveState } from '../app/SaveContext'

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function HomePage() {
  const navigate = useNavigate()
  const { runSave } = useSaveState()
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt>()
  const [creating, setCreating] = useState(false)
  const inspections = useLiveQuery(() => db.inspections.orderBy('updatedAt').reverse().toArray(), [], [])
  const latest = inspections.find((item) => !item.isDemo && item.status === 'em_andamento')
  const demo = inspections.find((item) => item.id === DEMO_IDS.inspection)

  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as DeferredInstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', listener)
    return () => window.removeEventListener('beforeinstallprompt', listener)
  }, [])

  const create = async () => {
    setCreating(true)
    try {
      const inspection = await runSave(createInspection)
      navigate(`/inspection/${inspection.id}/basics`)
    } finally {
      setCreating(false)
    }
  }

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setInstallPrompt(undefined)
  }

  return (
    <div>
      <PageTitle
        eyebrow="VG7 Engenharia"
        title="Vistoria HVAC em campo"
        description="Registre constatações com rapidez, preserve os dados no dispositivo e gere o relatório técnico sem depender de internet."
        action={
          installPrompt ? (
            <Button variant="secondary" icon={<Download size={19} />} onClick={install}>
              Instalar app
            </Button>
          ) : undefined
        }
      />

      <section className="home-primary-grid">
        <Card className="new-inspection-card">
          <div className="action-icon action-icon--amber">
            <ClipboardPlus size={27} />
          </div>
          <div>
            <p className="eyebrow">Novo trabalho</p>
            <h2>Iniciar uma vistoria</h2>
            <p>Dados essenciais primeiro; local e equipamento logo em seguida.</p>
          </div>
          <Button full busy={creating} onClick={create} icon={<ArrowRight size={19} />}>
            Nova vistoria
          </Button>
        </Card>

        <Card className="continue-card">
          <div className="action-icon">
            <PlayCircle size={27} />
          </div>
          {latest ? (
            <>
              <div>
                <div className="card-title-row">
                  <p className="eyebrow">Continuar</p>
                  <Pill tone="info">Em andamento</Pill>
                </div>
                <h2>{latest.facility || latest.client || 'Vistoria sem título'}</h2>
                <p>{latest.client || 'Cliente não informado'}</p>
                <small>Atualizada em {formatDateTime(latest.updatedAt)}</small>
              </div>
              <Link className="button button--secondary button--full" to={latest.lastRoute}>
                Retomar do último ponto <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <div>
                <p className="eyebrow">Continuar</p>
                <h2>Nenhuma vistoria em andamento</h2>
                <p>Uma vistoria iniciada aparecerá aqui para retomada rápida.</p>
              </div>
              <Link className="button button--secondary button--full" to="/inspections">
                Ver vistorias salvas
              </Link>
            </>
          )}
        </Card>
      </section>

      {demo && (
        <Card className="demo-banner">
          <div className="demo-banner__icon">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="card-title-row">
              <h2>Fluxo demonstrativo pronto</h2>
              <Pill tone="warning">CONTEÚDO FICTÍCIO</Pill>
            </div>
            <p>
              Casa de Máquinas, Chiller 01, checklist, duas ocorrências e fotografias de exemplo.
            </p>
          </div>
          <Link className="button button--secondary" to={`/inspection/${demo.id}/review`}>
            Abrir demonstração
          </Link>
        </Card>
      )}

      <section className="quick-links" aria-label="Acesso rápido">
        <Link to="/inspections" className="quick-link">
          <PlayCircle />
          <span><strong>Vistorias salvas</strong><small>{inspections.filter((item) => !item.isDemo).length} registro(s)</small></span>
          <ArrowRight />
        </Link>
        <Link to="/library" className="quick-link">
          <BookOpen />
          <span><strong>Biblioteca técnica</strong><small>Checklists e modelos locais</small></span>
          <ArrowRight />
        </Link>
        <Link to="/settings" className="quick-link">
          <Settings />
          <span><strong>Dados profissionais</strong><small>Engenheiro, CREA e relatório</small></span>
          <ArrowRight />
        </Link>
        <Link to="/backup" className="quick-link">
          <HardDrive />
          <span><strong>Backup local</strong><small>Exportar e restaurar</small></span>
          <ArrowRight />
        </Link>
      </section>
    </div>
  )
}
