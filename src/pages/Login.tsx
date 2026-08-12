import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)

    if (error) {
      toast({
        title: 'Falha no login',
        description: 'Credenciais inválidas. Tente novamente.',
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

  const fillTestAccount = (userEmail: string) => {
    setEmail(userEmail)
    setPassword('Skip@Pass')
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-sky-600/20 blur-3xl" />

      <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-xl z-10">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <Wrench className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white pt-2">
            Assistência Técnica Móvel
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Acesse o sistema de gerenciamento de ordens e visitas
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">E-mail corporativo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  type="email"
                  placeholder="usuario@assistencia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-300">Senha de acesso</Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            <button
              type="button"
              onClick={() => fillTestAccount('rafaeljucacartuchos@gmail.com')}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-800/40 p-2 text-center transition-all hover:bg-slate-800 hover:border-indigo-500/50"
            >
              <ShieldCheck className="h-4 w-4 text-amber-400 mb-1" />
              <span className="text-[11px] font-semibold text-slate-200">Admin</span>
            </button>
            <button
              type="button"
              onClick={() => fillTestAccount('atendimento.ana@assistencia.com')}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-800/40 p-2 text-center transition-all hover:bg-slate-800 hover:border-indigo-500/50"
            >
              <Mail className="h-4 w-4 text-sky-400 mb-1" />
              <span className="text-[11px] font-semibold text-slate-200">Atendente</span>
            </button>
            <button
              type="button"
              onClick={() => fillTestAccount('tecnico.carlos@assistencia.com')}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-800/40 p-2 text-center transition-all hover:bg-slate-800 hover:border-indigo-500/50"
            >
              <Wrench className="h-4 w-4 text-emerald-400 mb-1" />
              <span className="text-[11px] font-semibold text-slate-200">Técnico</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
