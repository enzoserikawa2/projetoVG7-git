/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SaveContextValue {
  state: SaveState
  error?: string
  runSave: <T>(operation: () => Promise<T>) => Promise<T>
  clearError: () => void
}

const SaveContext = createContext<SaveContextValue | null>(null)

export function SaveProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string>()
  const pending = useRef(0)
  const savedTimer = useRef<number | undefined>(undefined)

  const runSave = useCallback(async <T,>(operation: () => Promise<T>) => {
    pending.current += 1
    window.clearTimeout(savedTimer.current)
    setState('saving')
    setError(undefined)
    try {
      const result = await operation()
      pending.current -= 1
      if (pending.current === 0) {
        setState('saved')
        savedTimer.current = window.setTimeout(() => setState('idle'), 2200)
      }
      return result
    } catch (caught) {
      pending.current = Math.max(0, pending.current - 1)
      const message = caught instanceof Error ? caught.message : 'Falha desconhecida ao salvar.'
      setState('error')
      setError(message)
      throw caught
    }
  }, [])

  const value = useMemo(
    () => ({ state, error, runSave, clearError: () => setError(undefined) }),
    [error, runSave, state]
  )

  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>
}

export function useSaveState() {
  const context = useContext(SaveContext)
  if (!context) throw new Error('useSaveState deve ser usado dentro de SaveProvider.')
  return context
}
