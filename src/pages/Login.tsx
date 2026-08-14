import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Lock, ArrowRight, ShieldCheck, User, ChevronDown, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

type QuickAccount = {
  username: string
  name: string
}

type ProfileGroup = {
  id: string
  label: string
  icon: React.ReactNode
  iconColor: string
  accounts: QuickAccount[]
}

const QUICK_PROFILES: ProfileGroup[] = [
  {
    id: 'admin',
    label: 'Administrador',
    icon: <ShieldCheck className="h-4 w-4" />,
    iconColor: 'text-amber-400',
    accounts: [{ username: 'administrador', name: 'Administrador' }],
  },
  {
    id: 'atendente',
    label: 'Atendente',
    icon: <User className="h-4 w-4" />,
    iconColor: 'text-sky-400',
    accounts: [{ username: 'atendente', name: 'ANA ATENDIMENTO' }],
  },
  {
    id: 'tecnico',
    label: 'Técnico',
    icon: <Wrench className="h-4 w-4" />,
    iconColor: 'text-emerald-400',
    accounts: [
      { username: 'tecnico', name: 'ROBERT MATIAS SENA' },
      { username: 'tecnico2', name: 'JOÃO VICTOR SIMÕES DA SILVA' },
    ],
  },
]

export default function Login() {
  const [cadastro, setCadastro] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cadastro || !password) return

    setLoading(true)
    const { error } = await signIn(cadastro.trim(), password)
    setLoading(false)

    if (error) {
      toast({
        title: 'Falha no login',
        description: 'Nome de usuário ou senha inválidos. Tente novamente.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Bem-vindo ao sistema!',
        description: 'Acesso autorizado com sucesso.',
      })
      navigate('/')
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value.replace(/\D/g, '').slice(0, 8))
  }

  const fillTestAccount = (code: string) => {
    setCadastro(code)
    setPassword('12345678')
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-sky-600/20 blur-3xl" />

      <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-xl z-10">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex items-center justify-center">
            <img
              src="/logo.svg"
              alt="Juca Cartuchos e Informática"
              className="h-20 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white pt-2">
            Juca Cartuchos e Informática
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Acesse o sistema de gerenciamento de ordens e visitas
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Cadastro</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Nome de usuário"
                  value={cadastro}
                  onChange={(e) => setCadastro(e.target.value)}
                  required
                  className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-300">Senha</Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 text-xs h-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-10 shadow-md shadow-indigo-600/25 mt-2"
            >
              <span>{loading ? 'Autenticando...' : 'Entrar no Sistema'}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-slate-900 px-2 text-slate-500 font-medium">
                Contas para teste rápido
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {QUICK_PROFILES.map((profile) =>
              profile.accounts.length === 1 ? (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => fillTestAccount(profile.accounts[0].username)}
                  className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-800/40 p-2 text-center transition-all hover:bg-slate-800 hover:border-indigo-500/50"
                >
                  <span className={`mb-1 ${profile.iconColor}`}>{profile.icon}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-200 truncate w-full">
                    {profile.accounts[0].username}
                  </span>
                  <span className="text-[9px] text-slate-400">{profile.label}</span>
                </button>
              ) : (
                <DropdownMenu key={profile.id}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-800/40 p-2 text-center transition-all hover:bg-slate-800 hover:border-indigo-500/50 focus:outline-none"
                    >
                      <span className={`mb-1 ${profile.iconColor} relative`}>
                        {profile.icon}
                        <ChevronDown className="absolute -right-2 -top-1 h-2.5 w-2.5 text-slate-400" />
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-200 truncate w-full">
                        {profile.accounts.length} contas
                      </span>
                      <span className="text-[9px] text-slate-400">{profile.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className="min-w-[220px] border-slate-700 bg-slate-900 text-slate-100"
                  >
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-400">
                      Selecionar {profile.label.toLowerCase()}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-800" />
                    {profile.accounts.map((acc) => (
                      <DropdownMenuItem
                        key={acc.username}
                        onClick={() => fillTestAccount(acc.username)}
                        className="flex flex-col items-start gap-0.5 py-2 focus:bg-slate-800 focus:text-white cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <UserCircle className={`h-3.5 w-3.5 ${profile.iconColor}`} />
                          <span className="text-xs font-semibold text-slate-100">{acc.name}</span>
                        </span>
                        <span className="pl-5 text-[10px] font-mono text-slate-400">
                          @{acc.username}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
