import { useRegisterSW } from 'virtual:pwa-register/react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button } from '../components/ui'
import { BackupPage } from '../pages/BackupPage'
import { ChecklistPage } from '../pages/ChecklistPage'
import { EquipmentPage } from '../pages/EquipmentPage'
import { HomePage } from '../pages/HomePage'
import { InspectionBasicsPage } from '../pages/InspectionBasicsPage'
import { InspectionListPage } from '../pages/InspectionListPage'
import { InspectionLocationsPage } from '../pages/InspectionLocationsPage'
import { InspectionPhotosPage } from '../pages/InspectionPhotosPage'
import { InspectionReportPage } from '../pages/InspectionReportPage'
import { InspectionReviewPage } from '../pages/InspectionReviewPage'
import { LibraryPage } from '../pages/LibraryPage'
import { OccurrencePage } from '../pages/OccurrencePage'
import { SettingsPage } from '../pages/SettingsPage'
import { SaveProvider } from './SaveContext'

function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW()

  if (!needRefresh && !offlineReady) return null
  return (
    <div className="pwa-prompt" role="status">
      <Alert title={needRefresh ? 'Atualização disponível' : 'Aplicativo pronto para uso offline'} tone="info">
        {needRefresh
          ? 'A nova versão será aplicada somente quando você confirmar.'
          : 'Os arquivos essenciais foram armazenados neste dispositivo.'}
        <div className="button-row pwa-prompt__actions">
          {needRefresh && <Button onClick={() => void updateServiceWorker(true)}>Atualizar agora</Button>}
          <Button
            variant="ghost"
            onClick={() => {
              setNeedRefresh(false)
              setOfflineReady(false)
            }}
          >
            Fechar
          </Button>
        </div>
      </Alert>
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <SaveProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/inspections" element={<InspectionListPage />} />
            <Route path="/inspection/:inspectionId/basics" element={<InspectionBasicsPage />} />
            <Route path="/inspection/:inspectionId/locations" element={<InspectionLocationsPage />} />
            <Route
              path="/inspection/:inspectionId/location/:locationId/equipment/:equipmentId"
              element={<EquipmentPage />}
            />
            <Route
              path="/inspection/:inspectionId/location/:locationId/equipment/:equipmentId/checklist"
              element={<ChecklistPage />}
            />
            <Route path="/inspection/:inspectionId/occurrence/:occurrenceId" element={<OccurrencePage />} />
            <Route path="/inspection/:inspectionId/photos" element={<InspectionPhotosPage />} />
            <Route path="/inspection/:inspectionId/review" element={<InspectionReviewPage />} />
            <Route path="/inspection/:inspectionId/report" element={<InspectionReportPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
        <PwaUpdatePrompt />
      </SaveProvider>
    </HashRouter>
  )
}
