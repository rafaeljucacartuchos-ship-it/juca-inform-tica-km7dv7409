import pb from '@/lib/pocketbase/client'
import { Product } from '@/types'
import { downloadFile } from '@/lib/export-utils'

export interface ParsedProductRow {
  codigo?: string // SKU
  nome: string
  quantidadeEstoque: number
  precoVenda: number
  categoria?: string
  descricao?: string
  rowNumber: number
  statusValido: boolean
  errosValidacao?: string[]
}

export interface ImportSummary {
  created: number
  updated: number
  errors: number
  errorDetails: string[]
  totalProcessed: number
}

/**
 * Utilitário para limpar e converter números em formato brasileiro (ex: 1.250,50 ou R$ 50,00 ou 50.00)
 */
export function parseBrazilianNumber(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const str = String(val).trim()
  if (!str) return 0

  // Remove símbolos de moeda e espaços
  let clean = str.replace(/[R$\s]/gi, '')

  // Se tiver vírgula e ponto (ex: 1.250,50), remove o ponto e troca vírgula por ponto
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (clean.includes(',')) {
    // Ex: 150,50
    clean = clean.replace(',', '.')
  }

  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

/**
 * Utilitário para ler linhas de CSV / TSV lidando com aspas duplas e múltiplos delimitadores (; ou , ou \t)
 */
export function parseCSVText(text: string): string[][] {
  // Remove BOM se existir
  const cleanText = text.replace(/^\uFEFF/, '')
  const lines = cleanText.split(/\r\n|\n|\r/)
  const result: string[][] = []

  // Detecta o delimitador na primeira linha não vazia
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || ''
  let delimiter = ','
  const commaCount = (firstNonEmpty.match(/,/g) || []).length
  const semicolonCount = (firstNonEmpty.match(/;/g) || []).length
  const tabCount = (firstNonEmpty.match(/\t/g) || []).length

  if (semicolonCount > commaCount && semicolonCount >= tabCount) {
    delimiter = ';'
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t'
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const row: string[] = []
    let insideQuotes = false
    let currentVal = ''

    for (let c = 0; c < line.length; c++) {
      const char = line[c]
      const nextChar = line[c + 1]

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentVal += '"'
          c++ // pula escape
        } else {
          insideQuotes = !insideQuotes
        }
      } else if (char === delimiter && !insideQuotes) {
        row.push(currentVal.trim())
        currentVal = ''
      } else {
        currentVal += char
      }
    }
    row.push(currentVal.trim())
    result.push(row)
  }

  return result
}

/**
 * Analisador para arquivos XML de planilha (como os exportados pelo Excel em formato SpreadsheetML / .xls / HTML table)
 */
export function parseHTMLorXMLSpreadsheet(content: string): string[][] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  const rows: string[][] = []

  const trElements = doc.querySelectorAll('tr')
  trElements.forEach((tr) => {
    const row: string[] = []
    const cells = tr.querySelectorAll('td, th')
    cells.forEach((cell) => {
      row.push(cell.textContent?.trim() || '')
    })
    if (row.length > 0 && row.some((c) => c.length > 0)) {
      rows.push(row)
    }
  })

  // Se não encontrou tabelas HTML, tenta analisar tags XML <Row> e <Cell><Data>
  if (rows.length === 0) {
    const xmlDoc = parser.parseFromString(content, 'text/xml')
    const xmlRows = xmlDoc.querySelectorAll('Row, row')
    xmlRows.forEach((r) => {
      const row: string[] = []
      const cells = r.querySelectorAll('Cell, cell, c')
      cells.forEach((c) => {
        row.push(c.textContent?.trim() || '')
      })
      if (row.length > 0 && row.some((c) => c.length > 0)) {
        rows.push(row)
      }
    })
  }

  return rows
}

/**
 * Normaliza strings para comparação de cabeçalhos
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, '') // remove pontuação e espaços
}

/**
 * Lê o arquivo (.xlsx, .xls ou .csv) e devolve as linhas estruturadas e validadas
 */
export async function parseProductsFile(file: File): Promise<ParsedProductRow[]> {
  const fileName = file.name.toLowerCase()

  // Leitura como texto para CSV, TSV ou XML/HTML Spreadsheets (.xls / .csv)
  // Para XLSX com PK zip header, se for arquivo binário puro e não tiver JSZip/xlsx embutido,
  // tentamos ler como texto para casos XML ou emitimos erro amigável se binário compactado.
  const textContent = await file.text()
  let rawMatrix: string[][] = []

  if (
    textContent.includes('<table') ||
    textContent.includes('<html') ||
    textContent.includes('<?xml') ||
    textContent.includes('<Workbook')
  ) {
    rawMatrix = parseHTMLorXMLSpreadsheet(textContent)
  } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt') || fileName.endsWith('.tsv')) {
    rawMatrix = parseCSVText(textContent)
  } else {
    // Tenta primeiro como CSV/texto separado por delimitador
    const csvAttempt = parseCSVText(textContent)
    if (csvAttempt.length > 1 && csvAttempt[0].length >= 2) {
      rawMatrix = csvAttempt
    } else {
      // Se for formato XML/HTML
      rawMatrix = parseHTMLorXMLSpreadsheet(textContent)
    }
  }

  // Se ainda não conseguiu (por exemplo, se for XLSX binário compactado zip puro),
  // como não temos biblioteca pesada externa instalada, analisamos o stream procurando strings XML internas se presentes
  if (rawMatrix.length === 0) {
    // Tenta ler strings de texto extraíveis
    const lines = textContent.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
    if (lines.length > 0) {
      rawMatrix = parseCSVText(textContent)
    }
  }

  if (rawMatrix.length === 0) {
    throw new Error(
      'Não foi possível extrair dados da planilha. Certifique-se de salvar em formato .CSV ou .XLSX compatível com texto/tabela.',
    )
  }

  // Identifica a linha de cabeçalho
  let headerRowIndex = -1
  let colIndices = {
    codigo: -1,
    nome: -1,
    quantidade: -1,
    precoVenda: -1,
    categoria: -1,
    descricao: -1,
  }

  for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
    const row = rawMatrix[r]
    const normalizedRow = row.map((c) => normalizeHeader(c))

    let hasCodigo = false
    let hasNome = false
    let hasPreco = false

    row.forEach((_, colIdx) => {
      const norm = normalizedRow[colIdx]
      if (
        norm === 'codigo' ||
        norm === 'cod' ||
        norm === 'sku' ||
        norm === 'code' ||
        norm === 'codigodoproduto' ||
        norm === 'codproduto'
      ) {
        colIndices.codigo = colIdx
        hasCodigo = true
      } else if (
        norm === 'nome' ||
        norm === 'produto' ||
        norm === 'descricao' ||
        norm === 'nomeproduto' ||
        norm === 'nomedoproduto' ||
        norm === 'item' ||
        norm === 'titulo'
      ) {
        // Se ainda não achou nome ou achou nome específico
        if (colIndices.nome === -1 || norm.includes('nome') || norm === 'produto') {
          colIndices.nome = colIdx
        }
        hasNome = true
      } else if (
        norm === 'quantidade' ||
        norm === 'qtd' ||
        norm === 'quant' ||
        norm === 'estoque' ||
        norm === 'quantidadeemestoque' ||
        norm === 'qtdestoque' ||
        norm === 'saldo'
      ) {
        colIndices.quantidade = colIdx
      } else if (
        norm === 'precovenda' ||
        norm === 'preco' ||
        norm === 'valor' ||
        norm === 'valordevenda' ||
        norm === 'precounitario' ||
        norm === 'precodevenda' ||
        norm === 'venda'
      ) {
        colIndices.precoVenda = colIdx
        hasPreco = true
      } else if (
        norm === 'categoria' ||
        norm === 'grupo' ||
        norm === 'tipo' ||
        norm === 'departamento'
      ) {
        colIndices.categoria = colIdx
      }
    })

    if ((hasNome || hasCodigo) && (hasPreco || colIndices.quantidade !== -1 || row.length >= 3)) {
      headerRowIndex = r
      break
    }
  }

  // Fallback se não encontrou cabeçalho padrão: assume as primeiras colunas
  // Ordem comum: [0] Código, [1] Nome, [2] Quantidade, [3] Preço Venda, [4] Categoria
  if (headerRowIndex === -1) {
    headerRowIndex = 0
    colIndices = {
      codigo: 0,
      nome: 1,
      quantidade: 2,
      precoVenda: 3,
      categoria: 4,
      descricao: 5,
    }
  } else {
    // Se achou cabeçalho mas faltou algum mapeamento básico
    if (colIndices.nome === -1) {
      colIndices.nome = colIndices.codigo === 0 ? 1 : 0
    }
  }

  const parsedRows: ParsedProductRow[] = []

  for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
    const row = rawMatrix[i]
    if (!row || row.length === 0 || row.every((cell) => !cell.trim())) continue

    const codigo = colIndices.codigo >= 0 ? (row[colIndices.codigo] || '').trim() : ''
    const nome = colIndices.nome >= 0 ? (row[colIndices.nome] || '').trim() : ''
    const rawQtd = colIndices.quantidade >= 0 ? row[colIndices.quantidade] : '0'
    const rawVenda = colIndices.precoVenda >= 0 ? row[colIndices.precoVenda] : '0'
    const categoria = colIndices.categoria >= 0 ? (row[colIndices.categoria] || '').trim() : ''
    const descricao = colIndices.descricao >= 0 ? (row[colIndices.descricao] || '').trim() : ''

    const erros: string[] = []

    if (!nome && !codigo) {
      // Linha vazia ou irrelevante
      continue
    }

    if (!nome) {
      erros.push('Nome do produto é obrigatório.')
    }

    const quantidadeEstoque = Math.round(parseBrazilianNumber(rawQtd))
    const precoVenda = parseBrazilianNumber(rawVenda)

    if (quantidadeEstoque < 0) {
      erros.push('Quantidade em estoque não pode ser negativa.')
    }
    if (precoVenda < 0) {
      erros.push('Preço de venda não pode ser negativo.')
    }

    parsedRows.push({
      codigo: codigo || undefined,
      nome: nome || (codigo ? `Produto ${codigo}` : 'Sem Nome'),
      quantidadeEstoque,
      precoVenda,
      categoria: categoria || undefined,
      descricao: descricao || undefined,
      rowNumber: i + 1,
      statusValido: erros.length === 0,
      errosValidacao: erros.length > 0 ? erros : undefined,
    })
  }

  return parsedRows
}

/**
 * Importa/atualiza os produtos no PocketBase em lote com atualização de progresso
 */
export async function importProductsData(
  rows: ParsedProductRow[],
  onProgress?: (current: number, total: number) => void,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
    totalProcessed: rows.length,
  }

  // 1. Carrega todos os produtos existentes para busca rápida na memória por SKU ou Nome
  let existingProducts: Product[] = []
  try {
    existingProducts = await pb.collection('products').getFullList<Product>({
      sort: '-created',
    })
  } catch (e) {
    console.error('Erro ao buscar produtos existentes:', e)
  }

  const skuMap = new Map<string, Product>()
  const nameMap = new Map<string, Product>()

  existingProducts.forEach((p) => {
    if (p.sku && p.sku.trim()) {
      skuMap.set(p.sku.trim().toLowerCase(), p)
    }
    if (p.name && p.name.trim()) {
      nameMap.set(p.name.trim().toLowerCase(), p)
    }
  })

  // 2. Processa cada linha
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]

    if (onProgress) {
      onProgress(i + 1, rows.length)
    }

    if (!r.statusValido && r.errosValidacao && r.errosValidacao.length > 0) {
      summary.errors++
      summary.errorDetails.push(
        `Linha ${r.rowNumber} (${r.nome || 'Sem Nome'}): ${r.errosValidacao.join(', ')}`,
      )
      continue
    }

    try {
      // Procura por SKU existente, ou então pelo Nome
      let match: Product | undefined
      if (r.codigo && r.codigo.trim()) {
        match = skuMap.get(r.codigo.trim().toLowerCase())
      }
      if (!match && r.nome && r.nome.trim()) {
        match = nameMap.get(r.nome.trim().toLowerCase())
      }

      const payload: Partial<Product> = {
        name: r.nome,
        sku: r.codigo || undefined,
        stock_quantity: r.quantidadeEstoque,
        price: r.precoVenda,
        active: true,
      }
      if (r.categoria) payload.category = r.categoria
      if (r.descricao) payload.description = r.descricao

      if (match) {
        // Atualiza
        const updatedRecord = await pb.collection('products').update<Product>(match.id, payload)
        summary.updated++
        // Atualiza nos maps para caso haja duplicatas no próprio arquivo
        if (updatedRecord.sku) skuMap.set(updatedRecord.sku.trim().toLowerCase(), updatedRecord)
        if (updatedRecord.name) nameMap.set(updatedRecord.name.trim().toLowerCase(), updatedRecord)
      } else {
        // Cria novo
        const createdRecord = await pb.collection('products').create<Product>(payload)
        summary.created++
        if (createdRecord.sku) skuMap.set(createdRecord.sku.trim().toLowerCase(), createdRecord)
        if (createdRecord.name) nameMap.set(createdRecord.name.trim().toLowerCase(), createdRecord)
      }
    } catch (err: unknown) {
      summary.errors++
      const msg = err instanceof Error ? err.message : String(err)
      summary.errorDetails.push(`Linha ${r.rowNumber} (${r.nome}): ${msg}`)
    }
  }

  return summary
}

/**
 * Exporta os produtos para planilha Excel (.xlsx / .xls)
 * Colunas: Código, Nome, Quantidade em Estoque, Preço de Venda
 */
export function exportProductsToExcel(products: Product[], fileName = 'produtos_estoque') {
  let totalItens = 0

  const tableRows = products
    .map((p) => {
      const sku = p.sku || '-'
      const name = p.name || ''
      const qty = p.stock_quantity ?? 0
      const price = p.price || 0

      totalItens += qty

      return `
      <tr>
        <td style="mso-number-format:'\\@'; text-align:left;">${sku}</td>
        <td style="text-align:left; font-weight:500;">${escapeHtml(name)}</td>
        <td style="text-align:center; mso-number-format:'#,##0';">${qty}</td>
        <td style="text-align:right; font-weight:bold; mso-number-format:'R$ #,##0.00';">R$ ${price.toFixed(2).replace('.', ',')}</td>
      </tr>`
    })
    .join('')

  const todayStr = new Date().toLocaleDateString('pt-BR')
  const dateFile = new Date().toISOString().substring(0, 10)

  const html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>Produtos</x:Name>
            <x:WorksheetOptions>
              <x:DisplayGridlines/>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
      body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; }
      table { border-collapse: collapse; width: 100%; }
      th { background-color: #4f46e5; color: #ffffff; font-weight: bold; text-align: left; padding: 8px 12px; border: 1px solid #cbd5e1; }
      td { padding: 6px 12px; border: 1px solid #cbd5e1; font-size: 10pt; }
      tr:nth-child(even) { background-color: #f8fafc; }
      .title { font-size: 16pt; font-weight: bold; color: #1e1b4b; padding-bottom: 4px; }
      .subtitle { font-size: 10pt; color: #64748b; padding-bottom: 12px; }
      .totals { background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #6366f1; }
    </style>
  </head>
  <body>
    <div class="title">JUCA INFORMÁTICA — Catálogo de Produtos e Estoque</div>
    <div class="subtitle">Exportação gerada em ${todayStr} | Total de ${products.length} produtos cadastrados</div>
    
    <table border="1">
      <thead>
        <tr>
          <th style="width: 120px;">Código</th>
          <th style="width: 320px;">Nome</th>
          <th style="width: 100px; text-align: center;">Quantidade em Estoque</th>
          <th style="width: 130px; text-align: right;">Preço de Venda</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr class="totals">
          <td colspan="2" style="text-align: right; font-weight: bold; font-size: 11pt;">TOTALIZADORES:</td>
          <td style="text-align: center; font-weight: bold; font-size: 11pt;">${totalItens}</td>
          <td style="text-align: right; font-weight: bold; font-size: 11pt;">—</td>
        </tr>
      </tfoot>
    </table>
  </body>
  </html>
  `

  downloadFile(`${fileName}_${dateFile}.xls`, html, 'application/vnd.ms-excel')
}

/**
 * Gera o relatório de produtos para conferência de estoque (download em formato Excel / Relatório)
 */
export function generateProductsReport(
  products: Product[],
  fileName = 'relatorio_conferencia_estoque',
) {
  let totalItens = 0
  let totalCustoEstoque = 0
  let totalVendaEstoque = 0

  const tableRows = products
    .map((p, idx) => {
      const sku = p.sku || '-'
      const name = p.name || ''
      const qty = p.stock_quantity ?? 0
      const cost = p.cost || 0
      const price = p.price || 0
      const subtotalCusto = qty * cost
      const subtotalVenda = qty * price

      totalItens += qty
      totalCustoEstoque += subtotalCusto
      totalVendaEstoque += subtotalVenda

      return `
      <tr>
        <td style="text-align:center; color:#64748b;">${idx + 1}</td>
        <td style="mso-number-format:'\\@'; text-align:left; font-family:monospace;">${sku}</td>
        <td style="text-align:left; font-weight:600;">${escapeHtml(name)}</td>
        <td style="text-align:center; font-weight:bold; background-color:#f8fafc; mso-number-format:'#,##0';">${qty}</td>
        <td style="text-align:center; color:#94a3b8;">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
        <td style="text-align:right; mso-number-format:'R$ #,##0.00';">R$ ${cost.toFixed(2).replace('.', ',')}</td>
        <td style="text-align:right; font-weight:bold; mso-number-format:'R$ #,##0.00';">R$ ${price.toFixed(2).replace('.', ',')}</td>
        <td style="text-align:right; mso-number-format:'R$ #,##0.00';">R$ ${subtotalCusto.toFixed(2).replace('.', ',')}</td>
        <td style="text-align:right; font-weight:bold; color:#047857; mso-number-format:'R$ #,##0.00';">R$ ${subtotalVenda.toFixed(2).replace('.', ',')}</td>
      </tr>`
    })
    .join('')

  const todayStr = new Date().toLocaleDateString('pt-BR')
  const dateFile = new Date().toISOString().substring(0, 10)

  const html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>Conferência de Estoque</x:Name>
            <x:WorksheetOptions>
              <x:DisplayGridlines/>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
      body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #0f172a; margin: 15px; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; }
      th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: left; padding: 8px 10px; border: 1px solid #94a3b8; font-size: 10pt; }
      td { padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 9.5pt; }
      tr:nth-child(even) { background-color: #f8fafc; }
      .header-box { border-bottom: 2px solid #475569; padding-bottom: 8px; margin-bottom: 12px; }
      .title { font-size: 16pt; font-weight: bold; color: #0f172a; }
      .subtitle { font-size: 10pt; color: #64748b; margin-top: 2px; }
      .kpi-row { margin: 12px 0; display: flex; gap: 20px; }
      .totals { background-color: #e2e8f0; font-weight: bold; border-top: 2px solid #0f172a; font-size: 10.5pt; }
    </style>
  </head>
  <body>
    <div class="header-box">
      <div class="title">JUCA INFORMÁTICA — RELATÓRIO DE CONFERÊNCIA DE ESTOQUE</div>
      <div class="subtitle">Emissão: ${todayStr} &bull; Total de Produtos: ${products.length} &bull; Quantidade Total em Estoque: ${totalItens} unidades</div>
    </div>

    <table border="1">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">Item</th>
          <th style="width: 110px;">Código (SKU)</th>
          <th style="width: 280px;">Nome do Produto</th>
          <th style="width: 90px; text-align: center;">Estoque Atual</th>
          <th style="width: 90px; text-align: center;">Contagem Física</th>
          <th style="width: 110px; text-align: right;">Preço Custo</th>
          <th style="width: 110px; text-align: right;">Preço Venda</th>
          <th style="width: 130px; text-align: right;">Total Custo</th>
          <th style="width: 140px; text-align: right;">Total Venda</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr class="totals">
          <td colspan="3" style="text-align: right; font-weight: bold;">TOTALIZADORES:</td>
          <td style="text-align: center; font-weight: bold;">${totalItens}</td>
          <td style="text-align: center;">—</td>
          <td style="text-align: right;">—</td>
          <td style="text-align: right;">—</td>
          <td style="text-align: right; font-weight: bold;">R$ ${totalCustoEstoque.toFixed(2).replace('.', ',')}</td>
          <td style="text-align: right; font-weight: bold; color: #047857;">R$ ${totalVendaEstoque.toFixed(2).replace('.', ',')}</td>
        </tr>
      </tfoot>
    </table>

    <br />
    <div style="font-size: 9pt; color: #64748b; margin-top: 20px;">
      <b>Observações para o conferente:</b> Anote a quantidade física na coluna [ Contagem Física ]. Em caso de divergência, informe à gerência para ajuste no sistema.
    </div>
  </body>
  </html>
  `

  downloadFile(`${fileName}_${dateFile}.xls`, html, 'application/vnd.ms-excel')
}

/**
 * Baixa um arquivo de modelo Excel / CSV com as colunas corretas para preenchimento
 */
export function downloadProductsTemplate() {
  const sampleData = [
    {
      codigo: 'SSD-480GB',
      nome: 'SSD Kingston A400 480GB SATA 3',
      quantidade: 15,
      preco_venda: 220.0,
      categoria: 'Armazenamento',
    },
    {
      codigo: 'MEM-8GB-DDR4',
      nome: 'Memória RAM 8GB DDR4 2666MHz Kingston Fury',
      quantidade: 20,
      preco_venda: 189.9,
      categoria: 'Memória',
    },
    {
      codigo: 'FONTE-500W',
      nome: 'Fonte ATX 500W 80 Plus Bronze PFC Ativo',
      quantidade: 8,
      preco_venda: 289.0,
      categoria: 'Fontes',
    },
    {
      codigo: 'CABO-HDMI-2M',
      nome: 'Cabo HDMI 2.0 4K Ultra HD 2 Metros',
      quantidade: 35,
      preco_venda: 35.0,
      categoria: 'Cabos e Adaptadores',
    },
  ]

  const rowsHtml = sampleData
    .map(
      (p) => `
    <tr>
      <td style="mso-number-format:'\\@';">${p.codigo}</td>
      <td>${p.nome}</td>
      <td style="text-align:center;">${p.quantidade}</td>
      <td style="text-align:right;">${p.preco_venda.toFixed(2).replace('.', ',')}</td>
      <td>${p.categoria}</td>
    </tr>`,
    )
    .join('')

  const html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <style>
      th { background-color: #4f46e5; color: #ffffff; font-weight: bold; text-align: left; padding: 8px; }
      td { padding: 6px; border: 1px solid #cbd5e1; }
    </style>
  </head>
  <body>
    <table border="1">
      <thead>
        <tr>
          <th>código</th>
          <th>nome</th>
          <th>quantidade</th>
          <th>preço_venda</th>
          <th>categoria</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
  </html>
  `

  downloadFile('modelo_importacao_produtos.xls', html, 'application/vnd.ms-excel')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
