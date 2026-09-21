import {
  calculateSupplyCPP,
  calculateEquipmentDepreciationCPP,
  calculatePricing,
  calculateBreakEven,
  roundTo,
} from './pricing-engine'

/**
 * Executa a bateria de testes de validação do motor contra os vetores da seção 3.8
 * e casos de borda da seção 14 da especificação técnica.
 */
export function runPricingEngineVerification(): {
  allPassed: boolean
  results: { test: string; passed: boolean; expected: any; actual: any; message?: string }[]
} {
  const results: { test: string; passed: boolean; expected: any; actual: any; message?: string }[] =
    []

  // --------------------------------------------------------------------------
  // VETOR 1: Cenário Jato de Tinta Colorida (Base Brother MFC-J - Seção 3.8)
  // LC109BKST (71.74 / 2400) = 0.029891666666666664
  // LC105CST, LC105MST, LC105YST (37.32 / 1200 cada) = 0.0311 cada
  // CPP_cor = 0.029891666666666664 + 3 * 0.0311 = 0.12319166666666667
  // Com mark-up 1.45 = 0.17862791666666666
  // --------------------------------------------------------------------------
  const cppBk = calculateSupplyCPP(71.74, 2400)
  const cppColor = calculateSupplyCPP(37.32, 1200)
  const cppCorTotal = cppBk + 3 * cppColor
  const cppCorMarkup = cppCorTotal * 1.45

  const pass1 = Math.abs(cppBk - 0.029891666666666664) < 1e-12
  results.push({
    test: 'Vetor 3.8 — LC109BKST individual',
    passed: pass1,
    expected: 0.029891666666666664,
    actual: cppBk,
  })

  const pass2 = Math.abs(cppColor - 0.0311) < 1e-12
  results.push({
    test: 'Vetor 3.8 — LC105 (C/M/Y) individual',
    passed: pass2,
    expected: 0.0311,
    actual: cppColor,
  })

  const pass3 = Math.abs(cppCorTotal - 0.12319166666666667) < 1e-12
  results.push({
    test: 'Vetor 3.8 — CPP_cor somatório (suprimentos)',
    passed: pass3,
    expected: 0.12319166666666667,
    actual: cppCorTotal,
  })

  const pass4 = Math.abs(cppCorMarkup - 0.17862791666666666) < 1e-12
  results.push({
    test: 'Vetor 3.8 — CPP_cor com mark-up 1.45',
    passed: pass4,
    expected: 0.17862791666666666,
    actual: cppCorMarkup,
  })

  // --------------------------------------------------------------------------
  // VETOR 2: Cenário Laser Monocromático (Base Kyocera TK/MK - Seção 3.8)
  // TK477ST (215.24 / 15000) = 0.014349333333333334
  // MK477ST (972.73 / 300000) = 0.0032424333333333335
  // CPP_mono = 0.014349333333333334 + 0.0032424333333333335 = 0.017591766666666668
  // Com mark-up 1.45 = 0.02550806166666667
  // --------------------------------------------------------------------------
  const cppTk = calculateSupplyCPP(215.24, 15000)
  const cppMk = calculateSupplyCPP(972.73, 300000)
  const cppMonoTotal = cppTk + cppMk
  const cppMonoMarkup = cppMonoTotal * 1.45

  const pass5 = Math.abs(cppTk - 0.014349333333333334) < 1e-12
  results.push({
    test: 'Vetor 3.8 — TK477ST individual',
    passed: pass5,
    expected: 0.014349333333333334,
    actual: cppTk,
  })

  const pass6 = Math.abs(cppMk - 0.0032424333333333335) < 1e-12
  results.push({
    test: 'Vetor 3.8 — MK477ST individual',
    passed: pass6,
    expected: 0.0032424333333333335,
    actual: cppMk,
  })

  const pass7 = Math.abs(cppMonoTotal - 0.017591766666666668) < 1e-12
  results.push({
    test: 'Vetor 3.8 — CPP_mono somatório',
    passed: pass7,
    expected: 0.017591766666666668,
    actual: cppMonoTotal,
  })

  const pass8 = Math.abs(cppMonoMarkup - 0.02550806166666667) < 1e-12
  results.push({
    test: 'Vetor 3.8 — CPP_mono com mark-up 1.45',
    passed: pass8,
    expected: 0.02550806166666667,
    actual: cppMonoMarkup,
  })

  // --------------------------------------------------------------------------
  // VETOR 3: Break-even Cruzado (Seção 3.8)
  // Delta locações = 490.1358333333333 - 87.21166666666666 = 402.92416666666664
  // Delta CPPs = 0.17862791666666666 - 0.02550806166666667 = 0.15311985500000000
  // Ponto de equilíbrio = 402.92416666666664 / 0.15311985500000000 = 2631.4299126437045
  // --------------------------------------------------------------------------
  const beResult = calculateBreakEven(
    { modelo: 'Jato Cor (Brother)', locacaoMensal: 87.21166666666666, cppVenda: cppCorMarkup },
    { modelo: 'Laser Mono (Kyocera)', locacaoMensal: 490.1358333333333, cppVenda: cppMonoMarkup },
  )

  const pass9 =
    beResult.valid &&
    beResult.paginasBreakEven !== null &&
    Math.abs(beResult.paginasBreakEven - 2631.4299126437045) < 1e-9
  results.push({
    test: 'Vetor 3.8 — Break-Even Cruzado exato (2631.4299126437045 págs)',
    passed: pass9,
    expected: 2631.4299126437045,
    actual: beResult.paginasBreakEven,
  })

  // --------------------------------------------------------------------------
  // VETOR 4: Exemplo Painel Seção 5 (DCP-L2540DW)
  // Equipamento R$ 2094.33, 48 meses, Produção 2500 págs
  // CPP_equip = 2094.33 / (48 * 2500) = 2094.33 / 120000 = 0.01745275 (ou 0.043632 na produção 1000)
  // TN-2370 (79.90 / 2600 = 0.030730769)
  // DR-2400 (49.90 / 12000 = 0.004158333)
  // FUS-LY9388001 (312 / 100000 = 0.003120000)
  // PEL-L2540 (67.35 / 50000 = 0.001347000)
  // Soma suprimentos = 0.039356102
  // Com produção 1000 (referência global): CPP_equip = 2094.33 / 48000 = 0.043631875
  // Total = 0.039356102 + 0.043631875 = 0.082987977 (~0.082988 da seção 5)
  // --------------------------------------------------------------------------
  const dcpCalc1000 = calculatePricing({
    modelo: 'DCP-L2540DW',
    fabricante: 'Brother',
    tecnologia: 'laser_mono',
    valorCompra: 2094.33,
    vidaUtilMeses: 48,
    producaoMensalEstimada: 1000,
    markUpRevenda: 1.45,
    supplies: [
      {
        slotNumber: 1,
        modelo: 'TN-2370',
        tipo: 'toner',
        valorCompra: 79.9,
        rendimentoPaginas: 2600,
      },
      {
        slotNumber: 2,
        modelo: 'DR-2400',
        tipo: 'fotocondutor',
        valorCompra: 49.9,
        rendimentoPaginas: 12000,
      },
      {
        slotNumber: 3,
        modelo: 'FUS-LY9388001',
        tipo: 'unidade_fusora',
        valorCompra: 312,
        rendimentoPaginas: 100000,
      },
      {
        slotNumber: 4,
        modelo: 'PEL-L2540',
        tipo: 'pelicula',
        valorCompra: 67.35,
        rendimentoPaginas: 50000,
      },
      null, // slot 5 vazio
    ],
  })

  const pass10 =
    dcpCalc1000.valid &&
    roundTo(dcpCalc1000.cppSuprimentos, 6) === 0.039356 &&
    roundTo(dcpCalc1000.cppEquipamento, 6) === 0.043632 &&
    roundTo(dcpCalc1000.cppFornecedorTotal, 6) === 0.082988
  results.push({
    test: 'Exemplo Seção 5 — DCP-L2540DW (ref 1000 págs): CPP_sup 0.039356, CPP_equip 0.043632, Total 0.082988',
    passed: pass10,
    expected: { cppSup: 0.039356, cppEq: 0.043632, total: 0.082988 },
    actual: {
      cppSup: roundTo(dcpCalc1000.cppSuprimentos, 6),
      cppEq: roundTo(dcpCalc1000.cppEquipamento, 6),
      total: roundTo(dcpCalc1000.cppFornecedorTotal, 6),
    },
  })

  // --------------------------------------------------------------------------
  // CASO DE BORDA 14.1: Slot Vazio / Zero Padding
  // Apenas 2 suprimentos vinculados, slots 3, 4, 5 nulos
  // Não deve lançar erro, soma apenas os ativos e preenche 0.000000 nos nulos
  // --------------------------------------------------------------------------
  const zeroPaddingCalc = calculatePricing({
    modelo: 'HL-1210W',
    fabricante: 'Brother',
    tecnologia: 'laser_mono',
    valorCompra: 890.0,
    vidaUtilMeses: 48,
    producaoMensalEstimada: 1000,
    markUpRevenda: 1.45,
    supplies: [
      {
        slotNumber: 1,
        modelo: 'TN-1035',
        tipo: 'toner',
        valorCompra: 49.9,
        rendimentoPaginas: 1000,
      },
      {
        slotNumber: 2,
        modelo: 'DR-1035',
        tipo: 'fotocondutor',
        valorCompra: 27.18,
        rendimentoPaginas: 10000,
      },
      null,
      null,
      null,
    ],
  })
  const pass11 =
    zeroPaddingCalc.valid &&
    zeroPaddingCalc.slotsEnriquecidos.length === 5 &&
    zeroPaddingCalc.slotsEnriquecidos[2].cppCalculado === 0 &&
    zeroPaddingCalc.slotsEnriquecidos[2].visualStatus === 'empty'
  results.push({
    test: 'Seção 14.1 — Zero Padding nos slots nulos (CPP 0.000000 e status empty)',
    passed: pass11,
    expected: true,
    actual: pass11,
  })

  // --------------------------------------------------------------------------
  // CASO DE BORDA 14.1: Proteção contra Divisão por Zero (producao = 0 ou markup < 1)
  // --------------------------------------------------------------------------
  const zeroProdCalc = calculatePricing({
    modelo: 'HL-1210W',
    fabricante: 'Brother',
    tecnologia: 'laser_mono',
    valorCompra: 890.0,
    vidaUtilMeses: 48,
    producaoMensalEstimada: 0,
    markUpRevenda: 1.45,
    supplies: [],
  })
  const pass12 = !zeroProdCalc.valid && zeroProdCalc.errors.some((e) => e.includes('volume mensal'))
  results.push({
    test: 'Seção 14.1 — Bloqueio com producao <= 0',
    passed: pass12,
    expected: false,
    actual: zeroProdCalc.valid,
  })

  const badMarkupCalc = calculatePricing({
    modelo: 'HL-1210W',
    fabricante: 'Brother',
    tecnologia: 'laser_mono',
    valorCompra: 890.0,
    vidaUtilMeses: 48,
    producaoMensalEstimada: 1000,
    markUpRevenda: 0.95,
    supplies: [],
  })
  const pass13 =
    !badMarkupCalc.valid && badMarkupCalc.errors.some((e) => e.includes('mark-up comercial'))
  results.push({
    test: 'Seção 18 — Bloqueio com mark-up < 1.00',
    passed: pass13,
    expected: false,
    actual: badMarkupCalc.valid,
  })

  // --------------------------------------------------------------------------
  // CASO DE BORDA 18: Cenários Paralelos no Break-Even (locações e CPPs idênticos)
  // --------------------------------------------------------------------------
  const parallelBe = calculateBreakEven(
    { modelo: 'A', locacaoMensal: 100, cppVenda: 0.1 },
    { modelo: 'B', locacaoMensal: 100, cppVenda: 0.1 },
  )
  const pass14 = !parallelBe.valid && parallelBe.error === 'ERR_BREAKEVEN_PARALLEL_LINES'
  results.push({
    test: 'Seção 18 — Erro ERR_BREAKEVEN_PARALLEL_LINES quando locação e CPP idênticos',
    passed: pass14,
    expected: 'ERR_BREAKEVEN_PARALLEL_LINES',
    actual: parallelBe.error,
  })

  const allPassed = results.every((r) => r.passed)
  return { allPassed, results }
}
