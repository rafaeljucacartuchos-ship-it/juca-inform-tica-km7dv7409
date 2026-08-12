import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  signIn: (registrationCode: string, pass: string) => Promise<{ error: any }>
  signUp: (name: string, pass: string, role: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(
    pb.authStore.isValid ? (pb.authStore.record as unknown as User) : null,
  )
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(pb.authStore.isValid ? (record as unknown as User) : null)
      setIsAuthenticated(pb.authStore.isValid)
    })

    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then(() => setUser(pb.authStore.record as unknown as User))
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
    try {
      const res = await pb.collection('users').authWithPassword(registrationCode.trim(), pass)
      setUser(res.record as unknown as User)
      return { error: null }
    } catch (error) {
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
      setUser(res.record as unknown as User)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, signIn, signUp, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
