// Modelo legado preservado para documentos emitidos antes da versão v2.

export const RENTAL_LOCADORA_FIXA = {
  razaoSocial: 'JUCA CARTUCHOS E INFORMÁTICA LTDA',
  nomeFantasia: 'JUCA INFORMÁTICA',
  cnpj: '10.612.947/0001-07',
  ie: '28.350.859-0',
  endereco: 'Rua Vearni Castro, 1515, Centro, Nova Andradina - MS, CEP: 79750-051',
  telefone: '(67) 3441-4981',
  email: 'contato@jucainformatica.com.br',
  cidadeForo: 'Nova Andradina - MS',
}

export interface ContractTemplateData {
  numeroContrato: string
  locatario: {
    nome: string
    cpfCnpj: string
    rgIe?: string
    endereco: string
    bairro?: string
    cidade?: string
    estado?: string
    telefone: string
    email?: string
  }
  equipamento: {
    nome: string
    marca?: string
    modelo?: string
    serial?: string
    contadorInicial?: number
    scanner?: boolean
    scannerDados?: string
  }
  franquiaPaginas: number
  valorMensal: number
  valorExcedentePagina: number
  prazoMeses: number
  dataInicio: string
}

export function formatBRL(val: number): string {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCPP(val: number): string {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  })
}

export function getContractClauses(data: ContractTemplateData) {
  const equipDesc = [
    data.equipamento.nome,
    data.equipamento.marca ? `Marca: ${data.equipamento.marca}` : '',
    data.equipamento.modelo ? `Modelo: ${data.equipamento.modelo}` : '',
    data.equipamento.serial
      ? `Nº de Série: ${data.equipamento.serial}`
      : 'Nº de Série: Conforme entrega',
    data.equipamento.contadorInicial !== undefined
      ? `Contador Inicial: ${data.equipamento.contadorInicial.toLocaleString('pt-BR')} páginas`
      : 'Contador Inicial: 0 páginas',
  ]
    .filter(Boolean)
    .join(', ')

  return [
    {
      titulo: 'CLÁUSULA PRIMEIRA – DO OBJETO, MANUTENÇÃO E SUPRIMENTOS (PADRONIZADA — SEÇÃO 17.1)',
      conteudo: `O presente instrumento tem por objeto a locação do equipamento especificado no preâmbulo (${equipDesc}), incluindo o fornecimento integral de suprimentos de impressão, cartuchos de toner, tintas originais/homologadas, módulos de cilindro fotocondutor, unidades fusoras e películas térmicas necessários à operacionalização contínua da franquia mensal de ${data.franquiaPaginas.toLocaleString('pt-BR')} páginas acordada. Fica expressamente vedada à LOCATÁRIA a introdução de insumos não autorizados pela LOCADORA, sob pena de rescisão contratual motivada e aplicação de penalidades cabíveis.`,
    },
    {
      titulo:
        'CLÁUSULA SEGUNDA – DA OPERAÇÃO DE EQUIPAMENTOS DE JATO DE TINTA E CABEÇOTES PIEZOELÉTRICOS (SEÇÃO 17.2)',
      conteudo: `Nos contratos envolvendo equipamentos de tecnologia tanque de tinta (EcoTank/MegaTank), a LOCATÁRIA declara-se ciente de que a manutenção da fluidez do cabeçote de impressão demanda utilização periódica. Na hipótese de ociosidade contínua do equipamento superior a 15 (quinze) dias corridos, resultando em dessecação de micropiezos ou entupimento irreversível de bicos ejetores, os custos de substituição do cabeçote de impressão correrão integralmente por conta da LOCATÁRIA, eximindo a LOCADORA de cobertura sem ônus.`,
    },
    {
      titulo:
        'CLÁUSULA TERCEIRA – DA FRANQUIA, PÁGINAS EXCEDENTES E LEITURA DE MEDIDORES (SEÇÃO 17.3)',
      conteudo: `O valor mensal ajustado de ${formatBRL(data.valorMensal)} confere à LOCATÁRIA o direito de produzir a quantidade de ${data.franquiaPaginas.toLocaleString('pt-BR')} páginas contratada como franquia. A apuração do volume efetivamente produzido dar-se-á mensalmente por meio de leitura remota via software SNMP ou auditoria física do contador lógico do equipamento. As impressões que ultrapassarem a franquia mensal serão faturadas na fatura subsequente, aplicando-se sobre cada página excedente o valor de ${formatCPP(data.valorExcedentePagina)} (CPP de venda homologado na celebração deste contrato).`,
    },
    {
      titulo: 'CLÁUSULA QUARTA – DA LEITURA DO MEDIDOR / CONTADOR',
      conteudo: `A apuração do volume de impressões e eventuais excedentes dar-se-á mensalmente no 1º (primeiro) dia útil de cada mês civil, através de leitura física no equipamento ou envio de relatório de contador eletrônico fornecido pela LOCATÁRIA ou colhido pelos técnicos da LOCADORA. Na ausência de leitura oportuna por culpa da LOCATÁRIA, a fatura será emitida pela média dos últimos 3 (três) meses, com posterior ajuste e compensação no mês subsequente.`,
    },
    {
      titulo: 'CLÁUSULA QUINTA – DO VENCIMENTO E FORMA DE PAGAMENTO',
      conteudo: `O pagamento do valor mensal da locação acrescido de eventuais excedentes apurados vencerá impreterivelmente até o dia 10 (dez) do mês subsequente ao da prestação dos serviços, mediante emissão de boleto bancário, transferência bancária/PIX indicada pela LOCADORA ou quitação direta no escritório comercial da LOCADORA.`,
    },
    {
      titulo: 'CLÁUSULA SEXTA – DO PRAZO DE VIGÊNCIA E PRORROGAÇÃO',
      conteudo: `O presente contrato terá vigência de ${data.prazoMeses || 12} (doze) meses, contados a partir da data de entrega e instalação do equipamento. O contrato poderá ser prorrogado por períodos iguais e sucessivos de 12 (doze) meses mediante concordância expressa de ambas as partes ou ausência de notificação em contrário com antecedência mínima de 30 (trinta) dias do término da vigência.`,
    },
    {
      titulo: 'CLÁUSULA SÉTIMA – DO REAJUSTE ANUAL',
      conteudo: `Caso o contrato seja prorrogado, o valor mensal da locação e o valor unitário da página excedente serão reajustados anualmente pela variação acumulada positiva do IPCA/IBGE (Índice Nacional de Preços ao Consumidor Amplo) verificado nos últimos 12 (doze) meses, ou por índice oficial que vier a substituí-lo legalmente.`,
    },
    {
      titulo: 'CLÁUSULA OITAVA – DAS OBRIGAÇÕES DA LOCATÁRIA',
      conteudo: `São deveres da LOCATÁRIA: a) Utilizar papel de boa qualidade e armazenado adequadamente, livre de umidade ou dobras; b) Operar o equipamento conforme as instruções dos técnicos da LOCADORA; c) Não permitir intervenções, manutenção ou instalação de suprimentos por terceiros não autorizados pela LOCADORA; d) Responsabilizar-se pela guarda, integridade e conservação do equipamento nas dependências de sua sede; e) Fornecer rede elétrica estável com aterramento adequado.`,
    },
    {
      titulo: 'CLÁUSULA NONA – DAS OBRIGAÇÕES DA LOCADORA',
      conteudo: `São deveres da LOCADORA: a) Entregar o equipamento em perfeito estado de funcionamento e conservação; b) Realizar assistência técnica com prazo de atendimento de até 24 (vinte e quatro) horas úteis após o chamado; c) Substituir o equipamento por outro de capacidade técnica equivalente ou superior caso o conserto no local demande mais de 48 (quarenta e oito) horas; d) Fornecer peças e consumíveis originais ou compatíveis de 1ª linha.`,
    },
    {
      titulo: 'CLÁUSULA DÉCIMA – DA PROPRIEDADE DO EQUIPAMENTO',
      conteudo: `O(s) equipamento(s) locado(s) é(são) de propriedade exclusiva e inalienável da LOCADORA, não podendo ser objeto de penhora, arresto, caução, cessão ou sublocação pela LOCATÁRIA sob nenhuma hipótese.`,
    },
    {
      titulo: 'CLÁUSULA DÉCIMA PRIMEIRA – DA DEVOLUÇÃO',
      conteudo: `Ao término do contrato, por qualquer motivo, a LOCATÁRIA restituirá imediatamente o equipamento à LOCADORA em perfeito estado de conservação e funcionamento, ressalvado o desgaste natural decorrente do uso regular.`,
    },
    {
      titulo: 'CLÁUSULA DÉCIMA SEGUNDA – DA MORA, PENALIDADES E RESCISÃO',
      conteudo: `Em caso de inadimplemento no pagamento na data aprazada, incorrerá a LOCATÁRIA em multa moratória de 2% (dois por cento) sobre o débito em atraso, acrescida de juros de mora de 1% (um por cento) ao mês calculados pro rata die até o efetivo pagamento, além de correção monetária. O atraso superior a 30 (trinta) dias ensejará a rescisão unilateral do contrato pela LOCADORA com recolhimento imediato do equipamento. Em caso de rescisão imotivada e antecipada por qualquer das partes antes do término do prazo contratual, a parte infratora pagará à outra multa de quebra de 10% (dez por cento) sobre o valor total remanescente do contrato.`,
    },
    {
      titulo: 'CLÁUSULA DÉCIMA TERCEIRA – DO FORO DE ELEIÇÃO',
      conteudo: `Para dirimir quaisquer controvérsias oriundas do presente contrato de locação, as partes elegem o Foro da Comarca de Nova Andradina - MS, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
    },
  ]
}

// Versão independente: contratos anteriores continuam usando getContractClauses.
export const RENTAL_MODEL_VERSION = 'JUCA-LOC-2026-10-v2'
export const CONTRACT_DETAIL_FIELDS = [
  ['nome', 'Nome completo / razão social da locatária', 'text'],
  ['documento', 'CPF/CNPJ da locatária', 'text'],
  ['endereco', 'Endereço completo, cidade, UF e CEP', 'text'],
  ['contato', 'E-mail ou telefone para comunicações contratuais', 'text'],
  ['representante', 'Nome e CPF do signatário da locatária', 'text'],
  [
    'poderes',
    'Qualidade do signatário e documento de representação (ou pessoa física titular)',
    'text',
  ],
  ['representanteLocadora', 'Nome, CPF e qualidade do representante da JUCA', 'text'],
  ['serial', 'Número de série do equipamento', 'text'],
  ['contador', 'Contador inicial conferido (páginas)', 'number'],
  ['local', 'Endereço e setor de instalação', 'text'],
  ['valorBem', 'Valor de referência do equipamento (R$)', 'number'],
  ['dataValor', 'Data da avaliação do equipamento', 'date'],
  ['provaValor', 'Referência da nota fiscal / avaliação que fundamenta o valor', 'text'],
  ['estadoBem', 'Condição do equipamento e avarias preexistentes', 'text'],
  ['acessorios', 'Acessórios e respectivos identificadores', 'text'],
  [
    'fotos',
    'Identificação dos arquivos de fotos e relatório de contador que acompanharão o PDF',
    'text',
  ],
  ['supplies', 'Suprimentos e peças incluídos na locação', 'text'],
  [
    'exclusoes',
    'Itens excluídos e despesas de instalação / transporte (ou sem cobrança adicional)',
    'text',
  ],
  ['contagem', 'Contagem contratada: P&B/cor, tamanho de página, cópia e duplex', 'text'],
  ['slaAtendimento', 'Prazo máximo para início do atendimento (horas úteis)', 'number'],
  ['slaSubstituicao', 'Prazo máximo de indisponibilidade até substituição (horas úteis)', 'number'],
  ['expediente', 'Dias, horários, feriados e área geográfica de atendimento', 'text'],
  ['canal', 'Canal de abertura de chamado e comprovação do protocolo', 'text'],
  ['pagamento', 'Forma de pagamento combinada', 'text'],
] as const
export type ContractDetails = Record<string, string>

export function contractMissingDetails(d: ContractDetails): string[] {
  const missing = CONTRACT_DETAIL_FIELDS.filter(([key]) => !String(d[key] ?? '').trim()).map(
    ([, label]) => String(label),
  )
  if (d.nome && !/[A-Za-zÀ-ÿ]{2}/.test(d.nome))
    missing.push('Nome deve identificar uma pessoa ou empresa, não apenas um código')
  const doc = (d.documento || '').replace(/\D/g, '')
  if (d.documento && (![11, 14].includes(doc.length) || /^(\d)\1+$/.test(doc)))
    missing.push('Confira o CPF/CNPJ informado')
  for (const key of ['contador', 'valorBem', 'slaAtendimento', 'slaSubstituicao']) {
    if (
      d[key] &&
      (!Number.isFinite(Number(d[key])) ||
        Number(d[key]) < 0 ||
        (key !== 'contador' && Number(d[key]) === 0))
    )
      missing.push(`Valor inválido: ${CONTRACT_DETAIL_FIELDS.find((f) => f[0] === key)?.[1]}`)
  }
  if (d.contador && !Number.isInteger(Number(d.contador))) missing.push('Contador deve ser inteiro')
  return missing
}

export function buildContractSnapshot(
  data: ContractTemplateData,
  details: ContractDetails,
  adicionais = '',
) {
  const d = (key: string) => details[key]?.trim() || '[PREENCHER ANTES DE ASSINAR]'
  const monthly = formatBRL(data.valorMensal)
  const excess = formatCPP(data.valorExcedentePagina)
  const pages = data.franquiaPaginas.toLocaleString('pt-BR')
  const clauses = [
    [
      '1. OBJETO E DOCUMENTOS INTEGRANTES',
      `Locação de ${data.equipamento.nome}, série ${d('serial')}, com assistência técnica e suprimentos discriminados no Anexo III. Os Anexos I (identificação, entrega e devolução), II (evidências) e III (condições comerciais e atendimento) integram este instrumento e deverão acompanhar a mesma versão submetida às partes. Propostas anteriores só o integram quando expressamente identificadas. Condições especiais somente prevalecem se expressas, aceitas pelas partes e compatíveis com a legislação aplicável.`,
    ],
    [
      '2. FRANQUIA E EXCEDENTES',
      `A mensalidade é ${monthly} para a franquia de ${pages} páginas por mês civil. O valor por página excedente é ${excess}. A cobrança corresponde à mensalidade acrescida de máximo entre zero e (páginas apuradas menos franquia aplicável), multiplicado pela tarifa excedente. A franquia não utilizada não se acumula. A contagem adotada consta do Anexo III; a digitalização sem impressão não gera página faturável. Tarifas distintas por cor ou formato exigem tabela expressamente aceita antes do uso. A tarifa unitária é preservada com seis casas decimais e o total monetário é arredondado para centavos apenas ao final.`,
    ],
    [
      '3. LEITURAS E CONFERÊNCIA',
      'As leituras ocorrerão no primeiro dia útil de cada mês, com contador anterior e atual, data, série e foto ou relatório verificável. O volume é a diferença não negativa entre leituras válidas. Trocas de equipamento, reinicializações ou falhas de contador exigem termo com leituras de saída e entrada, sem cobrança duplicada. Na falta de leitura, a LOCADORA solicitará regularização. Eventual estimativa será identificada como provisória, fundamentada no histórico disponível e reconciliada após a leitura real, com crédito ou complemento demonstrado. Sem histórico confiável, não se presumirá excedente. A LOCATÁRIA poderá solicitar memória de cálculo e contestar divergências, preservados seus direitos legais.',
    ],
    [
      '4. PAGAMENTO E PERÍODOS PARCIAIS',
      `O vencimento será no dia 10 do mês seguinte ao período de utilização; se não houver expediente bancário, no próximo dia útil. Forma de pagamento: ${d('pagamento')}. No primeiro e último mês, mensalidade e franquia serão proporcionais aos dias de disponibilização no mês civil; a franquia proporcional será arredondada para cima em páginas inteiras. A fatura discriminará período, leituras, franquia, excedente, créditos e outros valores previamente autorizados. Alterações de dados bancários deverão ser confirmadas por canal oficial da LOCADORA.`,
    ],
    [
      '5. VIGÊNCIA E RENOVAÇÃO',
      `O prazo contratado é de ${data.prazoMeses} meses, conforme a simulação aprovada, contado da entrega e instalação efetivamente confirmadas no Anexo I. A data prevista indicada no quadro resumo não substitui o comprovante de entrega. Uma nova vigência por prazo determinado exige concordância expressa em aditivo. A continuidade da posse após o prazo, sem oposição da LOCADORA, observará a prorrogação legal por prazo indeterminado, sem nova fidelização automática. Nessa situação, qualquer parte poderá denunciar a locação mediante aviso de 30 dias, ressalvadas normas obrigatórias aplicáveis.`,
    ],
    [
      '6. REAJUSTE',
      'A mensalidade e a tarifa de excedente poderão ser reajustadas a cada 12 meses contados do início efetivo da locação, pela variação acumulada do IPCA/IBGE, inclusive durante contratos com prazo superior a um ano. O cálculo e a nova tabela serão comunicados previamente. Não haverá reajuste em periodicidade inferior à legal. Extinto o índice, será adotado o substituto legal ou, na sua ausência, outro índice oficial mediante acordo escrito.',
    ],
    [
      '7. MANUTENÇÃO E ATENDIMENTO',
      `A LOCADORA entregará o equipamento em condições de uso, manterá sua aptidão para a finalidade contratada e fornecerá os itens do Anexo III, ressalvados danos imputáveis à LOCATÁRIA devidamente comprovados. Início do atendimento em até ${d('slaAtendimento')} horas úteis e substituição por equipamento de capacidade equivalente ou superior quando a indisponibilidade atingir ${d('slaSubstituicao')} horas úteis, contadas do chamado documentado, conforme expediente e área do Anexo III. Acesso impedido pelo cliente será registrado e os prazos reprogramados pelo período do impedimento comprovado. Indisponibilidade não imputável à LOCATÁRIA será tratada mediante solução, substituição e abatimento proporcional cabível, sem exclusão genérica de responsabilidade ou de direitos legais.`,
    ],
    [
      '8. GUARDA E USO DO EQUIPAMENTO',
      'A LOCATÁRIA deverá observar as instruções do fabricante e de instalação, usar papel e alimentação elétrica adequados, manter o bem no local contratado e comunicar falhas prontamente. Mudança de local, cessão, sublocação e intervenção de terceiros dependem de autorização escrita da LOCADORA. Em equipamentos a jato de tinta, orientações de uso periódico e conservação deverão ser entregues e registradas. O simples decurso de um número fixo de dias sem uso não presume mau uso nem transfere automaticamente o custo do cabeçote. A responsabilidade por dano exige evidências da causa e do nexo com a conduta atribuída ao responsável.',
    ],
    [
      '9. PROPRIEDADE E IDENTIFICAÇÃO',
      'O equipamento permanece de propriedade da LOCADORA; a locação não transfere domínio nem confere opção automática de compra. A LOCATÁRIA não poderá oferecê-lo em garantia e deverá conservar etiquetas e números de série. Qualquer apreensão, penhora ou pretensão de terceiro deverá ser comunicada imediatamente à LOCADORA, com apresentação do contrato e das evidências de propriedade, sem pretender afastar decisões judiciais por disposição contratual. A troca de máquina exige termo com identificação completa e atualização das evidências.',
    ],
    [
      '10. DANOS, PERDA E VALOR DE REFERÊNCIA',
      `O valor de referência do bem está discriminado no Anexo I, com data e documento de suporte. Esse valor não equivale a preço de compra obrigatório, confissão de dívida ou indenização automática. Dano, perda ou não devolução serão apurados conforme responsabilidade comprovada e legislação aplicável, considerando estado anterior, desgaste normal, depreciação, valor de bem equivalente e custo razoável de reparo, sem enriquecimento indevido. Valores recuperados, salvados e indenizações de seguro referentes ao mesmo prejuízo serão abatidos. Furto, roubo e caso fortuito serão analisados segundo as circunstâncias e responsabilidades legais, sem presunção automática de culpa.`,
    ],
    [
      '11. DEVOLUÇÃO',
      'Encerrada a locação, as partes agendarão a retirada ou devolução em até cinco dias úteis, mediante termo com série, acessórios, estado, leituras e ressalvas. A LOCATÁRIA disponibilizará acesso e restituirá o bem, ressalvado desgaste normal. Custos de transporte constam do Anexo III; danos e despesas extraordinárias exigem demonstração. A demora atribuível à LOCADORA, estando o bem disponibilizado, não gera aluguel adicional. A retenção injustificada após notificação sujeita-se às medidas legais e valores proporcionais cabíveis, sem autorização de ingresso forçado ou retirada coercitiva extrajudicial.',
    ],
    [
      '12. ATRASO E RESCISÃO',
      'No atraso de pagamento incidirão multa de 2% sobre o débito, juros simples de 1% ao mês, calculados por dia de atraso à razão de 1/30 da taxa mensal, e atualização monetária pelo IPCA, observada a legislação aplicável. Atraso superior a 30 dias ou infração relevante poderá motivar rescisão após notificação comprovável e prazo de dez dias para regularização, quando sanável. Na rescisão antecipada sem justa causa durante o prazo determinado, a parte que a provocar pagará à outra multa de 10% das mensalidades básicas vincendas, proporcional ao tempo restante, excluídos excedentes futuros não realizados. Não haverá multa pela rescisão justificada por descumprimento da outra parte nem nova multa de fidelização em prazo indeterminado. Vedada duplicidade indenizatória pelo mesmo fato, preservadas redução legal de penalidade excessiva e normas de proteção ao consumidor.',
    ],
    [
      '13. DADOS E COMUNICAÇÕES',
      `Os dados serão tratados para execução contratual, faturamento, assistência e exercício regular de direitos, limitados ao necessário e protegidos contra acesso indevido. Monitoramento autorizado de contadores e suprimentos não autoriza coleta do conteúdo impresso ou digitalizado. Acesso à rede e suporte remoto dependerão de autorização e registro. Na devolução, as partes combinarão a remoção segura de documentos e credenciais armazenados, sem eliminação de registros legalmente necessários. Comunicações contratuais utilizarão os contatos indicados pelas partes; notificações relevantes exigem comprovação de entrega. Contato da LOCADORA: ${RENTAL_LOCADORA_FIXA.telefone}.`,
    ],
    [
      '14. ASSINATURA ELETRÔNICA E CONSERVAÇÃO',
      'As partes admitem a assinatura eletrônica com comprovação de autoria e integridade, inclusive mediante certificado ICP-Brasil ou outro meio admitido nos termos do art. 10, § 2º, da MP 2.200-2/2001. O provedor deverá vincular cada assinatura ao documento e anexos, identificar os signatários e conservar evidências de autenticação, datas e integridade. O link de acesso, isoladamente, não constitui assinatura. O arquivo eletrônico assinado e o relatório de evidências deverão ser disponibilizados às partes e guardados em sua forma original, com controle de acesso e cópia de segurança. Alterações posteriores exigem novo documento ou aditivo assinado. A dispensa de testemunhas para a hipótese do art. 784, § 4º, do CPC depende de integridade conferida por provedor de assinatura e dos demais requisitos legais; na dúvida, colher também duas testemunhas.',
    ],
    [
      '15. SOLUÇÃO DE DIVERGÊNCIAS',
      'As partes buscarão solução documentada das divergências. Fica eleito o foro de Nova Andradina/MS, local da sede da LOCADORA, quando admitido pela legislação, sem prejuízo das competências obrigatórias e do foro protetivo assegurado ao consumidor. Nenhuma cláusula afasta direitos indisponíveis. Os representantes declaram possuir poderes para a contratação, demonstrados nos documentos identificados neste instrumento.',
    ],
  ].map(([titulo, conteudo]) => ({ titulo, conteudo }))
  return {
    version: RENTAL_MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    locadora: { ...RENTAL_LOCADORA_FIXA },
    data: JSON.parse(JSON.stringify(data)) as ContractTemplateData,
    details: { ...details },
    adicionais,
    clauses,
    annexes: [
      {
        titulo: 'ANEXO I — IDENTIFICAÇÃO, ENTREGA E DEVOLUÇÃO',
        conteudo: `Equipamento: ${data.equipamento.nome}. Série: ${d('serial')}. Local de instalação: ${d('local')}. Contador conferido: ${d('contador')} páginas. Estado e ressalvas: ${d('estadoBem')}. Acessórios: ${d('acessorios')}. Valor de referência: ${details.valorBem ? formatBRL(Number(details.valorBem)) : '[PREENCHER]'}, avaliado em ${d('dataValor')}, conforme ${d('provaValor')}. O valor se submete à cláusula 10.\nTERMO A SER CONFIRMADO NA ENTREGA: data/hora: __________________; nome e documento do recebedor autorizado: __________________; conferência da série, acessórios, teste de funcionamento e orientações recebidas: __________________; ressalvas: __________________; assinaturas de entrega e recebimento: __________________. Este modelo não comprova entrega antes da confirmação efetiva.\nTERMO DE DEVOLUÇÃO / TROCA: data/hora: __________________; série de saída/entrada: __________________; contadores: __________________; estado, acessórios e ressalvas: __________________; responsáveis e assinaturas: __________________.`,
      },
      {
        titulo: 'ANEXO II — EVIDÊNCIAS E REPRESENTAÇÃO',
        conteudo: `Arquivos de fotos (visão geral, etiqueta de série, acessórios e avarias) e leitura: ${d('fotos')}. Documento de propriedade / avaliação: ${d('provaValor')}. Signatário da LOCATÁRIA: ${d('representante')}; poderes: ${d('poderes')}. Representante da LOCADORA: ${d('representanteLocadora')}. Os arquivos identificados deverão acompanhar o contrato submetido à assinatura. Esta relação não comprova que os arquivos já foram anexados. Manter cópias de documentos de representação e propriedade no dossiê restrito; fornecer apenas dados necessários às partes.`,
      },
      {
        titulo: 'ANEXO III — CONDIÇÕES COMERCIAIS E ATENDIMENTO',
        conteudo: `Mensalidade: ${monthly}. Franquia: ${pages} páginas/mês, sem acumulação. Excedente: ${excess}/página. Prazo: ${data.prazoMeses} meses. Data prevista de início: ${data.dataInicio.slice(0, 10)}; prevalece entrega confirmada. Vencimento: dia 10 do mês seguinte. Pagamento: ${d('pagamento')}. Contagem: ${d('contagem')}. Incluídos: ${d('supplies')}. Exclusões, instalação e transporte: ${d('exclusoes')}. Atendimento: ${d('slaAtendimento')} horas úteis; substituição: ${d('slaSubstituicao')} horas úteis de indisponibilidade. Expediente e cobertura: ${d('expediente')}. Chamados: ${d('canal')}. Contato da LOCATÁRIA: ${d('contato')}. Os prazos e itens deverão ser conferidos pelas partes antes da assinatura.`,
      },
    ],
  }
}
export type RentalContractSnapshot = ReturnType<typeof buildContractSnapshot>

// A proposta mantém as condições negociadas; cadastro complementa dados ausentes.
export function inheritRentalContractDetails(
  quote: import('@/types').RentalQuote,
  machine: import('@/types').RentalMachineCalculation,
): ContractDetails {
  const c = quote.expand?.cliente_id
  const linkedMachine = machine.machineId
    ? quote.expand?.maquinas?.find((m) => m.id === machine.machineId)
    : undefined
  const meaningfulName = (s?: string) => (s && /[A-Za-zÀ-ÿ]{2}/.test(s.trim()) ? s.trim() : '')
  const name =
    meaningfulName(quote.cliente_nome_livre) ||
    meaningfulName(c?.razao_social) ||
    meaningfulName(c?.name) ||
    meaningfulName(c?.nome_fantasia) ||
    ''
  let address =
    quote.cliente_endereco?.trim() ||
    c?.endereco?.trim() ||
    [c?.street, c?.number].filter(Boolean).join(', ')
  for (const part of [c?.bairro, c?.city, c?.state, c?.zip]) {
    if (part && !address.toLocaleLowerCase().includes(part.toLocaleLowerCase()))
      address += (address ? ', ' : '') + part
  }
  const counter = machine.contador_inicial ?? linkedMachine?.contador_inicial
  const supplies = machine.supplies?.length ? machine.supplies : linkedMachine?.supplies || []
  const pricing = (
    quote.resultados as typeof quote.resultados & {
      pricingSnapshot?: { impressora?: { id?: string; valor_compra?: number } }
    }
  )?.pricingSnapshot?.impressora
  const price =
    pricing?.id && pricing.id === machine.machineId ? pricing.valor_compra : machine.valorCompra
  return {
    nome: name,
    documento: quote.cliente_documento || c?.cpf_cnpj || '',
    endereco: address,
    contato: [quote.cliente_telefone || c?.celular || c?.phone, c?.email]
      .filter(Boolean)
      .join(' / '),
    local: address,
    serial: machine.serial || linkedMachine?.serial || '',
    contador: counter == null ? '' : String(counter),
    valorBem: price && price > 0 ? String(price) : '',
    provaValor:
      price && price > 0
        ? `Valor do equipamento na precificação da proposta ${quote.id}, preservado nesta negociação.`
        : '',
    dataValor:
      price && price > 0 && quote.created
        ? new Date(quote.created).toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' })
        : '',
    supplies: supplies
      .map((s) => s.nome)
      .filter(Boolean)
      .join('; '),
    modalidade: 'impressa',
  }
}
