import pb from '@/lib/pocketbase/client'
import { Customer } from '@/types'
import { downloadFile } from '@/lib/export-utils'
import { readSpreadsheetMatrix, normalizeHeader } from '@/lib/product-excel'

export interface ParsedCustomerRow {
  nome: string
  telefone: string
  email?: string
  cpf_cnpj?: string
  endereco?: string
  cidade?: string
  estado?: string
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Lê o arquivo (.xlsx, .xls ou .csv) e devolve as linhas estruturadas e validadas para Clientes
 * Colunas esperadas: nome, telefone, email, cpf/cnpj, endereco, cidade, estado
 */
export async function parseClientsFile(file: File): Promise<ParsedCustomerRow[]> {
  const rawMatrix = await readSpreadsheetMatrix(file)

  if (rawMatrix.length === 0) {
    throw new Error(
      'Não foi possível extrair dados da planilha. Certifique-se de salvar em formato .CSV ou .XLSX compatível.',
    )
  }

  let headerRowIndex = -1
  let colIndices = {
    nome: -1,
    telefone: -1,
    email: -1,
    cpf_cnpj: -1,
    endereco: -1,
    cidade: -1,
    estado: -1,
  }

  for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
    const row = rawMatrix[r]
    const normalizedRow = row.map((c) => normalizeHeader(c))

    let hasNome = false
    let hasTelefone = false
    let hasEmail = false

    row.forEach((_, colIdx) => {
      const norm = normalizedRow[colIdx]
      if (
        norm === 'nome' ||
        norm === 'cliente' ||
        norm === 'razaosocial' ||
        norm === 'nomecliente' ||
        norm === 'nomedocliente' ||
        norm === 'contato'
      ) {
        colIndices.nome = colIdx
        hasNome = true
      } else if (
        norm === 'telefone' ||
        norm === 'tel' ||
        norm === 'fone' ||
        norm === 'celular' ||
        norm === 'whatsapp' ||
        norm === 'cel' ||
        norm === 'contatofone'
      ) {
        colIndices.telefone = colIdx
        hasTelefone = true
      } else if (
        norm === 'email' ||
        norm === 'mail' ||
        norm === 'correioeletronico' ||
        norm === 'e-mail'
      ) {
        colIndices.email = colIdx
        hasEmail = true
      } else if (
        norm === 'cpfcnpj' ||
        norm === 'cpf' ||
        norm === 'cnpj' ||
        norm === 'documento' ||
        norm === 'cpfoucnpj' ||
        norm === 'doc'
      ) {
        colIndices.cpf_cnpj = colIdx
      } else if (
        norm === 'endereco' ||
        norm === 'rua' ||
        norm === 'logradouro' ||
        norm === 'enderecocompleto' ||
        norm === 'bairro'
      ) {
        colIndices.endereco = colIdx
      } else if (norm === 'cidade' || norm === 'municipio') {
        colIndices.cidade = colIdx
      } else if (norm === 'estado' || norm === 'uf') {
        colIndices.estado = colIdx
      }
    })

    if ((hasNome || hasTelefone) && (hasEmail || colIndices.cpf_cnpj !== -1 || row.length >= 2)) {
      headerRowIndex = r
      break
    }
  }

  // Fallback se não detectou cabeçalho clássico:
  // [0] Nome, [1] Telefone, [2] Email, [3] CPF/CNPJ, [4] Endereço, [5] Cidade, [6] Estado
  if (headerRowIndex === -1) {
    headerRowIndex = 0
    colIndices = {
      nome: 0,
      telefone: 1,
      email: 2,
      cpf_cnpj: 3,
      endereco: 4,
      cidade: 5,
      estado: 6,
    }
  } else {
    if (colIndices.nome === -1) colIndices.nome = 0
    if (colIndices.telefone === -1 && colIndices.nome !== 1) colIndices.telefone = 1
  }

  const parsedRows: ParsedCustomerRow[] = []

  for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
    const row = rawMatrix[i]
    if (!row || row.length === 0 || row.every((cell) => !cell.trim())) continue

    const nome = colIndices.nome >= 0 ? (row[colIndices.nome] || '').trim() : ''
    const telefone = colIndices.telefone >= 0 ? (row[colIndices.telefone] || '').trim() : ''
    const email = colIndices.email >= 0 ? (row[colIndices.email] || '').trim() : ''
    const cpf_cnpj = colIndices.cpf_cnpj >= 0 ? (row[colIndices.cpf_cnpj] || '').trim() : ''
    const endereco = colIndices.endereco >= 0 ? (row[colIndices.endereco] || '').trim() : ''
    const cidade = colIndices.cidade >= 0 ? (row[colIndices.cidade] || '').trim() : ''
    const estado = colIndices.estado >= 0 ? (row[colIndices.estado] || '').trim() : ''

    const erros: string[] = []

    if (!nome && !telefone && !email) {
      continue
    }

    if (!nome) {
      erros.push('Nome do cliente é obrigatório.')
    }
    if (!telefone) {
      erros.push('Telefone do cliente é obrigatório.')
    }

    parsedRows.push({
      nome: nome || 'Cliente Sem Nome',
      telefone: telefone || '-',
      email: email || undefined,
      cpf_cnpj: cpf_cnpj || undefined,
      endereco: endereco || undefined,
      cidade: cidade || undefined,
      estado: estado || undefined,
      rowNumber: i + 1,
      statusValido: erros.length === 0,
      errosValidacao: erros.length > 0 ? erros : undefined,
    })
  }

  return parsedRows
}

/**
 * Importa/atualiza clientes no PocketBase em lote
 * Atualiza clientes existentes (pelo nome ou email) ou cria novos
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

  const nameMap = new Map<string, Customer>()
  const emailMap = new Map<string, Customer>()

  existingCustomers.forEach((c) => {
    if (c.name && c.name.trim()) {
      nameMap.set(c.name.trim().toLowerCase(), c)
    }
    if (c.email && c.email.trim()) {
      emailMap.set(c.email.trim().toLowerCase(), c)
    }
  })

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
      // Busca cliente existente por email ou nome
      let match: Customer | undefined
      if (r.email && r.email.trim()) {
        match = emailMap.get(r.email.trim().toLowerCase())
      }
      if (!match && r.nome && r.nome.trim()) {
        match = nameMap.get(r.nome.trim().toLowerCase())
      }

      const payload: Partial<Customer> = {
        name: r.nome,
        phone: r.telefone,
      }
      if (r.email) payload.email = r.email
      if (r.cpf_cnpj) payload.cpf_cnpj = r.cpf_cnpj
      if (r.endereco) payload.street = r.endereco
      if (r.cidade) payload.city = r.cidade
      if (r.estado) payload.state = r.estado

      if (match) {
        const updated = await pb.collection('customers').update<Customer>(match.id, payload)
        summary.updated++
        if (updated.name) nameMap.set(updated.name.trim().toLowerCase(), updated)
        if (updated.email) emailMap.set(updated.email.trim().toLowerCase(), updated)
      } else {
        const created = await pb.collection('customers').create<Customer>(payload)
        summary.created++
        if (created.name) nameMap.set(created.name.trim().toLowerCase(), created)
        if (created.email) emailMap.set(created.email.trim().toLowerCase(), created)
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
 * Exporta os clientes para planilha Excel (.xlsx / .xls)
 * Colunas: Nome, Telefone, Email, CPF/CNPJ, Endereço, Cidade, Estado
 * Linha de totalizadores no rodapé (total de clientes)
 */
export function exportClientsToExcel(customers: Customer[], fileName = 'clientes') {
  const tableRows = customers
    .map((c) => {
      const name = c.name || ''
      const phone = c.phone || '-'
      const email = c.email || '-'
      const cpfCnpj = c.cpf_cnpj || '-'
      const street = c.street ? `${c.street}${c.number ? ', ' + c.number : ''}` : '-'
      const city = c.city || '-'
      const state = c.state || '-'

      return `
      <tr>
        <td style="text-align:left; font-weight:600;">${escapeHtml(name)}</td>
        <td style="mso-number-format:'\\@'; text-align:left;">${escapeHtml(phone)}</td>
        <td style="text-align:left;">${escapeHtml(email)}</td>
        <td style="mso-number-format:'\\@'; text-align:left;">${escapeHtml(cpfCnpj)}</td>
        <td style="text-align:left;">${escapeHtml(street)}</td>
        <td style="text-align:left;">${escapeHtml(city)}</td>
        <td style="text-align:center;">${escapeHtml(state)}</td>
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
            <x:Name>Clientes</x:Name>
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
    <div class="title">JUCA INFORMÁTICA — Cadastro de Clientes</div>
    <div class="subtitle">Exportação gerada em ${todayStr} | Total de ${customers.length} clientes cadastrados</div>
    
    <table border="1">
      <thead>
        <tr>
          <th style="width: 250px;">Nome</th>
          <th style="width: 140px;">Telefone</th>
          <th style="width: 200px;">Email</th>
          <th style="width: 150px;">CPF/CNPJ</th>
          <th style="width: 240px;">Endereço</th>
          <th style="width: 140px;">Cidade</th>
          <th style="width: 80px; text-align: center;">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr class="totals">
          <td style="text-align: right; font-weight: bold; font-size: 11pt;">TOTAL DE CLIENTES:</td>
          <td colspan="6" style="text-align: left; font-weight: bold; font-size: 11pt; color: #4f46e5;">${customers.length} cliente(s) cadastrado(s)</td>
        </tr>
      </tfoot>
    </table>
  </body>
  </html>
  `

  downloadFile(`${fileName}_${dateFile}.xls`, html, 'application/vnd.ms-excel')
}

/**
 * Baixa um arquivo de modelo Excel / CSV com as colunas corretas para preenchimento de clientes
 */
export function downloadClientsTemplate() {
  const sampleData = [
    {
      nome: 'João Silva',
      telefone: '(11) 98765-4321',
      email: 'joao.silva@exemplo.com',
      cpf_cnpj: '123.456.789-00',
      endereco: 'Rua das Flores, 120',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    {
      nome: 'Empresa Alpha Tecnologia Ltda',
      telefone: '(11) 3344-5566',
      email: 'contato@alphatec.com.br',
      cpf_cnpj: '12.345.678/0001-90',
      endereco: 'Av. Paulista, 1000 - Cj 52',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    {
      nome: 'Maria Oliveira',
      telefone: '(21) 99887-7665',
      email: 'maria.oliveira@gmail.com',
      cpf_cnpj: '987.654.321-11',
      endereco: 'Rua Copacabana, 500',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
    },
  ]

  const rowsHtml = sampleData
    .map(
      (c) => `
    <tr>
      <td style="font-weight: 500;">${c.nome}</td>
      <td style="mso-number-format:'\\@';">${c.telefone}</td>
      <td>${c.email}</td>
      <td style="mso-number-format:'\\@';">${c.cpf_cnpj}</td>
      <td>${c.endereco}</td>
      <td>${c.cidade}</td>
      <td style="text-align: center;">${c.estado}</td>
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
          <th>nome</th>
          <th>telefone</th>
          <th>email</th>
          <th>cpf_cnpj</th>
          <th>endereco</th>
          <th>cidade</th>
          <th>estado</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
  </html>
  `

  downloadFile('modelo_importacao_clientes.xls', html, 'application/vnd.ms-excel')
}
