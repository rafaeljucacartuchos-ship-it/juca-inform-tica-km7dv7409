routerAdd('POST', '/backend/v1/rental-commercial', (e) => {
  'use strict'
  /**
   * JUCA — motor candidato para a regra aprovada da planilha.
   * Base mensal = (referência do equipamento + Printway mensal × contrato) / payback.
   * CPP direto = soma dos suprimentos incluídos com preço e rendimento válidos.
   * CPP de venda = CPP direto × markup; a reserva coletiva é adicionada pela tela uma vez.
   * Prazo contratual, payback e vida útil são parâmetros distintos.
   * Valores internos preservam precisão; CPP comercial usa seis casas e moeda duas.
   * Funções legadas permanecem para seus consumidores; não representam a regra nova.
   */
  /** Arredonda número para N casas decimais */
  function roundTo(val, decimals) {
    if (isNaN(val) || !isFinite(val)) return 0
    const factor = Math.pow(10, decimals)
    return Math.round((val + Number.EPSILON) * factor) / factor
  }
  /** Formata CPP com 6 casas decimais */
  function formatCPP6(val) {
    const num = Number(val) || 0
    return (
      'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
    )
  }
  /** Formata BRL moeda (2 casas decimais) */
  function formatBRL2(val) {
    const num = Number(val) || 0
    return num.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  /**
   * 3.1 Custo por Página Individual do Suprimento
   * CPP_suprimento = valor_compra / rendimento_paginas
   */
  function calculateSupplyCPP(valorCompra, rendimentoPaginas) {
    if (
      valorCompra === null ||
      valorCompra === undefined ||
      rendimentoPaginas === null ||
      rendimentoPaginas === undefined ||
      rendimentoPaginas <= 0 ||
      valorCompra <= 0
    ) {
      return 0.0
    }
    return valorCompra / rendimentoPaginas
  }
  /**
   * 3.3 Depreciação Diluída do Equipamento
   * CPP_equipamento = valor_impressora / (vida_util_meses * producao_mensal_estimada)
   */
  function calculateEquipmentDepreciationCPP(
    valorImpressora,
    vidaUtilMeses,
    producaoMensalEstimada,
  ) {
    const meses = vidaUtilMeses && vidaUtilMeses > 0 ? vidaUtilMeses : 48
    const producao =
      producaoMensalEstimada && producaoMensalEstimada > 0 ? producaoMensalEstimada : 0
    const totalPaginasVida = meses * producao
    if (!valorImpressora || valorImpressora <= 0 || totalPaginasVida <= 0) {
      return 0.0
    }
    return valorImpressora / totalPaginasVida
  }
  /**
   * Classifica o status visual de um slot conforme Seção 15.3 da especificação
   */
  function classifySlotStatus(slot) {
    if (!slot || !slot.modelo || slot.modelo.trim() === '' || slot.modelo === 'N/A') {
      return {
        status: 'empty',
        message: 'Não Aplicável / Vazio (CPP = R$ 0,000000)',
        isProvision: false,
        integrated: false,
      }
    }
    const modelUpper = slot.modelo.toUpperCase().trim()
    // Slot Integrado ao Chassi (Brother compactas: HL-1200, HL-1210W, etc.)
    if (modelUpper === 'INTEGRADO' || slot.integratedToChassis) {
      return {
        status: 'integrated',
        message: 'Fusor Integrado (Amortização no Ativo)',
        isProvision: false,
        integrated: true,
      }
    }
    // Cabeçote Epson: Provisão de Reparo / Risco de Inatividade
    const isEpsonProvision =
      modelUpper.includes('FA04061') ||
      modelUpper.includes('CAB-FA04061') ||
      slot.isProvision ||
      (slot.tipo === 'cabecote' && slot.fabricante?.toLowerCase() === 'epson')
    const hasPrice =
      slot.valorCompra !== null &&
      slot.valorCompra !== undefined &&
      !isNaN(Number(slot.valorCompra)) &&
      Number(slot.valorCompra) > 0
    const hasYield =
      slot.rendimentoPaginas !== null &&
      slot.rendimentoPaginas !== undefined &&
      !isNaN(Number(slot.rendimentoPaginas)) &&
      Number(slot.rendimentoPaginas) > 0
    if (!hasPrice || !hasYield) {
      return {
        status: 'missing_price',
        message: 'Insumo sem preço ou rendimento homologado (Preencher manualmente)',
        isProvision: isEpsonProvision,
        integrated: false,
      }
    }
    if (isEpsonProvision) {
      return {
        status: 'provision_risk',
        message:
          'Provisão de Reparo / Risco de Inatividade (baixos volumes elevam taxa de sinistro por ressecamento de micropiezos)',
        isProvision: true,
        integrated: false,
      }
    }
    return {
      status: 'complete',
      message: 'Ativo com dados completos',
      isProvision: false,
      integrated: false,
    }
  }
  /**
   * MOTOR DE PRECIFICAÇÃO PRINCIPAL (Calcula todos os indicadores em tempo real < 100ms)
   */
  function calculatePricing(input) {
    const errors = []
    const warnings = []
    const producao = input.producaoMensalEstimada
    const vidaUtil = input.vidaUtilMeses && input.vidaUtilMeses > 0 ? input.vidaUtilMeses : 48
    const markUp =
      input.markUpRevenda !== undefined && input.markUpRevenda !== null ? input.markUpRevenda : 1.45
    const valorCompra =
      input.valorCompra !== undefined && input.valorCompra !== null ? Number(input.valorCompra) : 0
    const isThermalOrMatrix = input.tecnologia === 'termica' || input.tecnologia === 'matricial'
    // VALIDAÇÕES DA MATRIZ DE ERROS (Seção 18)
    if (input.bloqueada) {
      errors.push(
        input.motivoBloqueio ||
          'Insumo essencial não homologado para este modelo. Cadastre o suprimento para prosseguir.',
      )
    }
    if (producao <= 0) {
      errors.push('Informe um volume mensal de páginas válido (mínimo: 1 página/mês).')
    }
    if (markUp < 1.0) {
      errors.push(
        'O fator de mark-up comercial não pode ser inferior a 1,00 (margem nula ou negativa).',
      )
    }
    if (!isThermalOrMatrix && (valorCompra <= 0 || isNaN(valorCompra))) {
      errors.push(
        'O equipamento selecionado requer preenchimento do valor de aquisição na base patrimonial.',
      )
    }
    // Determina se um tipo de suprimento é de desgaste estrutural
    const checkIsStructural = (tipo, modelo) => {
      const t = tipo.toLowerCase().trim()
      const m = modelo.toLowerCase().trim()
      return (
        t === 'fotocondutor' ||
        t === 'unidade_fusora' ||
        t === 'pelicula' ||
        t === 'cabecote' ||
        t.includes('fusor') ||
        t.includes('cilindro') ||
        t.includes('drum') ||
        m.includes('drum') ||
        m.includes('fusor') ||
        m.includes('fotocondutor') ||
        m.includes('cabeçote') ||
        m.includes('cabecote')
      )
    }
    // Verifica se a impressora tem pelo menos um suprimento cadastrado/vinculado (não-vazio)
    const hasAnyConfiguredSupply = input.supplies.some(
      (s) => s && s.modelo && s.modelo.trim() !== '' && s.modelo !== 'N/A',
    )
    if (!hasAnyConfiguredSupply && !isThermalOrMatrix) {
      errors.push('Sem suprimentos cadastrados — precificação incompleta')
    }
    // Processa todos os itens; preserva as cinco posições mínimas do formato legado.
    const enrichedSlots = []
    let sumSuppliesCpp = 0.0
    let hasMissingEssentialSupply = false
    for (let i = 1; i <= Math.max(5, input.supplies.length); i++) {
      const rawSlot = input.supplies[i - 1]
      const classified = classifySlotStatus(rawSlot)
      const isSlotIncluded = rawSlot?.included !== false
      const isStructural = rawSlot ? checkIsStructural(rawSlot.tipo, rawSlot.modelo) : false
      let cppSlot = 0.0
      if (rawSlot && classified.status !== 'empty' && classified.status !== 'integrated') {
        if (classified.status === 'missing_price') {
          // Suprimento sem preço ou rendimento bloqueia
          hasMissingEssentialSupply = true
        } else {
          cppSlot = calculateSupplyCPP(rawSlot.valorCompra, rawSlot.rendimentoPaginas)
          if (isSlotIncluded) {
            sumSuppliesCpp += cppSlot
          }
        }
      }
      if (classified.status === 'provision_risk' && isSlotIncluded) {
        warnings.push(
          'Atenção: Cabeçote Piezoelétrico provisionado como risco operacional. Baixos volumes de impressão elevam taxa de sinistro.',
        )
      }
      let structuralWarning = undefined
      if (
        rawSlot &&
        classified.status !== 'empty' &&
        classified.status !== 'integrated' &&
        !isSlotIncluded &&
        isStructural
      ) {
        structuralWarning =
          'Item de manutenção estrutural desmarcado — o custo desta peça ficará sob sua responsabilidade'
      }
      enrichedSlots.push({
        slotNumber: i,
        supplyId: rawSlot?.supplyId || null,
        modelo: rawSlot?.modelo || '',
        tipo: rawSlot?.tipo || '',
        fabricante: rawSlot?.fabricante || '',
        valorCompra: rawSlot?.valorCompra ?? null,
        rendimentoPaginas: rawSlot?.rendimentoPaginas ?? null,
        cppCalculado: cppSlot,
        visualStatus: classified.status,
        statusMessage: classified.message,
        isProvision: classified.isProvision,
        riskWarning: classified.isProvision
          ? 'baixos volumes elevam taxa de sinistro por ressecamento de micropiezos'
          : undefined,
        integratedToChassis: classified.integrated,
        included: isSlotIncluded,
        isStructural,
        structuralWarning,
      })
    }
    if (hasMissingEssentialSupply && !isThermalOrMatrix) {
      errors.push(
        'Insumo essencial não homologado para este modelo. Cadastre o suprimento para prosseguir.',
      )
    }
    // Se térmico ou matricial, regra 4.4: proposta fica fora do cálculo tradicional por página
    if (isThermalOrMatrix) {
      warnings.push(
        'Equipamento térmico/matricial: proposta faturada por mensalidade fixa + consumo unitário de bobina/fita/ribbon.',
      )
    }
    // CÁLCULOS PRINCIPAIS
    // CPP_equipamento = valor_impressora / (vida_util_meses * producao_mensal_estimada)
    const cppEquipamento = isThermalOrMatrix
      ? 0.0
      : calculateEquipmentDepreciationCPP(valorCompra, vidaUtil, producao)
    // Custo do software Printway (mensal em R$ diluído pela produção mensal)
    // Regra do usuário: entra na composição do custo mensal antes da aplicação do mark-up,
    // exatamente como a depreciação hoje: CPP_suprimentos + depreciação + Printway → CPP_fornecedor_total → CPP_venda (com mark-up)
    const valorPrintway =
      input.valorSoftwarePrintway !== undefined &&
      input.valorSoftwarePrintway !== null &&
      !isNaN(Number(input.valorSoftwarePrintway)) &&
      Number(input.valorSoftwarePrintway) > 0
        ? Number(input.valorSoftwarePrintway)
        : 0.0
    const cppSoftwarePrintway = producao > 0 ? valorPrintway / producao : 0.0
    // CPP_fornecedor_total = CPP_suprimentos + CPP_equipamento + CPP_software_printway
    const cppFornecedorTotal = sumSuppliesCpp + cppEquipamento + cppSoftwarePrintway
    // CPP_venda = CPP_fornecedor_total * mark_up_revenda
    // Regra crítica: mark-up incide ao FINAL sobre a soma integral de suprimentos + equipamento + printway
    const cppVenda = cppFornecedorTotal * markUp
    // custo_mensal = producao_mensal * CPP_venda
    const custoMensalProducao = producao * cppVenda
    // Faturamento total mensal = locação base (se informada) + custo mensal de páginas
    const locacaoBase =
      input.locacaoMensalProposta && input.locacaoMensalProposta > 0
        ? input.locacaoMensalProposta
        : 0
    const faturamentoTotalMensal = locacaoBase + custoMensalProducao
    const valid = errors.length === 0
    return {
      valid,
      errors,
      warnings,
      isThermalOrMatrix,
      cppSuprimentos: sumSuppliesCpp,
      cppEquipamento,
      cppSoftwarePrintway,
      valorSoftwarePrintway: valorPrintway,
      cppFornecedorTotal,
      markUpAplicado: markUp,
      cppVenda,
      custoMensalProducao,
      faturamentoTotalMensal,
      slotsEnriquecidos: enrichedSlots,
      formatted: {
        cppSuprimentos: formatCPP6(sumSuppliesCpp),
        cppEquipamento: formatCPP6(cppEquipamento),
        cppSoftwarePrintway: formatCPP6(cppSoftwarePrintway),
        valorSoftwarePrintway: formatBRL2(valorPrintway),
        cppFornecedorTotal: formatCPP6(cppFornecedorTotal),
        cppVenda: formatCPP6(cppVenda),
        custoMensalProducao: formatBRL2(custoMensalProducao),
        faturamentoTotalMensal: formatBRL2(faturamentoTotalMensal),
      },
    }
  }
  /**
   * 3.6 Análise de Ponto de Equilíbrio (Break-Even) entre Cenários
   * paginas_break_even = (locacao_B - locacao_A) / |CPP_venda_A - CPP_venda_B|
   */
  function calculateBreakEven(cenarioA, cenarioB, volumeAtual = 0) {
    const values = [
      cenarioA.locacaoMensal,
      cenarioB.locacaoMensal,
      cenarioA.cppVenda,
      cenarioB.cppVenda,
      volumeAtual,
    ]
    if (!values.every((v) => Number.isFinite(v) && v >= 0))
      return {
        valid: false,
        diferencaLocacao: 0,
        diferencaCPP: 0,
        paginasBreakEven: null,
        recomendacao: 'Informe custos e volume válidos para comparar.',
        error: 'ERR_INVALID_SCENARIO',
        cenarioMaisEconomicoParaVolume: 'equivalente',
      }
    const fixo = cenarioB.locacaoMensal - cenarioA.locacaoMensal
    const cpp = cenarioA.cppVenda - cenarioB.cppVenda
    const custoA = cenarioA.locacaoMensal + cenarioA.cppVenda * volumeAtual
    const custoB = cenarioB.locacaoMensal + cenarioB.cppVenda * volumeAtual
    const melhor = Math.abs(custoA - custoB) < 1e-8 ? 'equivalente' : custoA < custoB ? 'A' : 'B'
    const common = {
      diferencaLocacao: roundTo(Math.abs(fixo), 2),
      diferencaCPP: roundTo(Math.abs(cpp), 6),
      cenarioMaisEconomicoParaVolume: melhor,
    }
    if (Math.abs(cpp) < 1e-12)
      return {
        ...common,
        valid: false,
        paginasBreakEven: null,
        error: 'ERR_IDENTICAL_CPP',
        recomendacao:
          Math.abs(fixo) < 1e-8
            ? 'Os cenários são equivalentes em qualquer volume.'
            : 'Não há cruzamento: com CPPs iguais, o menor valor fixo é sempre mais econômico.',
      }
    const paginas = fixo / cpp
    if (paginas < 0)
      return {
        ...common,
        valid: false,
        paginasBreakEven: null,
        error: 'ERR_NO_POSITIVE_INTERSECTION',
        recomendacao:
          'Não há ponto de equilíbrio positivo: o cenário ' +
          melhor +
          ' tem menor custo fixo e por página.',
      }
    const menorCpp = cpp < 0 ? 'A' : 'B'
    return {
      ...common,
      valid: true,
      paginasBreakEven: paginas,
      recomendacao:
        paginas === 0
          ? 'Os valores fixos são iguais. Para qualquer volume positivo, o cenário ' +
            menorCpp +
            ' é mais econômico.'
          : 'Os custos se igualam em ' +
            paginas.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) +
            ' páginas/mês. Acima desse volume, o cenário ' +
            menorCpp +
            ' é mais econômico.',
    }
  }
  /** Regra aprovada da planilha; mantém o motor legado para outros consumidores. */
  function calculateRentalBase(compra, printway, contrato, payback) {
    if (
      ![compra, printway, contrato, payback].every(Number.isFinite) ||
      compra <= 0 ||
      printway < 0 ||
      contrato <= 0 ||
      payback <= 0 ||
      !Number.isInteger(contrato) ||
      !Number.isInteger(payback)
    )
      return null
    return (compra + printway * contrato) / payback
  }
  function calculateSpreadsheetPricing(input) {
    const result = calculatePricing(input)
    // A proposta por página exige o consumível de impressão, além das peças de manutenção.
    const tipos = input.tecnologia === 'tinta' ? ['tinta', 'cartucho'] : ['toner']
    const essenciais = input.supplies.filter((s) => s && tipos.includes(s.tipo))
    if (result.isThermalOrMatrix) {
      result.errors.push(
        'Térmica/matricial exige precificação por unidade de bobina, fita ou ribbon. Este simulador por página não pode emitir essa proposta.',
      )
    } else if (!essenciais.length || essenciais.some((s) => s?.included === false)) {
      result.errors.push(
        'Cadastre e inclua o toner, tinta ou cartucho de impressão antes de gerar a proposta. Fusor e película não substituem esse consumível.',
      )
    }
    for (const s of input.supplies) {
      if (
        !s ||
        (!s.supplyId && !s.modelo) ||
        s.integratedToChassis ||
        s.modelo.trim().toUpperCase() === 'INTEGRADO'
      )
        continue
      if (
        ![s.valorCompra, s.rendimentoPaginas].every(
          (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
        )
      ) {
        result.errors.push(
          'Preço e rendimento devem ser positivos e finitos: ' +
            (s.modelo || 'suprimento sem identificação') +
            '.',
        )
      }
    }
    const modelo = input.modelo.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const refs = input.supplies.map((s) =>
      (s?.modelo || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    )
    if (
      ['M130FW', 'M130NW', 'LASERJETPROMFPM130FW', 'LASERJETPROMFPM130NW'].includes(modelo) &&
      refs.some((r) => r.includes('CF248A'))
    ) {
      result.errors.push(
        'Referência incompatível: HP M130 utiliza CF217A/17A. Corrija o vínculo e confirme o preço do cartucho correto.',
      )
    }
    if (['MFCJ1010DW', 'MFCJ1170DW'].includes(modelo) && refs.some((r) => /LC10[59]/.test(r))) {
      result.errors.push(
        'Referência incompatível: este modelo Brother utiliza LC401/LC401XL. Corrija os vínculos e confirme os custos.',
      )
    }
    // Custos obrigatórios por modelo confirmado. Referências regionais não homologadas
    // continuam dependendo do bloqueio do cadastro; isto não é um catálogo completo.
    // HP M130: manual c05208327; Brother: folhetos DCP-L5652DN/L5662DN/HL-L6412DW.
    const cilindrosObrigatorios = {
      M130FW: 'CF219A',
      M130NW: 'CF219A',
      LASERJETPROMFPM130FW: 'CF219A',
      LASERJETPROMFPM130NW: 'CF219A',
      DCPL5652DN: 'DR3440',
      DCPL5662DN: 'DR3602',
      HLL6412DW: 'DR3602',
      COLORLASERJETM177FW: 'CE314A',
      M177FW: 'CE314A',
      CP1025NW: 'CE314A',
      SLM3375FD: 'MLTR204',
    }
    const coresObrigatorias = {
      COLORLASERJETM177FW: ['CF350A', 'CF351A', 'CF352A', 'CF353A'],
      M177FW: ['CF350A', 'CF351A', 'CF352A', 'CF353A'],
      CP1025NW: ['CE310A', 'CE311A', 'CE312A', 'CE313A'],
    }
    for (const codigo of coresObrigatorias[modelo] || []) {
      const incluido = input.supplies.some(
        (s) =>
          s &&
          s.included !== false &&
          s.tipo === 'toner' &&
          new RegExp(codigo + '(?![0-9])').test(s.modelo.toUpperCase().replace(/[^A-Z0-9]/g, '')),
      )
      if (!incluido)
        result.errors.push(
          'Inclua o toner obrigatório ' + codigo + ' com custo e rendimento confirmados.',
        )
    }
    const cilindroObrigatorio = cilindrosObrigatorios[modelo]
    if (cilindroObrigatorio) {
      const cilindroIncluido = input.supplies.some((s) => {
        if (!s || s.included === false || s.tipo !== 'fotocondutor') return false
        const ref = s.modelo.toUpperCase().replace(/[^A-Z0-9]/g, '')
        return new RegExp(cilindroObrigatorio + '(?![0-9])').test(ref)
      })
      if (!cilindroIncluido)
        result.errors.push(
          'Inclua o cilindro obrigatório ' +
            cilindroObrigatorio +
            ' com identificação, preço e rendimento confirmados antes de gerar a proposta.',
        )
    }
    const compra = Number(input.valorCompra)
    const printwayInformado =
      typeof input.valorSoftwarePrintway === 'number' &&
      Number.isFinite(input.valorSoftwarePrintway) &&
      input.valorSoftwarePrintway >= 0
    if (!printwayInformado)
      result.errors.push(
        'Informe o custo do Printway; use zero somente quando não houver cobrança confirmada.',
      )
    const printway = printwayInformado ? input.valorSoftwarePrintway : Number.NaN
    const base = calculateRentalBase(compra, printway, input.contratoMeses, input.paybackMeses)
    if (base === null)
      result.errors.push(
        'Informe compra, Printway, prazo contratual e payback válidos. Payback é separado da vida útil.',
      )
    if (
      !Number.isFinite(input.producaoMensalEstimada) ||
      !Number.isInteger(input.producaoMensalEstimada)
    )
      result.errors.push('Informe um volume inteiro de páginas válido.')
    if (!Number.isFinite(result.markUpAplicado))
      result.errors.push('Informe um fator de mark-up válido.')
    const cppVenda = result.cppSuprimentos * result.markUpAplicado
    const paginas = input.producaoMensalEstimada * cppVenda
    const total = (base ?? 0) + paginas
    return {
      ...result,
      valid: result.errors.length === 0,
      cppEquipamento: 0,
      cppSoftwarePrintway: 0,
      cppFornecedorTotal: result.cppSuprimentos,
      cppVenda,
      custoMensalProducao: paginas,
      faturamentoTotalMensal: total,
      formatted: {
        ...result.formatted,
        cppEquipamento: formatCPP6(0),
        cppSoftwarePrintway: formatCPP6(0),
        cppFornecedorTotal: formatCPP6(result.cppSuprimentos),
        cppVenda: formatCPP6(cppVenda),
        custoMensalProducao: formatBRL2(paginas),
        faturamentoTotalMensal: formatBRL2(total),
      },
    }
  }

  e.response.header().set('Cache-Control', 'no-store')
  const info = e.requestInfo()
  const auth = e.auth || info.auth
  const actor = auth && typeof auth.getString === 'function' ? auth : auth && auth.record
  function json(value) {
    return typeof value === 'string' ? JSON.parse(value) : value
  }
  if (!actor || !actor.id) return e.json(403, { error: 'Entre com uma conta autorizada.' })
  const role = actor.getString('role')
  const permissions = json(actor.get('permissions')) || {}
  if (
    role !== 'admin' &&
    !(permissions.locacao === true || (role === 'attendant' && permissions.locacao !== false))
  )
    return e.json(403, { error: 'Perfil sem acesso à locação.' })
  const body = info.body || {}
  try {
    if (body.action === 'list') {
      const rows = e.app.findRecordsByFilter(
        'impressoras',
        'ativo = true',
        'fabricante,modelo',
        1000,
        0,
      )
      return e.json(200, {
        printers: rows.map((r) => ({
          id: r.id,
          modelo: r.getString('modelo'),
          fabricante: r.getString('fabricante'),
        })),
      })
    }
    if (!['simulate', 'create'].includes(body.action))
      return e.json(400, { error: 'Operação inválida.' })
    const pages = body.pages,
      months = body.months
    if (
      !Number.isSafeInteger(pages) ||
      pages < 1 ||
      pages > 10000000 ||
      !Number.isSafeInteger(months) ||
      months < 1 ||
      months > 120
    )
      return e.json(400, { error: 'Informe páginas e prazo válidos.' })
    if (typeof body.printerId !== 'string' || !/^[a-z0-9]{15}$/.test(body.printerId))
      return e.json(400, { error: 'Selecione um equipamento.' })
    let response
    e.app.runInTransaction((app) => {
      if (body.action === 'create') {
        if (typeof body.requestId !== 'string' || !/^[a-z0-9]{15}$/.test(body.requestId))
          throw new Error('CLIENTE')
        let existing
        try {
          existing = app.findRecordById('rental_quotes', body.requestId)
        } catch (_) {}
        if (existing) {
          const prior = json(existing.get('resultados'))
          if (
            !prior ||
            prior.createdBy !== actor.id ||
            !app.canAccessRecord(existing, info, existing.collection().viewRule)
          )
            throw new Error('ACESSO')
          response = { id: existing.id }
          return
        }
      }
      const p = app.findRecordById('impressoras', body.printerId)
      if (!p.getBool('ativo') || p.getBool('bloqueada')) throw new Error('CADASTRO')
      if (p.getBool('vinculos_variaveis_ativos')) throw new Error('CADASTRO')
      const settings = app.findFirstRecordByFilter(
        'settings',
        "key = 'rental_default_payback_months'",
      )
      const payback = Number(settings.getString('value'))
      if (!Number.isSafeInteger(payback) || payback < 1) throw new Error('PAYBACK')
      const params = app.findRecordsByFilter('parametros', '', '-created', 1, 0)[0]
      if (!params) throw new Error('CADASTRO')
      const rates = app.findRecordsByFilter(
        'rental_reserve',
        'payload.kind = "rate"',
        '-created,-id',
        1,
        0,
      )
      const rate = rates[0] && json(rates[0].get('payload')).rate
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) throw new Error('RESERVA')
      const slots = []
      const compact = [
        'HL-1200',
        'HL-1210W',
        'HL-1212w',
        'DCP-1600',
        'DCP-1610NW',
        'DCP-1617NW',
      ].includes(p.getString('modelo'))
      for (let i = 1; i <= 5; i++) {
        if (compact && (i === 3 || i === 4)) {
          slots.push({
            slotNumber: i,
            modelo: 'INTEGRADO',
            tipo: i === 3 ? 'unidade_fusora' : 'pelicula',
            valorCompra: 0,
            rendimentoPaginas: 50000,
            integratedToChassis: true,
          })
          continue
        }
        const id = p.getString('suprimento_' + i)
        if (!id) {
          slots.push(null)
          continue
        }
        const s = app.findRecordById('suprimentos', id)
        if (!s.getBool('ativo')) throw new Error('CADASTRO')
        slots.push({
          slotNumber: i,
          supplyId: id,
          modelo: s.getString('modelo_suprimento'),
          tipo: s.getString('tipo'),
          fabricante: s.getString('fabricante'),
          valorCompra: s.get('valor_compra'),
          rendimentoPaginas: s.get('rendimento_paginas'),
          included: true,
        })
      }
      const input = {
        printerId: p.id,
        modelo: p.getString('modelo'),
        fabricante: p.getString('fabricante'),
        tecnologia: p.getString('tecnologia'),
        valorCompra: p.get('valor_compra'),
        valorSoftwarePrintway: p.get('custo_mensal_software'),
        vidaUtilMeses: p.get('vida_util_meses'),
        producaoMensalEstimada: pages,
        contratoMeses: months,
        paybackMeses: payback,
        markUpRevenda: params.get('mark_up_revenda'),
        supplies: slots,
      }
      const calc = calculateSpreadsheetPricing(input)
      if (!calc.valid) throw new Error('CADASTRO')
      const excess = Math.round((calc.cppVenda + rate) * 1000000) / 1000000
      const monthly = Math.round((calc.faturamentoTotalMensal + rate * pages) * 100) / 100
      if (!Number.isFinite(excess) || !Number.isFinite(monthly) || monthly <= 0)
        throw new Error('CADASTRO')
      const commercial = {
        machineName: input.modelo + ' (' + input.fabricante + ')',
        franquiaSugerida: monthly,
        excedenteSugerido: excess,
        tco: Math.round(monthly * months * 100) / 100,
        scanner: body.scanner !== 'Sem scanner',
        scannerDados: body.scanner || '',
      }
      response = { machine: commercial, pages, months }
      if (body.action === 'create') {
        if (
          ![
            'Sem scanner',
            'Scanner de mesa, sem ADF',
            'Scanner com ADF simples',
            'Scanner com ADF duplex',
          ].includes(body.scanner)
        )
          throw new Error('SCANNER')
        const customer = body.customer || {}
        if (typeof customer.cliente_nome_livre !== 'string' || !customer.cliente_nome_livre.trim())
          throw new Error('CLIENTE')
        for (const key of [
          'cliente_nome_livre',
          'cliente_telefone',
          'cliente_documento',
          'cliente_endereco',
        ])
          if (
            customer[key] != null &&
            (typeof customer[key] !== 'string' || customer[key].length > 1000)
          )
            throw new Error('CLIENTE')
        // Reject changed pricing; the attendant must see the new amount before saving.
        if (body.expectedMonthly !== monthly || body.expectedExcess !== excess)
          throw new Error('ALTERADO')
        const collection = app.findCollectionByNameOrId('rental_quotes')
        const record = new Record(collection)
        record.set('id', body.requestId)
        const data = {
          titulo: 'Locação de Impressoras — Proposta Comercial',
          status: 'proposta_gerada',
          volume_mensal: pages,
          franquia_paginas: pages,
          contrato_meses: months,
          excesso_pagina_valor: excess,
          scanner: commercial.scanner,
          scanner_dados: body.scanner,
          payback_meses: payback,
          software_printway_mensal: input.valorSoftwarePrintway,
          margem_pct: Math.round((input.markUpRevenda - 1) * 100),
          maquinas_comparadas: [commercial],
          resultados: {
            pricingSnapshot: {
              regra: 'servidor-planilha-reserva-v3',
              input,
              reserva_por_pagina: rate,
              reserva_referencia: rates[0].id,
              calculation: calc,
            },
          },
          token_acesso: $security.randomString(48),
        }
        data.resultados.createdBy = actor.id
        for (const key of [
          'cliente_nome_livre',
          'cliente_telefone',
          'cliente_documento',
          'cliente_endereco',
        ])
          data[key] = (customer[key] || '').trim()
        if (customer.cliente_id) {
          const client = app.findRecordById('customers', customer.cliente_id)
          if (!app.canAccessRecord(client, info, client.collection().viewRule))
            throw new Error('CLIENTE')
          data.cliente_id = client.id
        }
        for (const key of Object.keys(data)) record.set(key, data[key])
        if (!app.canAccessRecord(record, info, collection.createRule)) throw new Error('ACESSO')
        app.save(record)
        response = { id: record.id }
      }
    })
    return e.json(200, response)
  } catch (err) {
    const messages = {
      PAYBACK: 'Administrador: confira o payback padrão de locação.',
      RESERVA: 'Administrador: confira o planejamento da reserva.',
      SCANNER: 'Confirme o scanner do equipamento.',
      CLIENTE: 'Confira os dados e o acesso ao cliente.',
      ALTERADO: 'Os preços mudaram. Calcule novamente antes de salvar.',
      ACESSO: 'Sem autorização para gerar proposta.',
    }
    return e.json(400, {
      error:
        messages[err.message] ||
        'Equipamento pendente de revisão administrativa. Escolha outro ou solicite a revisão do cadastro.',
    })
  }
})
