import { createContext, useContext, useState, type ReactNode } from 'react'
import type { AuthUser, Role } from '../types'

interface AuthCtx {
  user: AuthUser | null
  login: (u: AuthUser) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role') as Role | null
    const userId = localStorage.getItem('userId')
    const displayName = localStorage.getItem('displayName')
    if (token && role && userId && displayName)
      return { token, role, userId, displayName }
    return null
  })

  const login = (u: AuthUser) => {
    localStorage.setItem('token', u.token)
    localStorage.setItem('role', u.role)
    localStorage.setItem('userId', u.userId)
    localStorage.setItem('displayName', u.displayName)
    setUser(u)
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
