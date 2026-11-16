import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { User } from '@/types'
import {
  clearAllSession,
  debugSessionState,
  persistCurrentSession,
  syncSessionStorage,
} from '@/lib/auth-session'

const QUICK_ACCESS_EMAILS: Record<string, string> = {
  administrador: 'rafaeljucacartuchos@gmail.com',
  atendente: 'atendimento.ana@assistencia.com',
  tecnico: 'tecnico.carlos@assistencia.com',
  tecnico2: 'ASSISTENCIATECNICAJUCACARTUCHO@GMAIL.COM',
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  signIn: (registrationCode: string, pass: string) => Promise<{ error: any }>
  signUp: (name: string, pass: string, role: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

/** Log de diagnóstico: mostra no console se o storage divergiu do authStore. */
function logSessionState(label: string): void {
  try {
    const state = debugSessionState()
    if (state.divergent || import.meta.env.DEV) {
      console.info(`[sessão] ${label}:`, state)
    }
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(
    pb.authStore.isValid ? (pb.authStore.record as unknown as User) : null,
  )
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sessão restaurada do storage no boot: garante que o storage reflete o
    // authStore (e limpa registro órfão caso o authStore tenha descartado).
    syncSessionStorage()

    const unsubscribe = pb.authStore.onChange(() => {
      // Fonte da verdade é o próprio authStore; o storage é sincronizado logo
      // abaixo (no signIn/signUp via persistCurrentSession, e no signOut via
      // clearAllSession).
      setUser(pb.authStore.isValid ? (pb.authStore.record as unknown as User) : null)
      setIsAuthenticated(pb.authStore.isValid)
    })

    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then(() => {
          pb.realtime.unsubscribe()
          setUser(pb.authStore.record as unknown as User)
          persistCurrentSession()
        })
        .catch(() => pb.authStore.clear())
        .finally(() => setLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setLoading(false)
    }
    return () => {
      unsubscribe()
    }
  }, [])

  const signIn = async (registrationCode: string, pass: string) => {
    const identity = registrationCode.trim()
    const applySession = (record: unknown) => {
      // 1) grava o token NOVO no storage (sobrescreve a sessão anterior)
      persistCurrentSession()
      // 2) invalida realtime/SSE da sessão anterior
      pb.realtime.unsubscribe()
      // 3) atualiza o estado React — todas as telas passam a usar o token novo
      setUser(record as unknown as User)
    }
    try {
      const res = await pb.collection('users').authWithPassword(identity, pass)
      applySession(res.record)
      logSessionState('login')
      return { error: null }
    } catch (error) {
      const fallbackEmail = QUICK_ACCESS_EMAILS[identity.toLowerCase()]
      if (fallbackEmail) {
        try {
          const res = await pb.collection('users').authWithPassword(fallbackEmail, pass)
          applySession(res.record)
          logSessionState('login (fallback)')
          return { error: null }
        } catch (fallbackError) {
          return { error: fallbackError }
        }
      }
      return { error }
    }
  }

  const signUp = async (name: string, pass: string, role: string) => {
    try {
      const created = await pb
        .collection('users')
        .create<User>({ password: pass, passwordConfirm: pass, name, role })
      const loginName = created.username || name
      const res = await pb.collection('users').authWithPassword(loginName, pass)
      persistCurrentSession()
      pb.realtime.unsubscribe()
      setUser(res.record as unknown as User)
      logSessionState('signup')
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = async () => {
    await clearAllSession()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, signIn, signUp, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
