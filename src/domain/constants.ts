import type { ChecklistStatus, EquipmentOperatingState } from './types'

export const CHECKLIST_STATUS: Record<ChecklistStatus, { label: string; shortLabel: string }> = {
  conforme: { label: 'Conforme', shortLabel: 'C' },
  nao_conforme: { label: 'Não conforme', shortLabel: 'NC' },
  nao_aplicavel: { label: 'Não aplicável', shortLabel: 'NA' },
  nao_inspecionado: { label: 'Não inspecionado', shortLabel: 'NI' }
}

export const EQUIPMENT_STATE: Record<EquipmentOperatingState, string> = {
  operando: 'Operando',
  desligado: 'Desligado',
  inacessivel: 'Inacessível',
  nao_informado: 'Não informado'
}

export const DEFAULT_CONCLUSION =
  'Conclusão a ser redigida e validada pelo responsável técnico. Os resultados apresentados se limitam ao escopo, à metodologia e às condições registradas nesta vistoria.'

export const INTERNAL_REFERENCE_PENDING = 'Referência a validar'
