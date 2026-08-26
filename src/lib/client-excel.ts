import pb from '@/lib/pocketbase/client'
import { Customer } from '@/types'
import { readSpreadsheetMatrix, normalizeHeader } from '@/lib/product-excel'
import * as XLSX from 'xlsx'

/**
 * Estrutura da planilha de clientes (7 colunas exatas):
 * 1. Razão Social
 * 2. Nome Fantasia
 * 3. Endereço
 * 4. Bairro
 * 5. Celular
 * 6. RG/IE
 * 7. CPF/CNPJ
 */
export interface ParsedCustomerRow {
  razao_social: string
  nome_fantasia: string
  endereco: string
  bairro: string
  celular: string
  rg_ie: string
  cpf_cnpj: string
  rowNumber: number
  statusValido: boolean
  errosValidacao?: string[]
}

export interface ImportClientsSummary {
  created: number
  updated: number
  errors: number
  errorDetails: string[]
  totalProcessed: number
}

/**
 * Lê o arquivo (.xlsx, .xls ou .csv) e devolve as linhas estruturadas e validadas
 * com as 7 colunas exatas da planilha do Rafael.
 */
/**
 * Extrai dados tabulares de arquivo HTML ou XML com tratamento detalhado para múltiplos elementos <table>
 */
export function extractTablesFromHTML(htmlContent: string): string[][] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')
  const tables = Array.from(doc.querySelectorAll('table'))

  if (tables.length === 0) {
    // Tenta verificar se há tags XML de planilha (ex: SpreadsheetML / Excel XML)
    const xmlDoc = parser.parseFromString(htmlContent, 'text/xml')
    const xmlRows = Array.from(xmlDoc.querySelectorAll('Row, row'))
    if (xmlRows.length > 0) {
      const matrix: string[][] = []
      xmlRows.forEach((r) => {
        const row: string[] = []
        const cells = Array.from(r.querySelectorAll('Cell, cell, c, Data, data'))
        cells.forEach((c) => {
          row.push(c.textContent?.trim() || '')
        })
        if (row.length > 0 && row.some((c) => c.length > 0)) {
          matrix.push(row)
        }
      })
      if (matrix.length > 0) return matrix
    }
    return []
  }

  // Se houver tabelas, seleciona a que tiver mais linhas com dados
  let bestTableRows: string[][] = []

  for (const table of tables) {
    const tableRows: string[][] = []
    const trElements = Array.from(table.querySelectorAll('tr'))

    trElements.forEach((tr) => {
      const row: string[] = []
      const cells = Array.from(tr.querySelectorAll('th, td'))
      cells.forEach((cell) => {
        // Trata quebras de linha e múltiplos espaços
        const text = (cell.textContent || '')
          .replace(/[\r\n\t]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
        row.push(text)
      })
      if (row.length > 0 && row.some((c) => c.length > 0)) {
        tableRows.push(row)
      }
    })

    if (tableRows.length > bestTableRows.length) {
      bestTableRows = tableRows
    }
  }

  return bestTableRows
}

/**
 * Lê o arquivo (.xlsx, .xls, .csv ou .html) e devolve as linhas estruturadas e validadas
 * com as 7 colunas exatas da planilha.
 */
export async function parseClientsFile(file: File): Promise<ParsedCustomerRow[]> {
  const isHtml =
    file.name.toLowerCase().endsWith('.html') ||
    file.name.toLowerCase().endsWith('.htm') ||
    file.type.includes('html')

  let rawMatrix: string[][] = []

  if (isHtml) {
    try {
      const text = await file.text()
      rawMatrix = extractTablesFromHTML(text)

      if (rawMatrix.length === 0) {
        // Tenta fallback com SheetJS para o HTML
        try {
          const arrayBuffer = await file.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: false })
          const firstSheet = workbook.SheetNames[0]
          if (firstSheet) {
            const worksheet = workbook.Sheets[firstSheet]
            if (worksheet) {
              const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
                header: 1,
                raw: false,
                defval: '',
              })
              rawMatrix = rows
                .map((r) =>
                  Array.isArray(r)
                    ? r.map((c) => (c === null || c === undefined ? '' : String(c).trim()))
                    : [],
                )
                .filter((r) => r.some((c) => c.length > 0))
            }
          }
        } catch {
          // ignore
        }
      }

      if (rawMatrix.length === 0) {
        throw new Error(
          'O arquivo HTML enviado não contém nenhuma tabela de dados <table>. Certifique-se de que o arquivo contenha uma tabela válida com os clientes.',
        )
      }
    } catch (err) {
      if (err instanceof Error) {
        throw err
      }
      throw new Error(
        'O arquivo HTML enviado não pôde ser lido ou não contém tabela <table> de clientes.',
      )
    }
  } else {
    rawMatrix = await readSpreadsheetMatrix(file)
  }

  if (rawMatrix.length === 0) {
    throw new Error(
      'Não foi possível extrair dados da planilha. Certifique-se de salvar em formato .XLSX, .XLS, .CSV ou .HTML válido.',
    )
  }

  let headerRowIndex = -1
  const colIndices = {
    razao_social: -1,
    nome_fantasia: -1,
    endereco: -1,
    bairro: -1,
    celular: -1,
    rg_ie: -1,
    cpf_cnpj: -1,
  }

  // Percorre as 10 primeiras linhas para encontrar cabeçalhos com variações
  for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
    const row = rawMatrix[r]
    const normalizedRow = row.map((c) => normalizeHeader(c))

    let foundAny = false

    row.forEach((_, colIdx) => {
      const norm = normalizedRow[colIdx]

      // Razão Social: razao_social, razão social, razao social, razaosocial, empresa, cliente, nome
      if (
        norm === 'razaosocial' ||
        norm === 'razao_social' ||
        norm === 'razaosoc' ||
        norm === 'razaos' ||
        norm === 'clienterazaosocial' ||
        norm === 'empresa' ||
        norm === 'cliente' ||
        norm === 'nome' ||
        norm === 'nomedocliente' ||
        norm === 'razao'
      ) {
        colIndices.razao_social = colIdx
        foundAny = true
      }
      // Nome Fantasia: nome_fantasia, nome fantasia, nomefantasia, fantasia, comercial
      else if (
        norm === 'nomefantasia' ||
        norm === 'nome_fantasia' ||
        norm === 'fantasia' ||
        norm === 'nomecomercial' ||
        norm === 'apelido' ||
        norm === 'titulocomercial'
      ) {
        colIndices.nome_fantasia = colIdx
        foundAny = true
      }
      // Endereço: endereco, endereço, endereco, logradouro, rua, logradouro/rua, localizacao
      else if (
        norm === 'endereco' ||
        norm === 'endereço' ||
        norm === 'rua' ||
        norm === 'logradouro' ||
        norm === 'enderecocompleto' ||
        norm === 'end' ||
        norm === 'morada' ||
        norm === 'localizacao'
      ) {
        colIndices.endereco = colIdx
        foundAny = true
      }
      // Bairro: bairro, dist, distrito, regiao, localidade
      else if (
        norm === 'bairro' ||
        norm === 'bairros' ||
        norm === 'dist' ||
        norm === 'distrito' ||
        norm === 'bairrolocalidade'
      ) {
        colIndices.bairro = colIdx
        foundAny = true
      }
      // Celular: celular, telefone, fone, tel, cel, whatsapp, contatofone, telefone/celular, fone1, fone2
      else if (
        norm === 'celular' ||
        norm === 'telefone' ||
        norm === 'fone' ||
        norm === 'tel' ||
        norm === 'cel' ||
        norm === 'whatsapp' ||
        norm === 'whats' ||
        norm === 'zap' ||
        norm === 'contatofone' ||
        norm === 'telefones' ||
        norm === 'telefonecelular' ||
        norm === 'celulartelefone' ||
        norm === 'telcel' ||
        norm === 'contato' ||
        norm === 'telefone1' ||
        norm === 'celular1'
      ) {
        colIndices.celular = colIdx
        foundAny = true
      }
      // RG/IE: rg/ie, rg_ie, rgie, rg, ie, inscricaoestadual, inscr_estadual, ident, inscr estadual
      else if (
        norm === 'rgie' ||
        norm === 'rg_ie' ||
        norm === 'rg' ||
        norm === 'ie' ||
        norm === 'rgouinscricao' ||
        norm === 'inscricaoestadual' ||
        norm === 'inscricao' ||
        norm === 'inscr_estadual' ||
        norm === 'inscrest' ||
        norm === 'inscr' ||
        norm === 'identidade' ||
        norm === 'documentorg'
      ) {
        colIndices.rg_ie = colIdx
        foundAny = true
      }
      // CPF/CNPJ: cpf/cnpj, cpf_cnpj, cpfcnpj, cpf, cnpj, documento, doc, cpf / cnpj
      else if (
        norm === 'cpfcnpj' ||
        norm === 'cpf_cnpj' ||
        norm === 'cpf' ||
        norm === 'cnpj' ||
        norm === 'documento' ||
        norm === 'documentos' ||
        norm === 'doc' ||
        norm === 'cpfoucnpj' ||
        norm === 'cnpjcpf' ||
        norm === 'cnpjocpf' ||
        norm === 'numdocumento' ||
        norm === 'numerodocumento'
      ) {
        colIndices.cpf_cnpj = colIdx
        foundAny = true
      }
    })

    if (
      foundAny &&
      (colIndices.razao_social !== -1 ||
        colIndices.nome_fantasia !== -1 ||
        colIndices.celular !== -1 ||
        colIndices.cpf_cnpj !== -1)
    ) {
      headerRowIndex = r
      break
    }
  }

  // Fallback se não detectou cabeçalho clássico: ordem exata da planilha do Rafael
  // 0: Razão Social | 1: Nome Fantasia | 2: Endereço | 3: Bairro | 4: Celular | 5: RG/IE | 6: CPF/CNPJ
  if (headerRowIndex === -1) {
    headerRowIndex = 0
    colIndices.razao_social = 0
    colIndices.nome_fantasia = 1
    colIndices.endereco = 2
    colIndices.bairro = 3
    colIndices.celular = 4
    colIndices.rg_ie = 5
    colIndices.cpf_cnpj = 6
  } else {
    // Se achou cabeçalho mas faltou algum mapeamento básico
    if (colIndices.razao_social === -1 && colIndices.nome_fantasia === -1) {
      colIndices.razao_social = 0
    }
  }

  const parsedRows: ParsedCustomerRow[] = []

  for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
    const row = rawMatrix[i]
    if (!row || row.length === 0 || row.every((cell) => !String(cell || '').trim())) continue

    const razao_social =
      colIndices.razao_social >= 0 ? String(row[colIndices.razao_social] || '').trim() : ''
    const nome_fantasia =
      colIndices.nome_fantasia >= 0 ? String(row[colIndices.nome_fantasia] || '').trim() : ''
    const endereco = colIndices.endereco >= 0 ? String(row[colIndices.endereco] || '').trim() : ''
    const bairro = colIndices.bairro >= 0 ? String(row[colIndices.bairro] || '').trim() : ''
    const celular = colIndices.celular >= 0 ? String(row[colIndices.celular] || '').trim() : ''
    const rg_ie = colIndices.rg_ie >= 0 ? String(row[colIndices.rg_ie] || '').trim() : ''
    const cpf_cnpj = colIndices.cpf_cnpj >= 0 ? String(row[colIndices.cpf_cnpj] || '').trim() : ''

    // Se a linha estiver totalmente vazia
    if (!razao_social && !nome_fantasia && !celular && !cpf_cnpj && !endereco) {
      continue
    }

    const erros: string[] = []

    if (!razao_social && !nome_fantasia) {
      erros.push('Razão Social ou Nome Fantasia é obrigatório.')
    }

    parsedRows.push({
      razao_social: razao_social || nome_fantasia,
      nome_fantasia: nome_fantasia || razao_social,
      endereco,
      bairro,
      celular,
      rg_ie,
      cpf_cnpj,
      rowNumber: i + 1,
      statusValido: erros.length === 0,
      errosValidacao: erros.length > 0 ? erros : undefined,
    })
  }

  return parsedRows
}

/**
 * Importa e atualiza clientes no PocketBase em lote
 * Reconhece clientes existentes por CPF/CNPJ, Razão Social ou Nome Fantasia
 */
export async function importClientsData(
  rows: ParsedCustomerRow[],
  onProgress?: (current: number, total: number) => void,
): Promise<ImportClientsSummary> {
  const summary: ImportClientsSummary = {
    created: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
    totalProcessed: rows.length,
  }

  let existingCustomers: Customer[] = []
  try {
    existingCustomers = await pb.collection('customers').getFullList<Customer>({
      sort: '-created',
    })
  } catch (e) {
    console.error('Erro ao buscar clientes existentes:', e)
  }

  const docMap = new Map<string, Customer>()
  const razaoMap = new Map<string, Customer>()
  const fantasiaMap = new Map<string, Customer>()
  const nameMap = new Map<string, Customer>()

  const cleanDoc = (doc?: string) => (doc || '').replace(/\D/g, '')

  existingCustomers.forEach((c) => {
    const d = cleanDoc(c.cpf_cnpj)
    if (d) docMap.set(d, c)
    if (c.razao_social?.trim()) razaoMap.set(c.razao_social.trim().toLowerCase(), c)
    if (c.nome_fantasia?.trim()) fantasiaMap.set(c.nome_fantasia.trim().toLowerCase(), c)
    if (c.name?.trim()) nameMap.set(c.name.trim().toLowerCase(), c)
  })

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]

    if (onProgress) {
      onProgress(i + 1, rows.length)
    }

    if (!r.statusValido && r.errosValidacao && r.errosValidacao.length > 0) {
      summary.errors++
      summary.errorDetails.push(
        `Linha ${r.rowNumber} (${r.razao_social || r.nome_fantasia || 'Sem Nome'}): ${r.errosValidacao.join(', ')}`,
      )
      continue
    }

    try {
      let match: Customer | undefined
      const rowDoc = cleanDoc(r.cpf_cnpj)
      if (rowDoc && docMap.has(rowDoc)) {
        match = docMap.get(rowDoc)
      }
      if (!match && r.razao_social?.trim() && razaoMap.has(r.razao_social.trim().toLowerCase())) {
        match = razaoMap.get(r.razao_social.trim().toLowerCase())
      }
      if (
        !match &&
        r.nome_fantasia?.trim() &&
        fantasiaMap.has(r.nome_fantasia.trim().toLowerCase())
      ) {
        match = fantasiaMap.get(r.nome_fantasia.trim().toLowerCase())
      }
      if (!match && r.razao_social?.trim() && nameMap.has(r.razao_social.trim().toLowerCase())) {
        match = nameMap.get(r.razao_social.trim().toLowerCase())
      }

      const mainName = r.razao_social || r.nome_fantasia || 'Cliente'

      const payload: Partial<Customer> = {
        razao_social: r.razao_social,
        nome_fantasia: r.nome_fantasia,
        endereco: r.endereco,
        bairro: r.bairro,
        celular: r.celular,
        rg_ie: r.rg_ie,
        cpf_cnpj: r.cpf_cnpj,
        // Compatibilidade legada
        name: mainName,
        phone: r.celular || '',
        street: r.endereco || '',
      }

      if (match) {
        const updated = await pb.collection('customers').update<Customer>(match.id, payload)
        summary.updated++
        const uDoc = cleanDoc(updated.cpf_cnpj)
        if (uDoc) docMap.set(uDoc, updated)
        if (updated.razao_social?.trim())
          razaoMap.set(updated.razao_social.trim().toLowerCase(), updated)
        if (updated.nome_fantasia?.trim())
          fantasiaMap.set(updated.nome_fantasia.trim().toLowerCase(), updated)
        if (updated.name?.trim()) nameMap.set(updated.name.trim().toLowerCase(), updated)
      } else {
        const created = await pb.collection('customers').create<Customer>(payload)
        summary.created++
        const cDoc = cleanDoc(created.cpf_cnpj)
        if (cDoc) docMap.set(cDoc, created)
        if (created.razao_social?.trim())
          razaoMap.set(created.razao_social.trim().toLowerCase(), created)
        if (created.nome_fantasia?.trim())
          fantasiaMap.set(created.nome_fantasia.trim().toLowerCase(), created)
        if (created.name?.trim()) nameMap.set(created.name.trim().toLowerCase(), created)
      }
    } catch (err: unknown) {
      summary.errors++
      const msg = err instanceof Error ? err.message : String(err)
      summary.errorDetails.push(
        `Linha ${r.rowNumber} (${r.razao_social || r.nome_fantasia}): ${msg}`,
      )
    }
  }

  return summary
}

/**
 * Exporta os clientes para planilha Excel (.xlsx) na ordem exata solicitada:
 * 1. Razão Social
 * 2. Nome Fantasia
 * 3. Endereço
 * 4. Bairro
 * 5. Celular
 * 6. RG/IE
 * 7. CPF/CNPJ
 * Nome padrão do arquivo: "clientes.xlsx"
 */
export function exportClientsToExcel(customers: Customer[], fileName = 'clientes.xlsx') {
  // Cria dados estruturados com cabeçalhos exatos
  const data = customers.map((c) => ({
    'Razão Social': c.razao_social || c.name || '',
    'Nome Fantasia': c.nome_fantasia || c.razao_social || c.name || '',
    Endereço: c.endereco || c.street || '',
    Bairro: c.bairro || '',
    Celular: c.celular || c.phone || '',
    'RG/IE': c.rg_ie || '',
    'CPF/CNPJ': c.cpf_cnpj || '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: ['Razão Social', 'Nome Fantasia', 'Endereço', 'Bairro', 'Celular', 'RG/IE', 'CPF/CNPJ'],
  })

  // Ajusta larguras de coluna
  worksheet['!cols'] = [
    { wch: 32 }, // Razão Social
    { wch: 28 }, // Nome Fantasia
    { wch: 35 }, // Endereço
    { wch: 20 }, // Bairro
    { wch: 18 }, // Celular
    { wch: 16 }, // RG/IE
    { wch: 20 }, // CPF/CNPJ
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes')

  const finalName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  XLSX.writeFile(workbook, finalName)
}

/**
 * Baixa um arquivo de modelo Excel (.xlsx) com as 7 colunas exatas para importação
 */
export function downloadClientsTemplate() {
  const sampleData = [
    {
      'Razão Social': 'SILVA E SANTOS TECNOLOGIA LTDA',
      'Nome Fantasia': 'SILVA TECH INFORMÁTICA',
      Endereço: 'Rua das Flores, 120',
      Bairro: 'Centro',
      Celular: '(11) 98765-4321',
      'RG/IE': '123.456.789.000',
      'CPF/CNPJ': '12.345.678/0001-90',
    },
    {
      'Razão Social': 'JOAO DA SILVA 12345678900',
      'Nome Fantasia': 'JOÃO DA SILVA',
      Endereço: 'Av. Paulista, 1000 - Apto 52',
      Bairro: 'Bela Vista',
      Celular: '(11) 99887-7665',
      'RG/IE': '28.123.456-7',
      'CPF/CNPJ': '123.456.789-00',
    },
    {
      'Razão Social': 'MARIA OLIVEIRA COMÉRCIO ME',
      'Nome Fantasia': 'M&O ASSISTÊNCIA',
      Endereço: 'Rua Copacabana, 500',
      Bairro: 'Jardim América',
      Celular: '(21) 99123-4567',
      'RG/IE': 'ISENTO',
      'CPF/CNPJ': '98.765.432/0001-11',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
    header: ['Razão Social', 'Nome Fantasia', 'Endereço', 'Bairro', 'Celular', 'RG/IE', 'CPF/CNPJ'],
  })

  worksheet['!cols'] = [
    { wch: 32 },
    { wch: 28 },
    { wch: 35 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo Clientes')

  XLSX.writeFile(workbook, 'modelo_importacao_clientes.xlsx')
}
