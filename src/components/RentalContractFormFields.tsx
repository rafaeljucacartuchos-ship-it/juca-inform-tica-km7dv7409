import type { Dispatch, SetStateAction } from 'react'
import { CONTRACT_DETAIL_FIELDS, type ContractDetails } from '@/lib/rental-contract-template'
import type { RentalContractPhoto } from '@/lib/rental-contract-photos'
import { RentalContractPhotosEditor } from '@/components/RentalContractPhotosEditor'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const choices: Record<string, string[]> = {
  poderes: [
    'Próprio cliente — pessoa física titular',
    'Sócio-administrador — conferir contrato social',
    'Procurador — conferir procuração',
  ],
  estadoBem: [
    'Revisada e funcionando, sem avarias aparentes',
    'Nova, sem avarias aparentes',
    'Funcionando, com marcas de uso descritas nas fotos',
  ],
  acessorios: [
    'Cabo de energia e bandeja de papel',
    'Cabo de energia, cabo USB e bandeja de papel',
    'Sem acessórios adicionais',
  ],
  exclusoes: [
    'Papel por conta do cliente; instalação e transporte sem cobrança adicional',
    'Papel por conta do cliente; transporte cobrado conforme proposta',
  ],
  contagem: [
    'Contador do Printway; cada lado impresso conta como uma página; digitalização sem impressão não é cobrada',
    'Leitura manual do contador; cada lado impresso conta como uma página; digitalização sem impressão não é cobrada',
  ],
  slaAtendimento: ['8', '24', '48'],
  slaSubstituicao: ['24', '48', '72'],
  expediente: ['Segunda a sexta, das 8h às 18h, exceto feriados — Nova Andradina'],
  canal: [
    'WhatsApp da JUCA: (67) 99654-4981, com registro do chamado',
    'Telefone da JUCA: (67) 3441-4981, com registro do chamado',
  ],
  pagamento: [
    'PIX',
    'Boleto bancário',
    'Transferência bancária',
    'Pagamento no escritório da JUCA',
  ],
}

const groups = [
  {
    title: 'Cliente e responsáveis',
    hint: 'Preencha os dados do cliente e, abaixo, os dados de cada pessoa que vai assinar.',
    keys: ['nome', 'documento', 'endereco', 'contato'],
  },
  {
    title: 'Equipamento e entrega',
    hint: 'Confira a série, o contador e o estado da impressora na entrega.',
    keys: [
      'serial',
      'contador',
      'local',
      'estadoBem',
      'acessorios',
      'valorBem',
      'dataValor',
      'provaValor',
    ],
  },
  {
    title: 'Serviços e pagamento',
    hint: 'Registre o que foi combinado na proposta, sem criar novos custos aqui.',
    keys: [
      'supplies',
      'exclusoes',
      'contagem',
      'slaAtendimento',
      'slaSubstituicao',
      'expediente',
      'canal',
      'pagamento',
    ],
  },
]
const labels: Record<string, [string, string]> = {
  nome: ['Nome ou razão social do cliente', 'Use o nome completo ou a razão social do cadastro.'],
  documento: ['CPF ou CNPJ do cliente', 'Informe o documento do titular do contrato.'],
  endereco: ['Endereço do cliente', 'Rua, número, bairro, cidade, UF e CEP.'],
  contato: ['Telefone ou e-mail de contato', 'Contato para assuntos do contrato.'],
  representante: ['Quem assina pelo cliente', 'Nome completo e CPF da pessoa que vai assinar.'],
  poderes: [
    'Essa pessoa assina como:',
    'Escolha: próprio cliente, sócio-administrador ou procurador. Se representar uma empresa ou outra pessoa, confira o documento indicado.',
  ],
  representanteLocadora: [
    'Quem assina pela JUCA',
    'Nome, CPF e cargo ou função do representante da JUCA.',
  ],
  serial: ['Número de série da impressora', 'Copie o número da etiqueta do equipamento.'],
  contador: [
    'Contador na entrega (páginas)',
    'Total já impresso, conforme o contador. Informe 0 somente se conferido.',
  ],
  local: ['Local de instalação', 'Endereço e setor onde a impressora será utilizada.'],
  estadoBem: [
    'Estado da impressora na entrega',
    'Descreva revisão, funcionamento e marcas ou avarias existentes.',
  ],
  acessorios: [
    'Acessórios entregues',
    'Liste cabos, bandejas e outros itens, com identificação quando houver.',
  ],
  valorBem: [
    'Valor do equipamento na proposta (R$)',
    'Preenchido pela precificação. Para mudar, revise a proposta de origem.',
  ],
  dataValor: [
    'Data da avaliação do equipamento',
    'Data usada para determinar o valor de referência.',
  ],
  provaValor: [
    'Comprovante do valor do equipamento',
    'Identifique a nota fiscal, cotação ou avaliação utilizada.',
  ],
  supplies: [
    'Suprimentos e peças incluídos',
    'Liste os itens cobertos pela mensalidade, conforme a proposta.',
  ],
  exclusoes: [
    'Itens não incluídos e cobranças extras',
    'Informe o combinado para papel, instalação e transporte; escreva sem cobrança adicional quando aplicável.',
  ],
  contagem: [
    'Como as páginas serão contadas',
    'Informe P&B/cor, tamanho do papel, cópias e frente e verso.',
  ],
  slaAtendimento: [
    'Prazo para iniciar atendimento',
    'Em horas úteis, conforme o combinado com o cliente.',
  ],
  slaSubstituicao: [
    'Prazo para fornecer outra impressora',
    'Em horas úteis de indisponibilidade, conforme o combinado.',
  ],
  expediente: ['Horários e região de atendimento', 'Dias, horários, feriados e cidades cobertas.'],
  canal: [
    'Como solicitar assistência',
    'Telefone, WhatsApp ou outro canal e como será registrado o chamado.',
  ],
  pagamento: ['Forma de pagamento', 'Ex.: boleto, PIX ou transferência, conforme o combinado.'],
  fotos: [
    'Outras referências de fotos e documentos',
    'Opcional se as fotos já estiverem anexadas. Identifique relatórios e documentos adicionais.',
  ],
}
const multiline = new Set([
  'endereco',
  'poderes',
  'local',
  'estadoBem',
  'acessorios',
  'provaValor',
  'supplies',
  'exclusoes',
  'contagem',
  'expediente',
  'canal',
  'fotos',
])

export function RentalContractFormFields(p: {
  number: string
  setNumber: (value: string) => void
  date: string
  setDate: (value: string) => void
  notes: string
  setNotes: (value: string) => void
  details: ContractDetails
  setDetails: Dispatch<SetStateAction<ContractDetails>>
  photos: RentalContractPhoto[]
  setPhotos: (value: RentalContractPhoto[]) => void
  busy: boolean
  preparingPhotos: boolean
  setPreparingPhotos: (value: boolean) => void
  saveDraft: () => void
  cancel: () => void
  proposalId: string
}) {
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({})
  const disabled = p.busy || p.preparingPhotos
  const filled = (keys: string[]) => keys.filter((key) => p.details[key]?.trim()).length
  function signer(owner: 'cliente' | 'juca') {
    const prefix = owner === 'cliente' ? 'signatarioCliente' : 'signatarioJuca'
    const legacy = owner === 'cliente' ? 'representante' : 'representanteLocadora'
    const update = (suffix: string, value: string) =>
      p.setDetails((prev) => {
        const next = { ...prev, [prefix + suffix]: value }
        const name = next[prefix + 'Nome']?.trim()
        const cpf = next[prefix + 'Cpf']?.trim()
        const role = next[prefix + 'Cargo']?.trim()
        next[legacy] =
          name && cpf && (owner === 'cliente' || role)
            ? name + ', CPF ' + cpf + (owner === 'juca' ? ', ' + role : '')
            : ''
        if (owner === 'cliente') next.signatarioClienteOrigem = 'conferido-no-formulario'
        return next
      })
    return (
      <section className="rounded-xl border border-indigo-100 bg-slate-50 p-4 sm:p-5 space-y-4">
        <h4 className="font-semibold text-base">
          {owner === 'cliente' ? 'Quem assina pelo cliente' : 'Quem assina pela JUCA'}
        </h4>
        {owner === 'cliente' && (
          <label className="block space-y-2">
            <span className="font-medium">A pessoa que vai assinar é:</span>
            <select
              aria-label="A pessoa que vai assinar é"
              className="w-full rounded-lg border p-3 bg-white"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === 'titular')
                  p.setDetails((d) => ({
                    ...d,
                    signatarioClienteNome: d.nome || '',
                    signatarioClienteCpf: d.documento || '',
                    representante: (d.nome || '') + ', CPF ' + (d.documento || ''),
                    poderes: 'Próprio cliente — pessoa física titular',
                    signatarioClienteOrigem: 'titular-sugerido',
                  }))
                if (e.target.value === 'outra')
                  p.setDetails((d) => ({
                    ...d,
                    signatarioClienteNome: '',
                    signatarioClienteCpf: '',
                    representante: '',
                    poderes: '',
                    signatarioClienteOrigem: '',
                  }))
              }}
            >
              <option value="">Selecione para confirmar</option>
              {(p.details.documento || '').replace(/\D/g, '').length === 11 && (
                <option value="titular">O próprio cliente — usar nome e CPF acima</option>
              )}
              <option value="outra">Outra pessoa — informar nome e CPF</option>
            </select>
          </label>
        )}
        {owner === 'cliente' && p.details.signatarioClienteOrigem === 'titular-sugerido' && (
          <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
            Nome e CPF trazidos do titular da proposta. Confira se ele será a pessoa que vai
            assinar; se for outra pessoa, substitua os dados abaixo.
          </p>
        )}
        {p.details[legacy] && !p.details[prefix + 'Nome'] && (
          <p className="text-sm text-slate-600">
            Informação já cadastrada, preservada: {p.details[legacy]}
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-5">
          <label className="space-y-2">
            <span className="block font-medium">Nome completo</span>
            <Input
              className="h-12 text-base bg-white"
              aria-label={
                'Nome de quem assina ' + (owner === 'cliente' ? 'pelo cliente' : 'pela JUCA')
              }
              value={p.details[prefix + 'Nome'] || ''}
              onChange={(e) => update('Nome', e.target.value)}
              placeholder="Digite somente o nome"
            />
          </label>
          <label className="space-y-2">
            <span className="block font-medium">CPF</span>
            <Input
              className="h-12 text-base bg-white"
              inputMode="numeric"
              maxLength={14}
              aria-label={
                'CPF de quem assina ' + (owner === 'cliente' ? 'pelo cliente' : 'pela JUCA')
              }
              value={p.details[prefix + 'Cpf'] || ''}
              onChange={(e) => update('Cpf', e.target.value)}
              placeholder="000.000.000-00"
            />
          </label>
          {owner === 'juca' && (
            <label className="space-y-2 sm:col-span-2">
              <span className="block font-medium">Cargo ou função na JUCA</span>
              <select
                className="w-full h-12 border rounded-lg bg-white px-3"
                aria-label="Cargo ou função na JUCA"
                value={p.details[prefix + 'Cargo'] || ''}
                onChange={(e) => update('Cargo', e.target.value)}
              >
                <option value="">Selecione a função</option>
                {['Administrador', 'Sócio-administrador', 'Procurador'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
                {p.details[prefix + 'Cargo'] &&
                  !['Administrador', 'Sócio-administrador', 'Procurador'].includes(
                    p.details[prefix + 'Cargo'],
                  ) && <option>{p.details[prefix + 'Cargo']}</option>}
              </select>
            </label>
          )}
        </div>
        {owner === 'cliente' && field('poderes')}
      </section>
    )
  }
  function field(key: string) {
    const original = CONTRACT_DETAIL_FIELDS.find((f) => f[0] === key)!
    const [label, hint] = labels[key]
    const id = 'rental-detail-' + key
    const shared = {
      id,
      'aria-describedby': id + '-help',
      value: p.details[key] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        p.setDetails((prev) => ({ ...prev, [key]: e.target.value })),
      className:
        'w-full min-h-12 border border-slate-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500',
    }
    return (
      <div key={key} className={multiline.has(key) ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
        <label htmlFor={id} className="block font-medium text-slate-900">
          {label}
        </label>
        {key === 'local' && (
          <Button
            type="button"
            variant="outline"
            onClick={() => p.setDetails((d) => ({ ...d, local: d.endereco || '' }))}
          >
            Usar endereço do cliente
          </Button>
        )}
        {choices[key] && (
          <select
            id={id + '-choice'}
            aria-label={label + ' — selecionar opção'}
            className={shared.className}
            value={
              customFields[key]
                ? '__other'
                : choices[key].includes(shared.value)
                  ? shared.value
                  : shared.value
                    ? '__saved'
                    : ''
            }
            onChange={(e) => {
              const value = e.target.value
              if (value === '__saved') return
              setCustomFields((prev) => ({ ...prev, [key]: value === '__other' }))
              if (value !== '__other') p.setDetails((prev) => ({ ...prev, [key]: value }))
            }}
          >
            <option value="">Selecione o que foi combinado</option>
            {shared.value && !choices[key].includes(shared.value) && (
              <option value="__saved">Manter informação já preenchida: {shared.value}</option>
            )}
            {choices[key].map((value) => (
              <option key={value} value={value}>
                {key.startsWith('sla') ? value + ' horas úteis' : value}
              </option>
            ))}
            <option value="__other">Outra opção — escrever minha informação</option>
          </select>
        )}
        {choices[key] && !customFields[key] && shared.value && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCustomFields((prev) => ({ ...prev, [key]: true }))}
          >
            Personalizar ou complementar esta informação
          </Button>
        )}
        {choices[key] && customFields[key] && (
          <p className="text-sm text-indigo-700">
            A informação atual foi mantida abaixo. Você pode editar ou acrescentar detalhes para
            este contrato.
          </p>
        )}
        {(!choices[key] || customFields[key]) &&
          (multiline.has(key) ? (
            <textarea {...shared} rows={2} />
          ) : (
            <Input
              {...shared}
              type={original[2]}
              readOnly={key === 'valorBem'}
              min={original[2] === 'number' ? 0 : undefined}
              step={key === 'valorBem' ? '0.01' : '1'}
            />
          ))}
        <p id={id + '-help'} className="text-xs text-slate-500">
          {hint}
        </p>
      </div>
    )
  }
  return (
    <>
      <fieldset disabled={disabled} className="space-y-4">
        <section className="rounded-xl border bg-indigo-50/50 p-4 space-y-3">
          <h3 className="font-semibold text-slate-900">Identificação do contrato</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              Número do contrato
              <Input
                aria-label="Número do contrato"
                value={p.number}
                onChange={(e) => p.setNumber(e.target.value)}
                required
                placeholder="Ex.: CT-2026-001"
              />
            </label>
            <label className="space-y-1.5">
              Entrega e início previstos
              <Input
                aria-label="Entrega e início previstos"
                type="date"
                value={p.date}
                onChange={(e) => p.setDate(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-slate-600 break-all">
            Proposta de origem (identificador interno): {p.proposalId}
          </p>
          <p className="text-sm text-indigo-900">
            Dados disponíveis preenchidos automaticamente pela proposta e pelo cadastro vinculado.
            Confira e complete apenas o que faltar.
          </p>
          <p className="text-xs text-slate-600">
            Para empresa, o representante precisa estar identificado: razão social não é nome de
            quem assina. O responsável da JUCA também deve ser conferido. Você pode salvar um
            rascunho e completar depois.
          </p>
        </section>
        {groups.map((group, index) => (
          <details
            key={group.title}
            open={index === 0}
            className="group rounded-xl border border-slate-200 bg-white"
          >
            <summary className="cursor-pointer p-4 font-semibold text-slate-900">
              {index + 1}. {group.title}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {filled(group.keys)}/{group.keys.length} preenchidos
              </span>
            </summary>
            <div className="px-4 pb-5 space-y-4">
              <p className="text-sm text-slate-600">{group.hint}</p>
              <div className="grid sm:grid-cols-2 gap-4">{group.keys.map(field)}</div>
              {index === 0 && (
                <div className="space-y-5">
                  {signer('cliente')}
                  {signer('juca')}
                </div>
              )}
            </div>
          </details>
        ))}
        <details className="rounded-xl border bg-white">
          <summary className="cursor-pointer p-4 font-semibold">
            4. Fotos e documentos{' '}
            <span className="ml-2 text-xs font-normal text-slate-500">
              {p.photos.length} foto(s) anexada(s)
            </span>
          </summary>
          <div className="px-4 pb-5 space-y-4">
            <RentalContractPhotosEditor
              photos={p.photos}
              onChange={p.setPhotos}
              disabled={p.busy}
              onBusyChange={p.setPreparingPhotos}
            />
            {field('fotos')}
          </div>
        </details>
        <details className="rounded-xl border bg-white">
          <summary className="cursor-pointer p-4 font-semibold">5. Aprovação e assinatura</summary>
          <div className="px-4 pb-5 space-y-4">
            <p className="text-sm text-slate-600">
              Preencha a aprovação recebida para usar “Arquivar para assinatura”. Para salvar apenas
              um rascunho, pode completar depois.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                Data da aprovação
                <Input
                  aria-label="Data da aprovação"
                  type="date"
                  value={p.details.aprovacaoData || ''}
                  onChange={(e) => p.setDetails((d) => ({ ...d, aprovacaoData: e.target.value }))}
                />
              </label>
              <label>
                Quem aprovou a proposta?
                <select
                  aria-label="Selecionar quem aprovou"
                  className="block w-full border rounded-lg p-3 bg-white"
                  value=""
                  onChange={(e) => p.setDetails((d) => ({ ...d, aprovacaoNome: e.target.value }))}
                >
                  <option value="">Escolher uma pessoa já informada</option>
                  {Array.from(
                    new Set([p.details.nome, p.details.signatarioClienteNome].filter(Boolean)),
                  ).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <Input
                  aria-label="Nome de quem aprovou"
                  placeholder="Ou informe outra pessoa"
                  value={p.details.aprovacaoNome || ''}
                  onChange={(e) => p.setDetails((d) => ({ ...d, aprovacaoNome: e.target.value }))}
                />
              </label>
              <label className="sm:col-span-2">
                Onde a aprovação foi registrada
                <Input
                  aria-label="Onde a aprovação foi registrada"
                  placeholder="Ex.: mensagem de WhatsApp ou e-mail, com data"
                  value={p.details.aprovacaoReferencia || ''}
                  onChange={(e) =>
                    p.setDetails((d) => ({ ...d, aprovacaoReferencia: e.target.value }))
                  }
                />
              </label>
              <label className="sm:col-span-2">
                Como será assinado
                <select
                  aria-label="Como será assinado"
                  className="block w-full border rounded-lg p-2 mt-1 bg-white"
                  value={p.details.modalidade || 'impressa'}
                  onChange={(e) => p.setDetails((d) => ({ ...d, modalidade: e.target.value }))}
                >
                  <option value="impressa">Em papel — assinatura à mão</option>
                  <option value="eletronica">Eletronicamente — por provedor externo</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Salvar não ativa a locação nem comprova assinatura. Para assinatura eletrônica, envie
              o PDF por um provedor externo; o sistema não envia o link nem guarda a via assinada
              automaticamente.
            </p>
          </div>
        </details>
        <label className="block rounded-xl border bg-white p-4 space-y-2">
          <span className="font-semibold">
            Observações e condições especiais{' '}
            <span className="font-normal text-slate-500">(opcional)</span>
          </span>
          <textarea
            aria-label="Observações e condições especiais"
            className="w-full border rounded-lg p-3"
            rows={3}
            value={p.notes}
            onChange={(e) => p.setNotes(e.target.value)}
            placeholder="Registre somente condições combinadas com o cliente."
          />
        </label>
      </fieldset>
      <div className="sticky bottom-0 bg-white border-t pt-3 pb-1 space-y-2">
        <p className="text-xs text-slate-500">
          Os dados e as fotos só ficam gravados depois de salvar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={disabled}
            onClick={p.saveDraft}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {p.busy ? 'Salvando…' : 'Salvar rascunho e visualizar'}
          </Button>
          <Button type="submit" variant="outline" disabled={disabled}>
            Arquivar para assinatura
          </Button>
          <Button type="button" variant="ghost" disabled={disabled} onClick={p.cancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </>
  )
}
