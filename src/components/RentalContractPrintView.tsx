import { RentalPrintButton } from '@/components/RentalPrintButton'
import { contractMissingDetails, type RentalContractSnapshot } from '@/lib/rental-contract-template'
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
  const snapshot = (
    contract.equipamento_dados as typeof contract.equipamento_dados & {
      modelo_contrato?: RentalContractSnapshot
    }
  )?.modelo_contrato
  if (snapshot?.version)
    return <RevisedRentalContract contract={contract} snapshot={snapshot} onBack={onBack} />
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
    <div className="space-y-4" data-rental-view>
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
          <RentalPrintButton
            disabled={!contract.id}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
          >
            <Printer className="h-4 w-4" /> Imprimir para assinatura / Salvar PDF
          </RentalPrintButton>
        </div>
      </div>

      {/* DOCUMENTO DO CONTRATO (FOLHA FORMATADA PARA IMPRESSÃO/PDF) */}
      <div data-rental-document="contract" className="bg-white text-slate-900 p-8 sm:p-12 max-w-[210mm] mx-auto shadow-md rounded-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 font-serif text-[11pt] leading-relaxed">
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

function RevisedRentalContract({
  contract,
  snapshot: s,
  onBack,
}: RentalContractPrintViewProps & { snapshot: RentalContractSnapshot }) {
  const missing = contractMissingDetails(s.details)
  if (!s.data.prazoMeses || s.data.prazoMeses < 1) missing.push('Prazo do contrato')
  if (!s.data.dataInicio) missing.push('Data prevista de início')
  const value = (key: string) => s.details[key]?.trim() || '[PREENCHER ANTES DE ASSINAR]'
  return (
    <div className="space-y-4" data-rental-view>
      <style>{`@media print { .rental-v2, .rental-v2 p, .rental-v2 span, .rental-v2 td { font-size:12pt!important; } .rental-v2 h3 { break-after:avoid; } .rental-v2 .annex { break-before:page; } .rental-v2 { box-shadow:none!important; border:0!important; padding:0!important; } }`}</style>
      <div className="print:hidden rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>Contrato {s.data.numeroContrato} — modelo revisado</strong>
            <p className="text-sm text-slate-600">
              {contract.id
                ? 'Arquivado no sistema — acesse pela lista Contratos'
                : 'Prévia não salva'}{' '}
              • {s.version}
            </p>
          </div>
          <div className="flex gap-2">
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Voltar
              </Button>
            )}
            <RentalPrintButton disabled={!contract.id}>
              {s.details.modalidade === 'eletronica'
                ? 'Salvar PDF para assinatura eletrônica'
                : 'Imprimir para assinatura / Salvar PDF'}
            </RentalPrintButton>
          </div>
        </div>
        <p className="text-sm">
          Forma escolhida:{' '}
          {s.details.modalidade === 'eletronica'
            ? 'assinatura eletrônica'
            : 'impressa, para assinatura à mão'}
          . O texto e os dados ficam arquivados ao salvar. A via assinada em papel deve ser
          conservada; seu digitalizado não é anexado automaticamente. A emissão e o status
          administrativo não comprovam assinatura. Confira os dados e anexos antes de colher as
          assinaturas.
        </p>
        {missing.length > 0 && (
          <details className="border border-amber-300 bg-amber-50 p-3 rounded" open>
            <summary className="font-semibold">
              Rascunho com {missing.length} pendências — não encaminhar para assinatura
            </summary>
            <ul className="list-disc pl-5 text-sm">
              {missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </details>
        )}
        <details className="border rounded p-3">
          <summary className="font-semibold cursor-pointer">
            Como assinar por link e guardar
          </summary>
          <ol className="list-decimal pl-5 text-sm space-y-1 mt-2">
            <li>
              Confira os dados e anexe fotos, identificação do equipamento e condições comerciais à
              versão final.
            </li>
            <li>
              Envie o PDF por um provedor que autentique os signatários e comprove a integridade.
              Cadastre o representante da JUCA e o cliente ou representante com poderes.
            </li>
            <li>
              O provedor gera o link individual. A assinatura deve ser feita pessoalmente pelo
              signatário.
            </li>
            <li>
              Baixe e guarde o PDF eletrônico original assinado, os anexos e o relatório de
              evidências; disponibilize cópia ao cliente.
            </li>
            <li>
              Não edite nem imprima novamente para PDF o arquivo já assinado. Qualquer alteração
              exige aditivo.
            </li>
          </ol>
          <p className="mt-2 text-sm font-semibold">
            Envio de links e guarda do arquivo assinado ainda não estão integrados ao sistema.
          </p>
        </details>
      </div>
      <article data-rental-document="contract" className="rental-v2 bg-white text-slate-900 p-8 sm:p-12 max-w-[210mm] mx-auto shadow border rounded font-serif text-[12pt] leading-relaxed">
        <header className="border-b-2 border-slate-900 pb-4 mb-6">
          <h1 className="font-bold text-xl">{s.locadora.nomeFantasia}</h1>
          <p>
            {s.locadora.razaoSocial} • CNPJ {s.locadora.cnpj}
          </p>
          <p>
            {s.locadora.endereco} • {s.locadora.telefone}
          </p>
          <p className="mt-3 font-bold">
            CONTRATO DE LOCAÇÃO DE EQUIPAMENTO DE IMPRESSÃO E ASSISTÊNCIA TÉCNICA
          </p>
          <p>
            Nº {s.data.numeroContrato} • Modelo {s.version}
          </p>
          <p>
            Documento preparado em {new Date(s.generatedAt).toLocaleDateString('pt-BR')}.
            Assinatura: conforme evidências do provedor ou campos de assinatura abaixo.
          </p>
        </header>
        <div className="border-2 border-slate-800 p-3 mb-6 font-bold">
          {missing.length
            ? 'RASCUNHO INCOMPLETO — PREENCHER PENDÊNCIAS E REUNIR ANEXOS ANTES DA ASSINATURA.'
            : 'VIA PARA CONFERÊNCIA E ASSINATURA — A GERAÇÃO DESTE DOCUMENTO NÃO COMPROVA ASSINATURA OU ENTREGA.'}
        </div>
        <section className="space-y-3 mb-6">
          {s.details.aprovacaoData && (
            <p>
              <strong>Aprovação da proposta informada:</strong> {s.details.aprovacaoData}, por{' '}
              {value('aprovacaoNome')}. Referência: {value('aprovacaoReferencia')}. Este registro
              não substitui a assinatura do contrato.
            </p>
          )}
          <p>
            <strong>LOCADORA:</strong> {s.locadora.razaoSocial}, CNPJ {s.locadora.cnpj}, I.E.{' '}
            {s.locadora.ie}, sediada em {s.locadora.endereco}, representada por{' '}
            {value('representanteLocadora')}.
          </p>
          <p>
            <strong>LOCATÁRIA:</strong> {value('nome')}, CPF/CNPJ {value('documento')}, endereço{' '}
            {value('endereco')}, contato {value('contato')}. Signatário: {value('representante')};
            qualidade e poderes: {value('poderes')}.
          </p>
          <p>
            As partes ajustam as condições abaixo e seus anexos, cuja leitura e concordância deverão
            preceder a assinatura.
          </p>
        </section>
        <section className="border-2 border-slate-700 p-4 mb-6 space-y-2">
          <h2 className="font-bold">QUADRO RESUMO</h2>
          <p>
            Equipamento: {s.data.equipamento.nome} • Série: {value('serial')}
          </p>
          <p>
            Scanner/digitalização:{' '}
            {s.data.equipamento.scanner === true
              ? s.data.equipamento.scannerDados || 'Incluído conforme proposta'
              : s.data.equipamento.scanner === false
                ? 'Não incluído'
                : 'Conferir na proposta'}
          </p>
          <p>
            Franquia: {s.data.franquiaPaginas.toLocaleString('pt-BR')} páginas/mês • Mensalidade:{' '}
            {formatBRL(s.data.valorMensal)}
          </p>
          <p>
            Excedente: {formatCPP(s.data.valorExcedentePagina)}/página • Prazo: {s.data.prazoMeses}{' '}
            meses
          </p>
          <p>
            Início previsto: {s.data.dataInicio || '[PREENCHER]'}; início efetivo conforme entrega
            confirmada.
          </p>
          <p>Vencimento: dia 10 do mês seguinte • Pagamento: {value('pagamento')}</p>
          <p>
            Valor de referência do bem:{' '}
            {s.details.valorBem ? formatBRL(Number(s.details.valorBem)) : '[PREENCHER]'} • Data da
            avaliação: {value('dataValor')}
          </p>
        </section>
        <div className="space-y-5">
          {s.clauses.map((c, i) => (
            <section
              key={i}
              className={
                [1, 7, 9, 10, 11, 13].includes(i) ? 'border-l-4 border-slate-600 pl-3' : ''
              }
            >
              <h3 className="font-bold mb-1">CLÁUSULA {c.titulo}</h3>
              <p className="whitespace-pre-wrap">{c.conteudo}</p>
            </section>
          ))}
        </div>
        {s.adicionais && (
          <section className="mt-6 border p-4">
            <h3 className="font-bold">CONDIÇÕES ADICIONAIS EXPRESSAMENTE AJUSTADAS</h3>
            <p className="whitespace-pre-wrap">{s.adicionais}</p>
          </section>
        )}
        {s.annexes.map((a, i) => (
          <section key={i} className="annex mt-8 border-t-2 pt-5">
            <h3 className="font-bold mb-3">{a.titulo}</h3>
            <p className="whitespace-pre-wrap">{a.conteudo}</p>
            {i === 1 && !!s.photos?.length && <div className="mt-4 space-y-4">
              <p>{s.photos.length} foto(s) incorporada(s) e arquivada(s) neste contrato.</p>
              {s.photos.map((photo, index) => <figure key={photo.id} className="page-break-inside-avoid border p-3">
                <img src={photo.dataUrl} alt={photo.caption || photo.name}
                  style={{ width: '100%', height: 'auto', maxHeight: '95mm', objectFit: 'contain' }} />
                <figcaption className="mt-2 break-words">Foto {index + 1} — {photo.caption || photo.name}</figcaption>
              </figure>)}
            </div>}
          </section>
        ))}
        <section className="annex mt-8 border-t-2 pt-5">
          <h3 className="font-bold">ASSINATURAS — CONTRATO E ANEXOS</h3>
          <p>
            As partes assinam o presente contrato e os anexos identificados, eletronicamente com
            evidências vinculadas à versão final ou em duas vias físicas de igual teor. Cada
            signatário receberá acesso à sua via. A data da contratação será comprovada pelas
            assinaturas, distinta da entrega do equipamento.
          </p>
          <p className="mt-5">
            Local e data (assinatura física): ____________________________________
          </p>
          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="border-t pt-2">
              LOCADORA
              <br />
              {s.locadora.razaoSocial}
              <br />
              {value('representanteLocadora')}
            </div>
            <div className="border-t pt-2">
              LOCATÁRIA
              <br />
              {value('nome')}
              <br />
              {value('representante')}
            </div>
          </div>
          <p className="mt-8">Testemunhas, quando utilizadas (inclusive eletronicamente):</p>
          <div className="grid grid-cols-2 gap-8 mt-10">
            <p className="border-t pt-2">
              1. Nome: __________________
              <br />
              CPF: __________________
              <br />
              Assinatura: ______________
            </p>
            <p className="border-t pt-2">
              2. Nome: __________________
              <br />
              CPF: __________________
              <br />
              Assinatura: ______________
            </p>
          </div>
        </section>
      </article>
    </div>
  )
}
