import { createAppliedChecklist } from '../domain/inspection'
import { APP_SCHEMA_VERSION } from '../domain/types'
import type {
  ChecklistTemplate,
  CriticalityLevel,
  Inspection,
  InspectionPhoto,
  LibraryItem,
  NormativeReference,
  Occurrence,
  OccurrenceTemplate,
  ProfessionalSettings,
  RecommendationTemplate
} from '../domain/types'
import { db } from './database'

const CREATED_AT = '2026-09-15T12:00:00.000Z'

export const DEMO_IDS = {
  inspection: '10000000-0000-4000-8000-000000000001',
  location: '10000000-0000-4000-8000-000000000002',
  equipment: '10000000-0000-4000-8000-000000000003',
  checklist: '20000000-0000-4000-8000-000000000001',
  occurrenceCorrosionTemplate: '20000000-0000-4000-8000-000000000002',
  occurrenceInsulationTemplate: '20000000-0000-4000-8000-000000000003',
  criticalityLow: '20000000-0000-4000-8000-000000000004',
  criticalityMedium: '20000000-0000-4000-8000-000000000005',
  criticalityHigh: '20000000-0000-4000-8000-000000000006',
  pendingReference: '20000000-0000-4000-8000-000000000007',
  recommendation: '20000000-0000-4000-8000-000000000008',
  occurrenceCorrosion: '30000000-0000-4000-8000-000000000001',
  occurrenceInsulation: '30000000-0000-4000-8000-000000000002',
  photoCorrosion: '40000000-0000-4000-8000-000000000001',
  photoInsulation: '40000000-0000-4000-8000-000000000002'
} as const

function base(id: string) {
  return {
    id,
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT
  }
}

const checklistTemplate: ChecklistTemplate = {
  ...base(DEMO_IDS.checklist),
  kind: 'checklist-template',
  active: true,
  title: 'Checklist visual e documental — Chiller (exemplo)',
  version: 1,
  system: 'HVAC',
  equipmentTypes: ['Chiller'],
  criteria: [
    {
      id: '21000000-0000-4000-8000-000000000001',
      text: 'Identificação do equipamento presente e legível.',
      guidance: 'Confirmar visualmente a identificação ou tag disponível.',
      order: 1,
      active: true
    },
    {
      id: '21000000-0000-4000-8000-000000000002',
      text: 'Equipamento sem sinais visíveis de corrosão.',
      guidance: 'Inspeção exclusivamente visual das superfícies acessíveis.',
      order: 2,
      occurrenceTemplateId: DEMO_IDS.occurrenceCorrosionTemplate,
      active: true
    },
    {
      id: '21000000-0000-4000-8000-000000000003',
      text: 'Tubulações sem vazamentos aparentes.',
      guidance: 'Observar somente regiões visíveis e acessíveis, sem ensaio de estanqueidade.',
      order: 3,
      active: true
    },
    {
      id: '21000000-0000-4000-8000-000000000004',
      text: 'Isolamento térmico em condições adequadas.',
      guidance: 'Registrar danos, ausências ou deterioração visualmente observáveis.',
      order: 4,
      occurrenceTemplateId: DEMO_IDS.occurrenceInsulationTemplate,
      active: true
    },
    {
      id: '21000000-0000-4000-8000-000000000005',
      text: 'Área de acesso para manutenção desobstruída.',
      guidance: 'Considerar somente a condição encontrada no momento da vistoria.',
      order: 5,
      active: true
    },
    {
      id: '21000000-0000-4000-8000-000000000006',
      text: 'Documentação de manutenção disponibilizada para consulta.',
      guidance: 'Não concluir ausência documental sem confirmar o escopo da disponibilização.',
      order: 6,
      active: true
    }
  ]
}

const occurrenceTemplates: OccurrenceTemplate[] = [
  {
    ...base(DEMO_IDS.occurrenceCorrosionTemplate),
    kind: 'occurrence-template',
    active: true,
    title: 'Sinais visíveis de corrosão — exemplo',
    system: 'HVAC',
    category: 'Integridade visual',
    equipmentType: 'Chiller',
    technicalDescription:
      '[EXEMPLO SUJEITO À VALIDAÇÃO] Foram observadas alterações superficiais compatíveis visualmente com processo de oxidação em região acessível do equipamento.',
    recommendation:
      '[EXEMPLO SUJEITO À VALIDAÇÃO] Avaliar a extensão da condição, identificar a causa e definir tratamento compatível com o equipamento e o ambiente.',
    suggestedCriticalityId: DEMO_IDS.criticalityMedium,
    inspectorGuidance:
      'Registrar posição, extensão aparente e limitações de acesso. Não inferir perda de espessura sem medição.',
    suggestedReferenceIds: [DEMO_IDS.pendingReference]
  },
  {
    ...base(DEMO_IDS.occurrenceInsulationTemplate),
    kind: 'occurrence-template',
    active: true,
    title: 'Dano visual em isolamento térmico — exemplo',
    system: 'HVAC',
    category: 'Isolamento',
    equipmentType: 'Tubulação associada',
    technicalDescription:
      '[EXEMPLO SUJEITO À VALIDAÇÃO] Foi observada descontinuidade aparente no revestimento externo do isolamento térmico em trecho acessível.',
    recommendation:
      '[EXEMPLO SUJEITO À VALIDAÇÃO] Inspecionar o trecho, verificar a condição do isolamento e executar o reparo tecnicamente aplicável.',
    suggestedCriticalityId: DEMO_IDS.criticalityLow,
    inspectorGuidance: 'Fotografar o trecho e registrar sua localização sem presumir desempenho térmico.',
    suggestedReferenceIds: [DEMO_IDS.pendingReference]
  }
]

const criticalities: CriticalityLevel[] = [
  {
    ...base(DEMO_IDS.criticalityLow),
    kind: 'criticality',
    active: true,
    title: 'Baixa',
    description: 'Modelo de classificação. A confirmação depende do contexto avaliado pelo engenheiro.',
    rank: 1
  },
  {
    ...base(DEMO_IDS.criticalityMedium),
    kind: 'criticality',
    active: true,
    title: 'Média',
    description: 'Modelo de classificação. A confirmação depende do contexto avaliado pelo engenheiro.',
    rank: 2
  },
  {
    ...base(DEMO_IDS.criticalityHigh),
    kind: 'criticality',
    active: true,
    title: 'Alta',
    description: 'Modelo de classificação. A confirmação depende do contexto avaliado pelo engenheiro.',
    rank: 3
  }
]

const pendingReference: NormativeReference = {
  ...base(DEMO_IDS.pendingReference),
  kind: 'normative-reference',
  active: true,
  title: 'Referência a validar — exemplo',
  standardId: '',
  standardTitle: '',
  edition: '',
  clause: '',
  internalNote: 'Registro demonstrativo. Substituir somente por referência conferida pelo engenheiro.',
  validatedByEngineer: false
}

const recommendation: RecommendationTemplate = {
  ...base(DEMO_IDS.recommendation),
  kind: 'recommendation',
  active: true,
  title: 'Avaliação técnica complementar — exemplo',
  category: 'Avaliação',
  text: '[EXEMPLO SUJEITO À VALIDAÇÃO] Avaliar a condição observada e definir a intervenção aplicável considerando causa, extensão e consequência.'
}

const libraryItems: LibraryItem[] = [
  checklistTemplate,
  ...occurrenceTemplates,
  ...criticalities,
  pendingReference,
  recommendation
]

const defaultSettings: ProfessionalSettings = {
  ...base('professional'),
  id: 'professional',
  engineerName: '',
  crea: '',
  companyName: 'VG7 Engenharia',
  contact: '',
  email: '',
  reportHeader: 'VG7 ENGENHARIA • RELATÓRIO TÉCNICO',
  reportFooter: 'Documento gerado localmente. Validar integralmente antes da emissão.',
  defaultPurpose: 'Registrar as condições visualmente observadas no escopo definido para a vistoria HVAC.',
  defaultScope: 'Inspeção visual e documental dos equipamentos e áreas acessíveis informados na vistoria.',
  defaultMethodology:
    'Levantamento visual e documental, registro fotográfico e classificação dos critérios selecionados. Não foram presumidos ensaios, medições ou desmontagens não registrados.',
  defaultLimitations:
    'A vistoria limita-se às condições aparentes e às áreas acessíveis na data registrada. Componentes internos não foram avaliados sem indicação expressa.'
}

function buildDemoInspection(): Inspection {
  const checklist = createAppliedChecklist(checklistTemplate)
  const responseByOrder = new Map(checklist.responses.map((response) => [response.order, response]))
  const response1 = responseByOrder.get(1)
  const response2 = responseByOrder.get(2)
  const response3 = responseByOrder.get(3)
  const response4 = responseByOrder.get(4)
  const response5 = responseByOrder.get(5)
  const response6 = responseByOrder.get(6)
  if (!response1 || !response2 || !response3 || !response4 || !response5 || !response6) {
    throw new Error('Checklist demonstrativo inválido.')
  }
  response1.status = 'conforme'
  response2.status = 'nao_conforme'
  response2.occurrenceId = DEMO_IDS.occurrenceCorrosion
  response3.status = 'conforme'
  response4.status = 'nao_conforme'
  response4.occurrenceId = DEMO_IDS.occurrenceInsulation
  response5.status = 'nao_aplicavel'
  response5.note = 'Exemplo: acesso lateral não integra o escopo demonstrativo.'
  response6.status = 'nao_inspecionado'
  response6.note = 'Documentação não disponibilizada no cenário demonstrativo.'

  const occurrenceBase = {
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    origin: 'checklist' as const,
    locationId: DEMO_IDS.location,
    equipmentId: DEMO_IDS.equipment,
    inspectorNote: 'Conteúdo fictício para demonstração do fluxo.',
    registeredAt: CREATED_AT,
    requiresReview: false
  }

  const occurrences: Occurrence[] = [
    {
      ...occurrenceBase,
      id: DEMO_IDS.occurrenceCorrosion,
      internalNumber: 1,
      criterionId: response2.criterionId,
      criterionText: response2.criterionText,
      sourceTemplateId: DEMO_IDS.occurrenceCorrosionTemplate,
      title: 'Sinais visíveis de corrosão — EXEMPLO',
      finding:
        '[EXEMPLO] Foram observadas áreas de alteração superficial na parte inferior da carenagem do Chiller 01.',
      technicalDescription: occurrenceTemplates[0]?.technicalDescription ?? '',
      recommendation: occurrenceTemplates[0]?.recommendation ?? '',
      suggestedCriticalityId: DEMO_IDS.criticalityMedium,
      suggestedCriticalityLabel: 'Média',
      confirmedCriticalityId: DEMO_IDS.criticalityMedium,
      confirmedCriticalityLabel: 'Média — confirmação apenas demonstrativa',
      criticalityConfirmedAt: CREATED_AT,
      references: [
        {
          id: '31000000-0000-4000-8000-000000000001',
          sourceReferenceId: DEMO_IDS.pendingReference,
          standardId: '',
          standardTitle: 'Referência a validar — exemplo',
          edition: '',
          clause: '',
          applicabilityConfirmed: false
        }
      ],
      photoIds: [DEMO_IDS.photoCorrosion]
    },
    {
      ...occurrenceBase,
      id: DEMO_IDS.occurrenceInsulation,
      internalNumber: 2,
      criterionId: response4.criterionId,
      criterionText: response4.criterionText,
      sourceTemplateId: DEMO_IDS.occurrenceInsulationTemplate,
      title: 'Dano visual no isolamento térmico — EXEMPLO',
      finding:
        '[EXEMPLO] Foi observada descontinuidade aparente no revestimento externo do isolamento em trecho associado ao equipamento.',
      technicalDescription: occurrenceTemplates[1]?.technicalDescription ?? '',
      recommendation: occurrenceTemplates[1]?.recommendation ?? '',
      suggestedCriticalityId: DEMO_IDS.criticalityLow,
      suggestedCriticalityLabel: 'Baixa',
      references: [
        {
          id: '31000000-0000-4000-8000-000000000002',
          sourceReferenceId: DEMO_IDS.pendingReference,
          standardId: '',
          standardTitle: 'Referência a validar — exemplo',
          edition: '',
          clause: '',
          applicabilityConfirmed: false
        }
      ],
      photoIds: [DEMO_IDS.photoInsulation]
    }
  ]

  return {
    ...base(DEMO_IDS.inspection),
    revision: 1,
    status: 'em_andamento',
    isDemo: true,
    client: 'Cliente Exemplo — conteúdo fictício',
    facility: 'Edifício Horizonte — demonstração',
    address: 'Endereço fictício, 100 — Cidade/UF',
    inspectionDate: '2026-09-15',
    inspector: 'Engenheiro de Demonstração',
    technicalLead: 'Responsável técnico a validar',
    contractNumber: 'PROP-EXEMPLO-001',
    purpose: 'Demonstrar o fluxo de registro de uma vistoria HVAC visual e documental.',
    inspectionType: 'Vistoria visual e documental — exemplo',
    scope: 'Casa de máquinas e Chiller 01, exclusivamente para demonstração do aplicativo.',
    methodology:
      'Exemplo de levantamento visual e documental. Nenhum ensaio, medição ou avaliação real foi realizado.',
    generalNotes: 'Todos os dados, condições e imagens desta vistoria são fictícios.',
    limitations:
      'Demonstração sem valor técnico. Não representa vistoria, laudo, diagnóstico ou conclusão sobre equipamento real.',
    conclusion:
      'CONCLUSÃO DEMONSTRATIVA: este conteúdo existe apenas para validar o funcionamento do aplicativo e deve ser substituído por conclusão elaborada pelo responsável técnico.',
    locations: [
      {
        ...base(DEMO_IDS.location),
        name: 'Casa de Máquinas — EXEMPLO',
        description: 'Ambiente demonstrativo fictício.',
        observations: 'Acesso representado apenas para demonstração.',
        limitations: 'Sem inspeção real.',
        equipment: [
          {
            ...base(DEMO_IDS.equipment),
            tag: 'Chiller 01',
            type: 'Chiller',
            manufacturer: 'Fabricante fictício',
            model: 'Modelo demonstrativo',
            serialNumber: 'EXEMPLO-0001',
            operatingState: 'operando',
            observations: 'Equipamento fictício para demonstração.',
            limitations: 'Não houve acesso interno, teste ou medição.',
            checklist
          }
        ]
      }
    ],
    occurrences,
    lastRoute: `/inspection/${DEMO_IDS.inspection}/review`,
    lastLocationId: DEMO_IDS.location,
    lastEquipmentId: DEMO_IDS.equipment
  }
}

async function fetchBundledImage(path: string): Promise<Blob> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`)
  if (!response.ok) throw new Error(`Não foi possível carregar o recurso demonstrativo ${path}.`)
  return response.blob()
}

export async function ensureSeedData(): Promise<void> {
  const seeded = await db.appMeta.where('key').equals('initial-seed').first()
  if (seeded) return

  const [corrosionBlob, insulationBlob] = await Promise.all([
    fetchBundledImage('demo/chiller-corrosao.png'),
    fetchBundledImage('demo/chiller-isolamento.png')
  ])
  const demoInspection = buildDemoInspection()
  const photos: InspectionPhoto[] = [
    {
      ...base(DEMO_IDS.photoCorrosion),
      inspectionId: DEMO_IDS.inspection,
      scope: 'occurrence',
      locationId: DEMO_IDS.location,
      equipmentId: DEMO_IDS.equipment,
      occurrenceId: DEMO_IDS.occurrenceCorrosion,
      capturedAt: CREATED_AT,
      order: 1,
      caption: 'Figura demonstrativa — sinais visuais simulados de corrosão no Chiller 01.',
      originalFileName: 'chiller-corrosao-exemplo.png',
      originalMimeType: 'image/png',
      originalBlob: corrosionBlob,
      reportBlob: corrosionBlob,
      thumbnailBlob: corrosionBlob,
      processingStatus: 'ready',
      rotationDegrees: 0
    },
    {
      ...base(DEMO_IDS.photoInsulation),
      inspectionId: DEMO_IDS.inspection,
      scope: 'occurrence',
      locationId: DEMO_IDS.location,
      equipmentId: DEMO_IDS.equipment,
      occurrenceId: DEMO_IDS.occurrenceInsulation,
      capturedAt: CREATED_AT,
      order: 1,
      caption: 'Figura demonstrativa — dano simulado no revestimento do isolamento térmico.',
      originalFileName: 'chiller-isolamento-exemplo.png',
      originalMimeType: 'image/png',
      originalBlob: insulationBlob,
      reportBlob: insulationBlob,
      thumbnailBlob: insulationBlob,
      processingStatus: 'ready',
      rotationDegrees: 0
    }
  ]

  await db.transaction(
    'rw',
    [db.appMeta, db.settings, db.libraryItems, db.inspections, db.photos],
    async () => {
      await db.settings.put(defaultSettings)
      await db.libraryItems.bulkPut(libraryItems)
      await db.inspections.put(demoInspection)
      await db.photos.bulkPut(photos)
      await db.appMeta.put({
        ...base('initial-seed'),
        key: 'initial-seed',
        value: true
      })
    }
  )
}
