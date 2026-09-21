import { COMPANY_DATA } from '@/lib/company'

/**
 * Modelo de Cláusulas Contratuais da JUCA INFORMÁTICA para Locação de Equipamentos
 * de Impressão e Assistência Técnica.
 *
 * Conforme instrução:
 * "NÃO alterar o texto das cláusulas — apenas preencher os dados variáveis:
 * LOCADORA fixa (JUCA CARTUCHOS E INFORMÁTICA LTDA, CNPJ 10.612.947/0001-07, I.E. 28.350.859-0,
 * Rua Vearni Castro 1515, Centro, Nova Andradina-MS, fone (67) 3441-4981);
 * LOCATÁRIO (nome/razão, CNPJ/CPF, endereço, telefone do cliente);
 * Cláusula Primeira (equipamento marca/modelo, série/serial, contador inicial, volume mensal da franquia);
 * Cláusula Terceira (valor mensal, franquia, valor da página excedente);
 * Cláusula Décima Segunda (multa 2% + juros 1% a.m. e multa de quebra de 10% sobre o valor do contrato — texto fixo);
 * demais cláusulas idênticas ao modelo (prazo 12 meses, vencimento dia 10, leitura do medidor dia 1º, devolução,
 * foro de Nova Andradina-MS, reajuste IPCA/IBGE na prorrogação)."
 */

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
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
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
