import { Button } from '@/components/ui/button'
import { Printer, Download, ArrowLeft } from 'lucide-react'
import { JUCA_LOGO_URL } from '@/lib/company'
import {
  RENTAL_LOCADORA_FIXA,
  getContractClauses,
  formatBRL,
  formatCPP,
} from '@/lib/rental-contract-template'
import type { RentalContract } from '@/types'

interface RentalContractPrintViewProps {
  contract: RentalContract
  onBack?: () => void
}

export function RentalContractPrintView({ contract, onBack }: RentalContractPrintViewProps) {
  const locatario = contract.locatario_dados || {
    nome: 'Locatário',
    cpf_cnpj: '',
    endereco: '',
    telefone: '',
  }

  const equip = contract.equipamento_dados || {
    nome: 'Equipamento de Impressão',
  }

  const clauses = getContractClauses({
    numeroContrato: contract.numero,
    locatario: {
      nome: locatario.nome || 'Locatário',
      cpfCnpj: locatario.cpf_cnpj || '—',
      rgIe: locatario.rg_ie,
      endereco: locatario.endereco || '—',
      bairro: locatario.bairro,
      cidade: locatario.cidade || 'Nova Andradina',
      estado: locatario.estado || 'MS',
      telefone: locatario.telefone || '—',
      email: locatario.email,
    },
    equipamento: {
      nome: equip.nome || 'Impressora Multifuncional',
      marca: equip.marca,
      modelo: equip.modelo,
      serial: equip.serial,
      contadorInicial: equip.contador_inicial,
      scanner: equip.scanner,
      scannerDados: equip.scanner_dados,
    },
    franquiaPaginas: contract.franquia_paginas || 0,
    valorMensal: contract.valor_mensal || 0,
    valorExcedentePagina: contract.excesso_pagina_valor || 0,
    prazoMeses: contract.contrato_meses || 12,
    dataInicio: contract.data_inicio || contract.created || new Date().toISOString(),
  })

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* BARRA DE AÇÕES (NÃO APARECE NA IMPRESSÃO) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 text-white rounded-lg shadow print:hidden">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="text-white border-slate-700 hover:bg-slate-800 text-xs gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
          <span className="font-bold text-sm">
            Contrato #{contract.numero} ({contract.status.toUpperCase()})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
          >
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO DO CONTRATO (FOLHA FORMATADA PARA IMPRESSÃO/PDF) */}
      <div className="bg-white text-slate-900 p-8 sm:p-12 max-w-4xl mx-auto shadow-md rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 font-serif text-[11pt] leading-relaxed">
        {/* CABEÇALHO DO CONTRATO */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-28 shrink-0 overflow-hidden rounded bg-slate-950 p-1 flex items-center justify-center border border-slate-800">
              <img
                src={JUCA_LOGO_URL}
                alt="JUCA Informática"
                className="h-full w-full object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = '/logo.svg'
                }}
              />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 uppercase">
                {RENTAL_LOCADORA_FIXA.nomeFantasia}
              </h1>
              <p className="text-xs font-semibold text-slate-700">
                {RENTAL_LOCADORA_FIXA.razaoSocial}
              </p>
              <p className="text-[10px] text-slate-600">
                CNPJ: {RENTAL_LOCADORA_FIXA.cnpj} | I.E.: {RENTAL_LOCADORA_FIXA.ie}
              </p>
              <p className="text-[10px] text-slate-600">
                {RENTAL_LOCADORA_FIXA.endereco} • Fone: {RENTAL_LOCADORA_FIXA.telefone}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-xs font-mono font-bold tracking-wider">
              {contract.numero}
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              Data:{' '}
              {new Date(contract.data_inicio || contract.created || Date.now()).toLocaleDateString(
                'pt-BR',
              )}
            </p>
          </div>
        </div>

        {/* TÍTULO PRINCIPAL */}
        <div className="text-center mb-6">
          <h2 className="text-base font-bold uppercase tracking-wider underline">
            INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS DE IMPRESSÃO E PRESTAÇÃO
            DE ASSISTÊNCIA TÉCNICA
          </h2>
        </div>

        {/* QUALIFICAÇÃO DAS PARTES */}
        <div className="space-y-3 mb-6 text-justify">
          <p>Por este instrumento particular de contrato, de um lado:</p>
          <p className="pl-4">
            <strong>LOCADORA:</strong> <strong>{RENTAL_LOCADORA_FIXA.razaoSocial}</strong>, pessoa
            jurídica de direito privado, inscrita no CNPJ sob o nº{' '}
            <strong>{RENTAL_LOCADORA_FIXA.cnpj}</strong> e Inscrição Estadual nº{' '}
            <strong>{RENTAL_LOCADORA_FIXA.ie}</strong>, com sede estabelecida na{' '}
            {RENTAL_LOCADORA_FIXA.endereco}, telefone {RENTAL_LOCADORA_FIXA.telefone}, doravante
            denominada simplesmente <strong>LOCADORA</strong>; e, de outro lado,
          </p>
          <p className="pl-4">
            <strong>LOCATÁRIA:</strong> <strong>{locatario.nome}</strong>, inscrita no CNPJ/CPF sob
            o nº <strong>{locatario.cpf_cnpj || '—'}</strong>
            {locatario.rg_ie ? `, I.E./RG nº ${locatario.rg_ie}` : ''}, com endereço comercial em{' '}
            {locatario.endereco || '—'}
            {locatario.telefone ? `, telefone de contato ${locatario.telefone}` : ''}, doravante
            denominada simplesmente <strong>LOCATÁRIA</strong>;
          </p>
          <p>
            Têm entre si, justo e contratado, o presente CONTRATO DE LOCAÇÃO E ASSISTÊNCIA TÉCNICA,
            que se regerá mediante as seguintes cláusulas e condições mutuamente aceitas e
            outorgadas:
          </p>
        </div>

        {/* RESUMO DOS DADOS DA LOCAÇÃO EM DESTAQUE */}
        <div className="my-6 p-4 rounded border-2 border-slate-800 bg-slate-50/70 text-xs">
          <h3 className="font-bold text-slate-900 uppercase text-center border-b border-slate-300 pb-1 mb-2">
            QUADRO RESUMO DA OPERAÇÃO
          </h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            <div>
              <strong className="text-slate-700">Equipamento:</strong>{' '}
              <span className="font-bold text-slate-900">{equip.nome}</span>
            </div>
            <div>
              <strong className="text-slate-700">Nº de Série:</strong>{' '}
              <span className="font-mono">{equip.serial || 'Conforme entrega'}</span>
            </div>
            <div>
              <strong className="text-slate-700">Contador Inicial:</strong>{' '}
              <span className="font-mono">
                {equip.contador_inicial !== undefined
                  ? `${equip.contador_inicial.toLocaleString('pt-BR')} páginas`
                  : '0 páginas'}
              </span>
            </div>
            <div>
              <strong className="text-slate-700">Franquia Contratada:</strong>{' '}
              <span className="font-bold text-indigo-900">
                {contract.franquia_paginas.toLocaleString('pt-BR')} páginas/mês
              </span>
            </div>
            <div>
              <strong className="text-slate-700">Valor Mensal da Franquia:</strong>{' '}
              <span className="font-bold text-emerald-800 text-sm font-mono">
                {formatBRL(contract.valor_mensal)}
              </span>
            </div>
            <div>
              <strong className="text-slate-700">Valor da Página Excedente:</strong>{' '}
              <span className="font-bold text-rose-800 font-mono">
                {formatCPP(contract.excesso_pagina_valor)} / pág.
              </span>
            </div>
            <div>
              <strong className="text-slate-700">Prazo do Contrato:</strong>{' '}
              <span>{contract.contrato_meses || 12} meses</span>
            </div>
            <div>
              <strong className="text-slate-700">Vencimento Mensal:</strong>{' '}
              <span>Todo dia 10 (dez) de cada mês</span>
            </div>
          </div>
        </div>

        {/* CLÁUSULAS FIXAS INTEGRAIS */}
        <div className="space-y-4 text-justify">
          {clauses.map((c, idx) => (
            <div key={idx} className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-wide">
                {c.titulo}
              </h4>
              <p className="text-xs sm:text-[11pt] leading-relaxed text-slate-800 pl-2">
                {c.conteudo}
              </p>
            </div>
          ))}

          {contract.clausulas_adicionais && (
            <div className="space-y-1 mt-4 p-3 border border-slate-300 rounded bg-slate-50">
              <h4 className="font-bold text-slate-900 text-xs uppercase">
                CLÁUSULAS OU DISPOSIÇÕES ADICIONAIS
              </h4>
              <p className="text-xs text-slate-800 whitespace-pre-wrap">
                {contract.clausulas_adicionais}
              </p>
            </div>
          )}
        </div>

        {/* DATA E FECHAMENTO */}
        <div className="mt-8 text-center text-xs">
          <p>
            E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em
            02 (duas) vias de igual teor e forma, na presença de duas testemunhas, para que produza
            todos os seus jurídicos e legais efeitos.
          </p>
          <p className="mt-4 font-semibold">Nova Andradina - MS, {dataFormatada}.</p>
        </div>

        {/* CAMPOS DE ASSINATURA */}
        <div className="mt-16 pt-6 grid grid-cols-2 gap-12 text-center text-xs page-break-inside-avoid">
          <div>
            <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
              {RENTAL_LOCADORA_FIXA.razaoSocial}
            </div>
            <p className="text-[10px] text-slate-600">LOCADORA</p>
            <p className="text-[9px] text-slate-500 font-mono">CNPJ: {RENTAL_LOCADORA_FIXA.cnpj}</p>
          </div>
          <div>
            <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
              {locatario.nome}
            </div>
            <p className="text-[10px] text-slate-600">LOCATÁRIA</p>
            <p className="text-[9px] text-slate-500 font-mono">
              {locatario.cpf_cnpj
                ? `CPF/CNPJ: ${locatario.cpf_cnpj}`
                : 'Assinatura do Representante Legal'}
            </p>
          </div>
        </div>

        {/* TESTEMUNHAS */}
        <div className="mt-12 pt-6 grid grid-cols-2 gap-12 text-left text-[10px] text-slate-600 page-break-inside-avoid">
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1" />
            <p>1ª Testemunha:</p>
            <p>Nome:</p>
            <p>CPF:</p>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-1 mb-1" />
            <p>2ª Testemunha:</p>
            <p>Nome:</p>
            <p>CPF:</p>
          </div>
        </div>
      </div>
    </div>
  )
}
