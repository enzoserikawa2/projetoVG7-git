import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AutosaveInput, AutosaveTextarea } from '../components/AutosaveField'
import { Alert, Card, PageTitle, Skeleton } from '../components/ui'
import { mutateInspection } from '../db/repository'
import type { Inspection } from '../domain/types'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection } from '../features/inspections/useInspection'

type TextField = Exclude<
  keyof Inspection,
  | 'id'
  | 'schemaVersion'
  | 'createdAt'
  | 'updatedAt'
  | 'revision'
  | 'status'
  | 'isDemo'
  | 'locations'
  | 'occurrences'
  | 'finalizedAt'
  | 'pendingAcknowledgedAt'
>

export function InspectionBasicsPage() {
  const { inspectionId } = useParams()
  const inspection = useInspection(inspectionId)
  const route = inspectionId ? `/inspection/${inspectionId}/basics` : ''

  useEffect(() => {
    if (!inspection || inspection.lastRoute === route) return
    void mutateInspection(inspection.id, (draft) => {
      draft.lastRoute = route
    })
  }, [inspection, route])

  if (!inspectionId || inspection === undefined) return <Skeleton height={420} />

  const saveText = (field: TextField) => async (value: string) => {
    await mutateInspection(inspection.id, (draft) => {
      const target = draft as Record<TextField, string>
      target[field] = value
    })
  }

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow="Etapa 1"
        title="Dados da vistoria"
        description="Comece pelos dados essenciais. Os textos técnicos podem ser refinados antes do relatório."
      />

      {inspection.isDemo && (
        <Alert title="Vistoria demonstrativa" tone="warning">
          Todos os nomes, condições e textos desta vistoria são fictícios e não possuem valor técnico.
        </Alert>
      )}

      <Card className="form-card">
        <div className="form-section">
          <div className="section-heading">
            <div>
              <h2>Identificação</h2>
              <p>Informações exibidas na capa e na abertura do relatório.</p>
            </div>
          </div>
          <div className="form-grid form-grid--2">
            <AutosaveInput label="Cliente" required value={inspection.client} onSave={saveText('client')} />
            <AutosaveInput
              label="Empreendimento"
              required
              value={inspection.facility}
              onSave={saveText('facility')}
            />
            <AutosaveInput
              label="Endereço"
              value={inspection.address}
              onSave={saveText('address')}
            />
            <AutosaveInput
              label="Data da vistoria"
              type="date"
              required
              value={inspection.inspectionDate}
              onSave={saveText('inspectionDate')}
            />
            <AutosaveInput
              label="Inspetor"
              value={inspection.inspector}
              onSave={saveText('inspector')}
            />
            <AutosaveInput
              label="Responsável técnico"
              value={inspection.technicalLead}
              onSave={saveText('technicalLead')}
            />
            <AutosaveInput
              label="Proposta ou contrato"
              value={inspection.contractNumber}
              onSave={saveText('contractNumber')}
            />
            <AutosaveInput
              label="Tipo de inspeção"
              value={inspection.inspectionType}
              onSave={saveText('inspectionType')}
            />
          </div>
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div>
              <h2>Definição técnica</h2>
              <p>Delimite claramente o que foi e o que não foi realizado.</p>
            </div>
          </div>
          <AutosaveTextarea label="Finalidade" value={inspection.purpose} onSave={saveText('purpose')} />
          <AutosaveTextarea label="Escopo" value={inspection.scope} onSave={saveText('scope')} />
          <AutosaveTextarea
            label="Metodologia"
            value={inspection.methodology}
            onSave={saveText('methodology')}
            hint="Não declare testes, medições ou desmontagens que não tenham ocorrido."
          />
          <AutosaveTextarea
            label="Limitações da inspeção"
            value={inspection.limitations}
            onSave={saveText('limitations')}
            hint="Registre inacessibilidade, ausência documental e demais restrições relevantes."
          />
          <AutosaveTextarea
            label="Observações gerais"
            value={inspection.generalNotes}
            onSave={saveText('generalNotes')}
          />
        </div>
      </Card>

      <div className="sticky-actions">
        <Link className="button button--primary" to={`/inspection/${inspection.id}/locations`}>
          Locais e equipamentos <ArrowRight size={19} />
        </Link>
      </div>
    </div>
  )
}
