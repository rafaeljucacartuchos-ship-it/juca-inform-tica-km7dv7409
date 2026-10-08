import { useEffect, useRef, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RentalCustomerSelect, type RentalCustomerSelection } from '@/components/RentalCustomerSelect'
import { getRentalQuote } from '@/services/rental'
import type { RentalQuote } from '@/types'

type CommercialResult = { machine: { machineName: string; franquiaSugerida: number; excedenteSugerido: number; tco: number }; pages: number; months: number }
export function CommercialRentalSimulator({onQuoteGenerated}:{onQuoteGenerated:(q:RentalQuote)=>void}) {
  const [printers,setPrinters]=useState<Array<{id:string;modelo:string;fabricante:string}>>([])
  const [printerId,setPrinterId]=useState('')
  const [pages,setPages]=useState('1000')
  const [months,setMonths]=useState('12')
  const [scanner,setScanner]=useState('')
  const [customer,setCustomer]=useState<RentalCustomerSelection>({cliente_nome_livre:'',cliente_telefone:'',cliente_documento:'',cliente_endereco:''})
  const [result,setResult]=useState<CommercialResult|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [savedId,setSavedId]=useState('')
  const lock=useRef(false)
  const requestId=useRef('')
  useEffect(()=>{
    let alive=true
    pb.send('/backend/v1/rental-commercial',{method:'POST',body:{action:'list'},requestKey:null})
      .then(r=>{if(alive)setPrinters(r.printers)})
      .catch(()=>{if(alive)setError('Não foi possível carregar os equipamentos. Atualize a página.')})
    return ()=>{alive=false}
  },[])
  useEffect(()=>{setResult(null);setError('');setSavedId('');requestId.current=''},[printerId,pages,months,scanner])
  const run=async(action:'simulate'|'create')=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try {
      if(action==='create' && savedId){
        const q=await getRentalQuote(savedId)
        if(!q)throw new Error('Proposta salva, mas não foi possível abri-la. Consulte o histórico.')
        onQuoteGenerated(q);return
      }
      if(action==='create' && !requestId.current)requestId.current=Array.from(crypto.getRandomValues(new Uint8Array(15)),b=>(b%36).toString(36)).join('')
      const r=await pb.send('/backend/v1/rental-commercial',{method:'POST',requestKey:null,body:{action,requestId:requestId.current,printerId,pages:Number(pages),months:Number(months),scanner,customer,expectedMonthly:result?.machine.franquiaSugerida,expectedExcess:result?.machine.excedenteSugerido}})
      if(action==='simulate')setResult(r)
      else {
        setSavedId(r.id)
        const q=await getRentalQuote(r.id)
        if(!q)throw new Error('Proposta salva. Consulte o histórico para abri-la; não gere outra.')
        onQuoteGenerated(q)
      }
    }catch(e:any){setError(e.response?.error || e.message || 'Não foi possível concluir. Confira os dados.');if(action==='simulate')setResult(null)}
    finally{lock.current=false;setBusy(false)}
  }
  const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
  return <section className="rounded-xl border bg-white p-5 space-y-4">
    <h2 className="font-bold text-lg">Simulação comercial de locação</h2>
    <p className="text-sm">Selecione equipamento, franquia e prazo. Os preços seguem os parâmetros definidos pelo administrador.</p>
    <fieldset disabled={busy} className="space-y-4">
      <RentalCustomerSelect value={customer} onChange={setCustomer}/>
      <label className="block">Equipamento<select aria-label="Equipamento" className="block border rounded p-2 w-full" value={printerId} onChange={e=>setPrinterId(e.target.value)}><option value="">Selecione...</option>{printers.map(p=><option key={p.id} value={p.id}>{p.modelo} ({p.fabricante})</option>)}</select></label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label>Franquia (páginas/mês)<Input aria-label="Franquia (páginas/mês)" type="number" min="1" step="1" value={pages} onChange={e=>setPages(e.target.value)}/></label>
        <label>Prazo do contrato (meses)<Input aria-label="Prazo do contrato (meses)" type="number" min="1" max="120" step="1" value={months} onChange={e=>setMonths(e.target.value)}/></label>
      </div>
      <label className="block">Scanner<select aria-label="Scanner" className="block border rounded p-2 w-full" value={scanner} onChange={e=>setScanner(e.target.value)}><option value="">Confirme o scanner...</option>{['Sem scanner','Scanner de mesa, sem ADF','Scanner com ADF simples','Scanner com ADF duplex'].map(s=><option key={s}>{s}</option>)}</select></label>
      <Button onClick={()=>run('simulate')} disabled={!printerId}>Calcular preço</Button>
    </fieldset>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {result && <div className="rounded-lg bg-indigo-50 p-4 space-y-2">
      <h3 className="font-bold">{result.machine.machineName}</h3>
      <p>Mensalidade com {result.pages.toLocaleString('pt-BR')} páginas: <strong>{money(result.machine.franquiaSugerida)}</strong></p>
      <p>Excedente por página: <strong>R$ {result.machine.excedenteSugerido.toFixed(6).replace('.',',')}</strong></p>
      <p>Total em {result.months} meses: <strong>{money(result.machine.tco)}</strong></p>
      <Button disabled={busy || !scanner || !customer.cliente_nome_livre.trim()} onClick={()=>run('create')}>{savedId?'Abrir proposta salva':'Gerar proposta'}</Button>
    </div>}
  </section>
}
