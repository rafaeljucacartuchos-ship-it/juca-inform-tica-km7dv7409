migrate(
  (app) => {
    // =========================================================================
    // 1. parametros
    // =========================================================================
    const parametrosCol = new Collection({
      name: 'parametros',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'mark_up_revenda', type: 'number', required: true },
        { name: 'vida_util_padrao_meses', type: 'number', required: true },
        { name: 'producao_mensal_referencia', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(parametrosCol)

    // Seed registro padrão de parametros
    const paramRec = new Record(parametrosCol)
    paramRec.set('mark_up_revenda', 1.45)
    paramRec.set('vida_util_padrao_meses', 48)
    paramRec.set('producao_mensal_referencia', 1000)
    app.save(paramRec)

    // =========================================================================
    // 2. suprimentos
    // =========================================================================
    const suprimentosCol = new Collection({
      name: 'suprimentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'modelo_suprimento', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: [
            'toner',
            'tinta',
            'cartucho',
            'fotocondutor',
            'unidade_fusora',
            'pelicula',
            'cabecote',
            'bobina',
            'fita',
            'ribbon',
          ],
          maxSelect: 1,
        },
        { name: 'fabricante', type: 'text', required: true },
        { name: 'impressoras_compativeis', type: 'text' },
        { name: 'valor_compra', type: 'number' },
        { name: 'rendimento_paginas', type: 'number' },
        { name: 'cpp_calculado', type: 'number' },
        { name: 'fonte_preco', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_suprimentos_modelo ON suprimentos (modelo_suprimento)',
        'CREATE INDEX idx_suprimentos_fabricante ON suprimentos (fabricante)',
        'CREATE INDEX idx_suprimentos_tipo ON suprimentos (tipo)',
      ],
    })
    app.save(suprimentosCol)
    const suprimentosId = suprimentosCol.id

    // =========================================================================
    // 3. impressoras
    // =========================================================================
    const impressorasCol = new Collection({
      name: 'impressoras',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'modelo', type: 'text', required: true },
        { name: 'fabricante', type: 'text', required: true },
        {
          name: 'tecnologia',
          type: 'select',
          required: true,
          values: ['laser_mono', 'laser_colorido', 'tinta', 'termica', 'matricial'],
          maxSelect: 1,
        },
        { name: 'valor_compra', type: 'number' },
        { name: 'vida_util_meses', type: 'number' },
        {
          name: 'suprimento_1',
          type: 'relation',
          collectionId: suprimentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'suprimento_2',
          type: 'relation',
          collectionId: suprimentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'suprimento_3',
          type: 'relation',
          collectionId: suprimentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'suprimento_4',
          type: 'relation',
          collectionId: suprimentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'suprimento_5',
          type: 'relation',
          collectionId: suprimentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'cpp_suprimentos', type: 'number' },
        { name: 'cpp_equipamento', type: 'number' },
        { name: 'cpp_fornecedor_total', type: 'number' },
        { name: 'fonte_preco_equipamento', type: 'text' },
        { name: 'bloqueada', type: 'bool' },
        { name: 'motivo_bloqueio', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_impressoras_modelo ON impressoras (modelo)',
        'CREATE INDEX idx_impressoras_fabricante ON impressoras (fabricante)',
        'CREATE INDEX idx_impressoras_tecnologia ON impressoras (tecnologia)',
      ],
    })
    app.save(impressorasCol)
    const impressorasId = impressorasCol.id

    // =========================================================================
    // 4. contratos (conforme seção 12 / contratos de locação gerados)
    // =========================================================================
    const contratosCol = new Collection({
      name: 'contratos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'cliente', type: 'text', required: true },
        {
          name: 'id_impressora',
          type: 'relation',
          required: true,
          collectionId: impressorasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'producao_mensal_estimada', type: 'number', required: true },
        { name: 'locacao_mensal', type: 'number', required: true },
        { name: 'mark_up_aplicado', type: 'number', required: true },
        { name: 'cpp_venda_fechado', type: 'number', required: true },
        { name: 'data_inicio', type: 'date', required: true },
        { name: 'duracao_meses', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'encerrado', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'dados_congelados', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contratos_cliente ON contratos (cliente)',
        'CREATE INDEX idx_contratos_impressora ON contratos (id_impressora)',
        'CREATE INDEX idx_contratos_status ON contratos (status)',
      ],
    })
    app.save(contratosCol)

    // =========================================================================
    // 5. auditoria_precos
    // =========================================================================
    const auditoriaPrecosCol = new Collection({
      name: 'auditoria_precos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'tabela_afetada', type: 'text', required: true },
        { name: 'id_registro', type: 'text', required: true },
        { name: 'campo_alterado', type: 'text', required: true },
        { name: 'valor_antigo', type: 'text' },
        { name: 'valor_novo', type: 'text', required: true },
        { name: 'usuario_responsavel', type: 'text', required: true },
        { name: 'data_modificacao', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_auditoria_tabela_reg ON auditoria_precos (tabela_afetada, id_registro)',
        'CREATE INDEX idx_auditoria_usuario ON auditoria_precos (usuario_responsavel)',
      ],
    })
    app.save(auditoriaPrecosCol)

    // =========================================================================
    // 6. POPULAR SUPRIMENTOS (ANEXO A - 63 SUPRIMENTOS COMPLETOS)
    // =========================================================================
    const rawSupplies = [
      {
        modelo: 'TN-1035',
        tipo: 'toner',
        fab: 'Brother',
        comp: 'HL-1210W, HL-1212w, HL-1200, DCP-1600, DCP-1610NW, DCP-1617NW',
        valor: 49.9,
        rend: 1000,
      },
      {
        modelo: 'DR-1035',
        tipo: 'fotocondutor',
        fab: 'Brother',
        comp: 'HL-1210W, HL-1212w, HL-1200, DCP-1600, DCP-1610NW, DCP-1617NW',
        valor: 27.18,
        rend: 10000,
      },
      {
        modelo: 'TN-2370',
        tipo: 'toner',
        fab: 'Brother',
        comp: 'DCP-L2540DN, DCP-L2540DW',
        valor: 79.9,
        rend: 2600,
      },
      {
        modelo: 'DR-2400',
        tipo: 'fotocondutor',
        fab: 'Brother',
        comp: 'DCP-L2540DN, DCP-L2540DW',
        valor: 49.9,
        rend: 12000,
      },
      {
        modelo: 'TN-3442',
        tipo: 'toner',
        fab: 'Brother',
        comp: 'DCP-L5652DN',
        valor: 70.9,
        rend: 8000,
      },
      {
        modelo: 'TN-3472',
        tipo: 'toner',
        fab: 'Brother',
        comp: 'DCP-L5662DN',
        valor: 70.9,
        rend: 12000,
      },
      {
        modelo: 'TN-3662XLS',
        tipo: 'toner',
        fab: 'Brother',
        comp: 'HL-L6412DW',
        valor: 116.89,
        rend: 25000,
      },
      {
        modelo: 'TN-B021',
        tipo: 'toner',
        fab: 'Brother',
        comp: 'HL-B2080',
        valor: 99.0,
        rend: 2600,
      },
      {
        modelo: 'T544-BK',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L1250, L3150, L3250',
        valor: 12.5,
        rend: 4500,
      },
      {
        modelo: 'T544-C',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L1250, L3150, L3250',
        valor: 12.76,
        rend: 7500,
      },
      {
        modelo: 'T544-M',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L1250, L3150, L3250',
        valor: 12.76,
        rend: 7500,
      },
      {
        modelo: 'T544-Y',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L1250, L3150, L3250',
        valor: 12.76,
        rend: 7500,
      },
      {
        modelo: 'T504-BK',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L14150, L6270, L6290',
        valor: 12.5,
        rend: 4500,
      },
      {
        modelo: 'T504-C',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L14150, L6270, L6290',
        valor: 12.76,
        rend: 7500,
      },
      {
        modelo: 'T504-M',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L14150, L6270, L6290',
        valor: 12.76,
        rend: 7500,
      },
      {
        modelo: 'T504-Y',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L14150, L6270, L6290',
        valor: 12.76,
        rend: 7500,
      },
      {
        modelo: 'T664-BK',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L365, L375, L395',
        valor: 18.74,
        rend: 4000,
      },
      {
        modelo: 'T664-C',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L365, L375, L395',
        valor: 18.74,
        rend: 6500,
      },
      {
        modelo: 'T664-M',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L365, L375, L395',
        valor: 18.74,
        rend: 6500,
      },
      {
        modelo: 'T664-Y',
        tipo: 'tinta',
        fab: 'Epson',
        comp: 'L365, L375, L395',
        valor: 18.74,
        rend: 6500,
      },
      {
        modelo: 'GI-190-BK',
        tipo: 'tinta',
        fab: 'Canon',
        comp: 'G4110, G4111',
        valor: 62.86,
        rend: 6000,
      },
      {
        modelo: 'GI-190-C',
        tipo: 'tinta',
        fab: 'Canon',
        comp: 'G4110, G4111',
        valor: 13.49,
        rend: 7000,
      },
      {
        modelo: 'GI-190-M',
        tipo: 'tinta',
        fab: 'Canon',
        comp: 'G4110, G4111',
        valor: 13.49,
        rend: 7000,
      },
      {
        modelo: 'GI-190-Y',
        tipo: 'tinta',
        fab: 'Canon',
        comp: 'G4110, G4111',
        valor: 13.49,
        rend: 7000,
      },
      {
        modelo: 'CE285A (85A)',
        tipo: 'toner',
        fab: 'HP',
        comp: 'M1132, M1212nf, P1102, P1102w',
        valor: 62.63,
        rend: 1600,
      },
      {
        modelo: 'CF283A (83A)',
        tipo: 'toner',
        fab: 'HP',
        comp: 'LaserJet MFP M127fn, M127fw',
        valor: 38.99,
        rend: 1500,
      },
      {
        modelo: 'CB435A (35A)',
        tipo: 'toner',
        fab: 'HP',
        comp: 'LaserJet P1005',
        valor: 37.9,
        rend: 1800,
      },
      {
        modelo: 'CF248A (48A)',
        tipo: 'toner',
        fab: 'HP',
        comp: 'LaserJet M130fw, M130nw',
        valor: 38.25,
        rend: 1000,
      },
      {
        modelo: 'W1105A (105A)',
        tipo: 'toner',
        fab: 'HP',
        comp: 'Laser 107w, 135a, 135w',
        valor: 44.08,
        rend: 1000,
      },
      {
        modelo: 'Q2612A (12A)',
        tipo: 'toner',
        fab: 'HP',
        comp: 'LaserJet 1020, 3055, M1120',
        valor: 28.5,
        rend: 2000,
      },
      {
        modelo: 'GT51-BK',
        tipo: 'tinta',
        fab: 'HP',
        comp: 'Ink Tank Wireless 410',
        valor: 12.5,
        rend: 5000,
      },
      {
        modelo: 'GT52-C',
        tipo: 'tinta',
        fab: 'HP',
        comp: 'Ink Tank Wireless 410',
        valor: 12.5,
        rend: 5000,
      },
      {
        modelo: 'GT52-M',
        tipo: 'tinta',
        fab: 'HP',
        comp: 'Ink Tank Wireless 410',
        valor: 12.5,
        rend: 5000,
      },
      {
        modelo: 'GT52-Y',
        tipo: 'tinta',
        fab: 'HP',
        comp: 'Ink Tank Wireless 410',
        valor: 12.5,
        rend: 5000,
      },
      {
        modelo: 'MLT-D111S',
        tipo: 'toner',
        fab: 'Samsung',
        comp: 'M2070',
        valor: 55.0,
        rend: 1000,
      },
      {
        modelo: 'MLT-D101S',
        tipo: 'toner',
        fab: 'Samsung',
        comp: 'ML-2160, ML-2160 Series',
        valor: 64.0,
        rend: 1500,
      },
      {
        modelo: 'MLT-D1042S',
        tipo: 'toner',
        fab: 'Samsung',
        comp: 'ML-1860',
        valor: 275.0,
        rend: 1500,
      },
      {
        modelo: 'MLT-D204L',
        tipo: 'toner',
        fab: 'Samsung',
        comp: 'SL-M3375FD',
        valor: 87.2,
        rend: 5000,
      },
      {
        modelo: 'CAB-BH1-CH1',
        tipo: 'cabecote',
        fab: 'Canon',
        comp: 'G4110, G4111',
        valor: 412.5,
        rend: 30000,
      },
      {
        modelo: 'CAB-GT52',
        tipo: 'cabecote',
        fab: 'HP',
        comp: 'Ink Tank Wireless 410, DeskJet 5820',
        valor: 199.94,
        rend: 30000,
      },
      {
        modelo: 'CAB-FA04061',
        tipo: 'cabecote',
        fab: 'Epson',
        comp: 'L1250, L3150, L3250, L365, L375, L395',
        valor: 479.0,
        rend: 30000,
        fonte: 'Provisão de Reparo',
      },
      {
        modelo: 'FUS-LY9388001',
        tipo: 'unidade_fusora',
        fab: 'Brother',
        comp: 'DCP-L2540DN, DCP-L2540DW, HL-B2080',
        valor: 312.0,
        rend: 100000,
      },
      {
        modelo: 'PEL-L2540',
        tipo: 'pelicula',
        fab: 'Brother',
        comp: 'DCP-L2540DW, HL-B2080',
        valor: 67.35,
        rend: 50000,
      },
      {
        modelo: 'PEL-L5652',
        tipo: 'pelicula',
        fab: 'Brother',
        comp: 'DCP-L5652DN, DCP-L5662DN, HL-L6412DW',
        valor: 57.57,
        rend: 50000,
      },
      {
        modelo: 'FUS-D00V9X001',
        tipo: 'unidade_fusora',
        fab: 'Brother',
        comp: 'DCP-L5652DN, DCP-L5662DN, HL-L6412DW',
        valor: 828.6,
        rend: 100000,
      },
      {
        modelo: 'PEL-8152',
        tipo: 'pelicula',
        fab: 'Brother',
        comp: 'DCP-8110DN, DCP-8152DN, HL-5450DN',
        valor: 56.12,
        rend: 50000,
      },
      {
        modelo: 'FUS-LJB693001',
        tipo: 'unidade_fusora',
        fab: 'Brother',
        comp: 'DCP-8110DN, DCP-8152DN, HL-5450DN',
        valor: 962.67,
        rend: 100000,
      },
      {
        modelo: 'FUS-RM1-7733',
        tipo: 'unidade_fusora',
        fab: 'HP',
        comp: 'M1132, M1212nf, P1102, P1102w',
        valor: 210.0,
        rend: 100000,
      },
      {
        modelo: 'PEL-RG9-1493',
        tipo: 'pelicula',
        fab: 'HP',
        comp: 'LaserJet 1020, M1132, M1212nf, P1102, P1102w, Samsung M2070, ML-2160',
        valor: 9.89,
        rend: 50000,
      },
      {
        modelo: 'FUS-RC29205',
        tipo: 'unidade_fusora',
        fab: 'HP',
        comp: 'LaserJet MFP M127fn, M127fw',
        valor: 132.91,
        rend: 100000,
      },
      {
        modelo: 'FUS-107',
        tipo: 'unidade_fusora',
        fab: 'HP',
        comp: 'Laser 107w, 135a, 135w',
        valor: 359.0,
        rend: 100000,
      },
      {
        modelo: 'FUS-JC91-01076A',
        tipo: 'unidade_fusora',
        fab: 'Samsung',
        comp: 'M2070, ML-2160, ML-2160 Series, SL-M3375FD',
        valor: 321.94,
        rend: 100000,
      },
      {
        modelo: 'FUS-JC91-00991A',
        tipo: 'unidade_fusora',
        fab: 'Samsung',
        comp: 'ML-1860',
        valor: 199.8,
        rend: 100000,
      },
      {
        modelo: 'TK477ST',
        tipo: 'toner',
        fab: 'Kyocera',
        comp: 'TK477ST-KYOCERA',
        valor: 215.24,
        rend: 15000,
      },
      {
        modelo: 'MK477ST',
        tipo: 'fotocondutor',
        fab: 'Kyocera',
        comp: 'TK477ST-KYOCERA',
        valor: 972.73,
        rend: 300000,
      },
      {
        modelo: 'LC109BKST',
        tipo: 'cartucho',
        fab: 'Brother',
        comp: 'MFC-J1010DW, MFC-J1170DW',
        valor: 71.74,
        rend: 2400,
      },
      {
        modelo: 'LC105CST',
        tipo: 'cartucho',
        fab: 'Brother',
        comp: 'MFC-J1010DW, MFC-J1170DW',
        valor: 37.32,
        rend: 1200,
      },
      {
        modelo: 'LC105MST',
        tipo: 'cartucho',
        fab: 'Brother',
        comp: 'MFC-J1010DW, MFC-J1170DW',
        valor: 37.32,
        rend: 1200,
      },
      {
        modelo: 'LC105YST',
        tipo: 'cartucho',
        fab: 'Brother',
        comp: 'MFC-J1010DW, MFC-J1170DW',
        valor: 37.32,
        rend: 1200,
      },
      // Itens pendentes/com valor NULL conforme Anexo A
      {
        modelo: 'BOBINA-80MM',
        tipo: 'bobina',
        fab: 'Genérico',
        comp: 'MP-4200 TH, L42',
        valor: null,
        rend: null,
        fonte: 'Pendente de homologação',
      },
      {
        modelo: 'FITA-LX350',
        tipo: 'fita',
        fab: 'Epson',
        comp: 'LX 350',
        valor: null,
        rend: null,
        fonte: 'Pendente de homologação',
      },
      {
        modelo: 'RIBBON-ZD220',
        tipo: 'ribbon',
        fab: 'Zebra',
        comp: 'ZD220',
        valor: null,
        rend: null,
        fonte: 'Pendente de homologação',
      },
      {
        modelo: 'HP-652',
        tipo: 'cartucho',
        fab: 'HP',
        comp: 'DeskJet 5820',
        valor: null,
        rend: null,
        fonte: 'Pendente de homologação',
      },
    ]

    const supplyIdMap = {}

    for (let i = 0; i < rawSupplies.length; i++) {
      const s = rawSupplies[i]
      const rec = new Record(suprimentosCol)
      rec.set('modelo_suprimento', s.modelo)
      rec.set('tipo', s.tipo)
      rec.set('fabricante', s.fab)
      rec.set('impressoras_compativeis', s.comp || '')
      if (s.valor !== null && s.valor !== undefined) {
        rec.set('valor_compra', s.valor)
      }
      if (s.rend !== null && s.rend !== undefined) {
        rec.set('rendimento_paginas', s.rend)
      }
      let cpp = 0
      if (s.valor && s.rend && s.rend > 0) {
        cpp = s.valor / s.rend
      }
      rec.set('cpp_calculado', cpp)
      rec.set('fonte_preco', s.fonte || 'Tabela Homologada')
      rec.set('ativo', true)
      app.save(rec)
      supplyIdMap[s.modelo] = rec.id
    }

    // =========================================================================
    // 7. POPULAR IMPRESSORAS (ANEXO B - 60 IMPRESSORAS COMPLETAS)
    // =========================================================================
    const rawPrinters = [
      // Brother (17)
      {
        modelo: 'HL-1210W',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: 890.0,
        vida: 48,
        slots: ['TN-1035', 'DR-1035'],
      },
      {
        modelo: 'HL-1212w',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: 1449.9,
        vida: 48,
        slots: ['TN-1035', 'DR-1035'],
      },
      {
        modelo: 'HL-1200',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-1035', 'DR-1035'],
      },
      {
        modelo: 'DCP-1600',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-1035', 'DR-1035'],
      },
      {
        modelo: 'DCP-1610NW',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-1035', 'DR-1035'],
      },
      {
        modelo: 'DCP-1617NW',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-1035', 'DR-1035'],
      },
      {
        modelo: 'DCP-L2540DN',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-2370', 'DR-2400', 'FUS-LY9388001'],
      },
      {
        modelo: 'DCP-L2540DW',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: 2094.33,
        vida: 48,
        slots: ['TN-2370', 'DR-2400', 'FUS-LY9388001', 'PEL-L2540'],
      },
      {
        modelo: 'DCP-L5652DN',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: 1699.0,
        vida: 48,
        slots: ['TN-3442', 'FUS-D00V9X001', 'PEL-L5652'],
      },
      {
        modelo: 'DCP-L5662DN',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-3472', 'FUS-D00V9X001', 'PEL-L5652'],
      },
      {
        modelo: 'HL-L6412DW',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-3662XLS', 'FUS-D00V9X001'],
      },
      {
        modelo: 'DCP-8110DN',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['FUS-LJB693001', 'PEL-8152'],
      },
      {
        modelo: 'DCP-8152DN',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['FUS-LJB693001', 'PEL-8152'],
      },
      {
        modelo: 'HL-5450DN',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['FUS-LJB693001', 'PEL-8152'],
      },
      {
        modelo: 'HL-B2080',
        fab: 'Brother',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['TN-B021', 'FUS-LY9388001', 'PEL-L2540'],
      },
      {
        modelo: 'MFC-J1010DW',
        fab: 'Brother',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['LC109BKST', 'LC105CST', 'LC105MST', 'LC105YST'],
      },
      {
        modelo: 'MFC-J1170DW',
        fab: 'Brother',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['LC109BKST', 'LC105CST', 'LC105MST', 'LC105YST'],
      },

      // Canon (2)
      {
        modelo: 'G4110',
        fab: 'Canon',
        tec: 'tinta',
        valor: 949.0,
        vida: 48,
        slots: ['GI-190-BK', 'GI-190-C', 'GI-190-M', 'GI-190-Y', 'CAB-BH1-CH1'],
      },
      {
        modelo: 'G4111',
        fab: 'Canon',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['GI-190-BK', 'GI-190-C', 'GI-190-M', 'GI-190-Y', 'CAB-BH1-CH1'],
      },

      // Epson (13)
      {
        modelo: 'L1250',
        fab: 'Epson',
        tec: 'tinta',
        valor: 999.0,
        vida: 48,
        slots: ['T544-BK', 'T544-C', 'T544-M', 'T544-Y', 'CAB-FA04061'],
      },
      {
        modelo: 'L3150',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['T544-BK', 'T544-C', 'T544-M', 'T544-Y', 'CAB-FA04061'],
      },
      {
        modelo: 'L3250',
        fab: 'Epson',
        tec: 'tinta',
        valor: 1019.91,
        vida: 48,
        slots: ['T544-BK', 'T544-C', 'T544-M', 'T544-Y', 'CAB-FA04061'],
      },
      {
        modelo: 'L365',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['T664-BK', 'T664-C', 'T664-M', 'T664-Y', 'CAB-FA04061'],
      },
      {
        modelo: 'L375',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['T664-BK', 'T664-C', 'T664-M', 'T664-Y', 'CAB-FA04061'],
      },
      {
        modelo: 'L395',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['T664-BK', 'T664-C', 'T664-M', 'T664-Y', 'CAB-FA04061'],
      },
      {
        modelo: 'L4360',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: [],
        bloqueada: true,
        motivo: 'Cabeçote específico a cadastrar (bloqueado)',
      },
      {
        modelo: 'L14150',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['T504-BK', 'T504-C', 'T504-M', 'T504-Y'],
      },
      {
        modelo: 'L6270',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['T504-BK', 'T504-C', 'T504-M', 'T504-Y'],
      },
      {
        modelo: 'L6290',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['T504-BK', 'T504-C', 'T504-M', 'T504-Y'],
      },
      {
        modelo: 'L805',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: [],
        bloqueada: true,
        motivo: 'Cabeçote específico a cadastrar (bloqueado)',
      },
      {
        modelo: 'L5590',
        fab: 'Epson',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: [],
        bloqueada: true,
        motivo: 'Cabeçote específico a cadastrar (bloqueado)',
      },
      {
        modelo: 'LX 350',
        fab: 'Epson',
        tec: 'matricial',
        valor: null,
        vida: 48,
        slots: ['FITA-LX350'],
        fonte: 'Custo por fita',
      },

      // HP (20)
      {
        modelo: 'LaserJet MFP M127fw',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CF283A (83A)', 'FUS-RC29205'],
      },
      {
        modelo: 'LaserJet Pro MFP M127fn',
        fab: 'HP',
        tec: 'laser_mono',
        valor: 535.9,
        vida: 48,
        slots: ['CF283A (83A)', 'FUS-RC29205'],
      },
      {
        modelo: 'Laser 107w',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['W1105A (105A)', 'FUS-107'],
      },
      {
        modelo: 'Laser 135a',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['W1105A (105A)', 'FUS-107'],
      },
      {
        modelo: 'Laser 135w',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['W1105A (105A)', 'FUS-107'],
      },
      {
        modelo: 'LaserJet 1020',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['Q2612A (12A)', 'PEL-RG9-1493'],
      },
      {
        modelo: 'LaserJet 3055',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['Q2612A (12A)'],
      },
      {
        modelo: 'M1120',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['Q2612A (12A)'],
      },
      {
        modelo: 'M1132',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CE285A (85A)', 'FUS-RM1-7733', 'PEL-RG9-1493'],
      },
      {
        modelo: 'M1212nf',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CE285A (85A)', 'FUS-RM1-7733', 'PEL-RG9-1493'],
      },
      {
        modelo: 'M130fw',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CF248A (48A)'],
      },
      {
        modelo: 'M130nw',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CF248A (48A)'],
      },
      {
        modelo: 'P1102w',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CE285A (85A)', 'FUS-RM1-7733', 'PEL-RG9-1493'],
      },
      {
        modelo: 'P1005',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CB435A (35A)'],
      },
      {
        modelo: 'P1102',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['CE285A (85A)', 'FUS-RM1-7733', 'PEL-RG9-1493'],
      },
      {
        modelo: 'P2055dn',
        fab: 'HP',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: [],
        bloqueada: true,
        motivo: 'Toner CE505A a pesquisar (bloqueado)',
      },
      {
        modelo: 'Color LaserJet M177fw',
        fab: 'HP',
        tec: 'laser_colorido',
        valor: null,
        vida: 48,
        slots: [],
        bloqueada: true,
        motivo: 'Kit 130A (CF350A BK/C/M/Y) a cadastrar',
      },
      {
        modelo: 'CP 1025nw',
        fab: 'HP',
        tec: 'laser_colorido',
        valor: null,
        vida: 48,
        slots: [],
        bloqueada: true,
        motivo: 'Kit 126A (CE310A BK/C/M/Y) a cadastrar',
      },
      {
        modelo: 'DeskJet 5820',
        fab: 'HP',
        tec: 'tinta',
        valor: null,
        vida: 48,
        slots: ['CAB-GT52', 'HP-652'],
        motivo: 'CAB-GT52 + cartucho HP 652 a pesquisar',
      },
      {
        modelo: 'Ink Tank Wireless 410',
        fab: 'HP',
        tec: 'tinta',
        valor: 498.75,
        vida: 48,
        slots: ['GT51-BK', 'GT52-C', 'GT52-M', 'GT52-Y', 'CAB-GT52'],
      },

      // Samsung (5)
      {
        modelo: 'M2070',
        fab: 'Samsung',
        tec: 'laser_mono',
        valor: 590.0,
        vida: 48,
        slots: ['MLT-D111S', 'FUS-JC91-01076A'],
      },
      {
        modelo: 'ML-1860',
        fab: 'Samsung',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['MLT-D1042S', 'FUS-JC91-00991A'],
      },
      {
        modelo: 'ML-2160',
        fab: 'Samsung',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['MLT-D101S', 'FUS-JC91-01076A'],
      },
      {
        modelo: 'ML-2160 Series',
        fab: 'Samsung',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['MLT-D101S', 'FUS-JC91-01076A'],
      },
      {
        modelo: 'SL-M3375FD',
        fab: 'Samsung',
        tec: 'laser_mono',
        valor: null,
        vida: 48,
        slots: ['MLT-D204L', 'FUS-JC91-01076A'],
      },

      // Térmicas (3)
      {
        modelo: 'MP-4200 TH',
        fab: 'Bematech',
        tec: 'termica',
        valor: null,
        vida: 48,
        slots: ['BOBINA-80MM'],
        fonte: 'Custo por bobina',
      },
      {
        modelo: 'L42',
        fab: 'Elgin',
        tec: 'termica',
        valor: null,
        vida: 48,
        slots: ['BOBINA-80MM'],
        fonte: 'Custo por bobina',
      },
      {
        modelo: 'ZD220',
        fab: 'Zebra',
        tec: 'termica',
        valor: null,
        vida: 48,
        slots: ['RIBBON-ZD220'],
        fonte: 'Custo por ribbon',
      },
    ]

    for (let i = 0; i < rawPrinters.length; i++) {
      const p = rawPrinters[i]
      const rec = new Record(impressorasCol)
      rec.set('modelo', p.modelo)
      rec.set('fabricante', p.fab)
      rec.set('tecnologia', p.tec)
      if (p.valor !== null && p.valor !== undefined) {
        rec.set('valor_compra', p.valor)
      }
      rec.set('vida_util_meses', p.vida || 48)

      // Vínculos dos até 5 slots
      const slots = p.slots || []
      for (let sIdx = 0; sIdx < 5; sIdx++) {
        const slotKey = `suprimento_${sIdx + 1}`
        if (sIdx < slots.length && slots[sIdx] && supplyIdMap[slots[sIdx]]) {
          rec.set(slotKey, supplyIdMap[slots[sIdx]])
        }
      }

      rec.set('bloqueada', !!p.bloqueada)
      rec.set('motivo_bloqueio', p.motivo || '')
      rec.set('fonte_preco_equipamento', p.fonte || '')
      rec.set('ativo', true)
      app.save(rec)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('auditoria_precos')
      app.delete(col)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('contratos')
      app.delete(col)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('impressoras')
      app.delete(col)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('suprimentos')
      app.delete(col)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('parametros')
      app.delete(col)
    } catch (_) {}
  },
)
