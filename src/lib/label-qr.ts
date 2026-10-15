/**
 * Gerador de QR Code limpo e autocontido (ISO/IEC 18004) em TypeScript sem dependências externas.
 * Suporta codificação Byte (UTF-8/ASCII) com níveis de correção de erro L e M.
 * Retorna matriz booleana (true = módulo preto, false = branco).
 */

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

// Tabela de blocos por versão (Versões 1 a 10 cobrem URLs normais de até ~270 caracteres)
interface VersionInfo {
  version: number
  totalCodewords: number
  ecCodewords: number // por bloco
  blocksGroup1: number
  dataCodewordsGroup1: number
  blocksGroup2: number
  dataCodewordsGroup2: number
}

// Configuração para Nível M (15% de recuperação - ideal para etiquetas térmicas e câmeras de celulares)
const VERSION_TABLE_M: VersionInfo[] = [
  {
    version: 1,
    totalCodewords: 26,
    ecCodewords: 10,
    blocksGroup1: 1,
    dataCodewordsGroup1: 16,
    blocksGroup2: 0,
    dataCodewordsGroup2: 0,
  },
  {
    version: 2,
    totalCodewords: 44,
    ecCodewords: 16,
    blocksGroup1: 1,
    dataCodewordsGroup1: 28,
    blocksGroup2: 0,
    dataCodewordsGroup2: 0,
  },
  {
    version: 3,
    totalCodewords: 70,
    ecCodewords: 26,
    blocksGroup1: 1,
    dataCodewordsGroup1: 44,
    blocksGroup2: 0,
    dataCodewordsGroup2: 0,
  },
  {
    version: 4,
    totalCodewords: 100,
    ecCodewords: 18,
    blocksGroup1: 2,
    dataCodewordsGroup1: 32,
    blocksGroup2: 0,
    dataCodewordsGroup2: 0,
  },
  {
    version: 5,
    totalCodewords: 134,
    ecCodewords: 24,
    blocksGroup1: 2,
    dataCodewordsGroup1: 43,
    blocksGroup2: 0,
    dataCodewordsGroup2: 0,
  },
  {
    version: 6,
    totalCodewords: 172,
    ecCodewords: 16,
    blocksGroup1: 4,
    dataCodewordsGroup1: 27,
    blocksGroup2: 0,
    dataCodewordsGroup2: 0,
  },
  {
    version: 7,
    totalCodewords: 196,
    ecCodewords: 18,
    blocksGroup1: 4,
    dataCodewordsGroup1: 31,
    blocksGroup2: 0,
    dataCodewordsGroup2: 0,
  },
  {
    version: 8,
    totalCodewords: 242,
    ecCodewords: 22,
    blocksGroup1: 2,
    dataCodewordsGroup1: 38,
    blocksGroup2: 2,
    dataCodewordsGroup2: 39,
  },
  {
    version: 9,
    totalCodewords: 292,
    ecCodewords: 22,
    blocksGroup1: 3,
    dataCodewordsGroup1: 36,
    blocksGroup2: 2,
    dataCodewordsGroup2: 37,
  },
  {
    version: 10,
    totalCodewords: 346,
    ecCodewords: 26,
    blocksGroup1: 4,
    dataCodewordsGroup1: 43,
    blocksGroup2: 1,
    dataCodewordsGroup2: 44,
  },
]

// Galois Field GF(256) com polinômio primitivo 0x11D (285)
const EXP_TABLE = new Uint8Array(512)
const LOG_TABLE = new Uint8Array(256)

;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x
    LOG_TABLE[x] = i
    x <<= 1
    if (x >= 256) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255]
  }
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]]
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0)
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j])
    }
  }
  return result
}

function getGeneratorPoly(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP_TABLE[i]])
  }
  return poly
}

function calculateReedSolomon(data: number[], ecCount: number): number[] {
  const genPoly = getGeneratorPoly(ecCount)
  const remainder = [...data, ...new Array(ecCount).fill(0)]
  for (let i = 0; i < data.length; i++) {
    const lead = remainder[i]
    if (lead !== 0) {
      for (let j = 0; j < genPoly.length; j++) {
        remainder[i + j] ^= gfMul(genPoly[j], lead)
      }
    }
  }
  return remainder.slice(data.length)
}

// Alignment pattern locations para versões 2 a 10
const ALIGNMENT_PATTERN_LOCATIONS: Record<number, number[]> = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
}

/**
 * Cria matriz binária booleana (true = preto) do QR Code para um texto de URL/identificador.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const utf8Bytes = new TextEncoder().encode(text)
  const byteCount = utf8Bytes.length

  // Escolhe a menor versão compatível no nível M
  let chosenVersion: VersionInfo | null = null
  for (const v of VERSION_TABLE_M) {
    const maxDataBytes =
      v.blocksGroup1 * v.dataCodewordsGroup1 + v.blocksGroup2 * v.dataCodewordsGroup2
    // Modo byte precisa de 4 bits de indicador de modo + 8/16 bits de contagem
    const headerBits = 4 + (v.version < 10 ? 8 : 16)
    const requiredBits = headerBits + byteCount * 8
    if (requiredBits <= maxDataBytes * 8) {
      chosenVersion = v
      break
    }
  }

  if (!chosenVersion) {
    throw new Error('Conteúdo muito longo para gerar QR Code nesta etiqueta.')
  }

  const { version } = chosenVersion
  const totalDataCodewords =
    chosenVersion.blocksGroup1 * chosenVersion.dataCodewordsGroup1 +
    chosenVersion.blocksGroup2 * chosenVersion.dataCodewordsGroup2

  // Monta fluxo de bits (Modo Byte = 0100)
  const bitStream: number[] = []
  const pushBits = (val: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1)
    }
  }

  // 1. Indicador de modo (Byte = 4 = 0100)
  pushBits(0b0100, 4)

  // 2. Contagem de caracteres (8 bits para versão 1-9, 16 para versão 10+)
  pushBits(byteCount, version < 10 ? 8 : 16)

  // 3. Bytes de dados
  for (let i = 0; i < byteCount; i++) {
    pushBits(utf8Bytes[i], 8)
  }

  // 4. Terminador (até 4 zeros)
  const remainingBits = totalDataCodewords * 8 - bitStream.length
  const terminatorLength = Math.min(4, Math.max(0, remainingBits))
  pushBits(0, terminatorLength)

  // 5. Alinhamento em byte
  while (bitStream.length % 8 !== 0) {
    bitStream.push(0)
  }

  // 6. Preenchimento alternado (0xEC, 0x11)
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (bitStream.length < totalDataCodewords * 8) {
    pushBits(padBytes[padIdx % 2], 8)
    padIdx++
  }

  // Converte bits em codewords
  const dataCodewords: number[] = []
  for (let i = 0; i < bitStream.length; i += 8) {
    let byte = 0
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitStream[i + b]
    }
    dataCodewords.push(byte)
  }

  // Divide dados em blocos e calcula Reed-Solomon para cada bloco
  const blocksData: number[][] = []
  const blocksEc: number[][] = []
  let offset = 0

  for (let b = 0; b < chosenVersion.blocksGroup1; b++) {
    const slice = dataCodewords.slice(offset, offset + chosenVersion.dataCodewordsGroup1)
    offset += chosenVersion.dataCodewordsGroup1
    blocksData.push(slice)
    blocksEc.push(calculateReedSolomon(slice, chosenVersion.ecCodewords))
  }

  for (let b = 0; b < chosenVersion.blocksGroup2; b++) {
    const slice = dataCodewords.slice(offset, offset + chosenVersion.dataCodewordsGroup2)
    offset += chosenVersion.dataCodewordsGroup2
    blocksData.push(slice)
    blocksEc.push(calculateReedSolomon(slice, chosenVersion.ecCodewords))
  }

  // Interleaving dos dados
  const finalCodewords: number[] = []
  const maxDataBlockLen = Math.max(...blocksData.map((b) => b.length))
  for (let col = 0; col < maxDataBlockLen; col++) {
    for (let b = 0; b < blocksData.length; b++) {
      if (col < blocksData[b].length) {
        finalCodewords.push(blocksData[b][col])
      }
    }
  }

  // Interleaving da correção de erro
  for (let col = 0; col < chosenVersion.ecCodewords; col++) {
    for (let b = 0; b < blocksEc.length; b++) {
      finalCodewords.push(blocksEc[b][col])
    }
  }

  // Monta matriz do símbolo QR
  const size = 17 + version * 4
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null))
  const isFunctionModule: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // Padrões de localização (Finder patterns 7x7) nos cantos sup. esquerdo, sup. direito e inf. esquerdo
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r
        const nc = col + c
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          isFunctionModule[nr][nc] = true
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6
            const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
            matrix[nr][nc] = isBorder || isInner
          } else {
            matrix[nr][nc] = false // Separador
          }
        }
      }
    }
  }

  placeFinder(0, 0)
  placeFinder(0, size - 7)
  placeFinder(size - 7, 0)

  // Padrões de alinhamento (para versão >= 2)
  if (version >= 2 && ALIGNMENT_PATTERN_LOCATIONS[version]) {
    const coords = ALIGNMENT_PATTERN_LOCATIONS[version]
    for (const r of coords) {
      for (const c of coords) {
        // Pula se sobrepõe a um finder pattern
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === coords[coords.length - 1]) ||
          (r === coords[coords.length - 1] && c === 6)
        ) {
          continue
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr
            const nc = c + dc
            isFunctionModule[nr][nc] = true
            const isEdge = Math.abs(dr) === 2 || Math.abs(dc) === 2
            const isCenter = dr === 0 && dc === 0
            matrix[nr][nc] = isEdge || isCenter
          }
        }
      }
    }
  }

  // Padrões de sincronização (Timing patterns)
  for (let i = 8; i < size - 8; i++) {
    if (!isFunctionModule[6][i]) {
      isFunctionModule[6][i] = true
      matrix[6][i] = i % 2 === 0
    }
    if (!isFunctionModule[i][6]) {
      isFunctionModule[i][6] = true
      matrix[i][6] = i % 2 === 0
    }
  }

  // Dark module fixo
  isFunctionModule[size - 8][8] = true
  matrix[size - 8][8] = true

  // Reserva áreas de informações de formato
  for (let i = 0; i < 9; i++) {
    if (!isFunctionModule[8][i]) isFunctionModule[8][i] = true
    if (!isFunctionModule[i][8]) isFunctionModule[i][8] = true
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunctionModule[8][size - 1 - i]) isFunctionModule[8][size - 1 - i] = true
    if (!isFunctionModule[size - 1 - i][8]) isFunctionModule[size - 1 - i][8] = true
  }

  // Posiciona codewords finais nos módulos livres (zig-zag de 2 colunas da direita p/ esquerda)
  const finalBits: number[] = []
  for (const cw of finalCodewords) {
    for (let b = 7; b >= 0; b--) {
      finalBits.push((cw >> b) & 1)
    }
  }

  let bitIdx = 0
  let upward = true
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol-- // Pula a coluna vertical de timing
    const cols = [rightCol, rightCol - 1]
    const rowRange = upward
      ? Array.from({ length: size }, (_, idx) => size - 1 - idx)
      : Array.from({ length: size }, (_, idx) => idx)

    for (const row of rowRange) {
      for (const col of cols) {
        if (!isFunctionModule[row][col]) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx] : 0
          matrix[row][col] = bit === 1
          bitIdx++
        }
      }
    }
    upward = !upward
  }

  // Aplica máscara padrão (Máscara 0: (row + col) % 2 === 0)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunctionModule[r][c] && matrix[r][c] !== null) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] = !matrix[r][c]
        }
      }
    }
  }

  // Informação de formato: Nível M (00) + Máscara 0 (000) = 00000 -> BCH code = 0b101010000010010
  // Valor pré-calculado com máscara XOR 0x5412 para Nível M + Máscara 0:
  const formatInfo = 0b101010000010010 ^ 0x5412

  // Grava bits de formato ao redor dos finders
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >> (14 - i)) & 1) === 1
    // Perto do finder superior esquerdo
    if (i <= 5) matrix[8][i] = bit
    else if (i === 6) matrix[8][7] = bit
    else if (i === 7) matrix[8][8] = bit
    else if (i === 8) matrix[7][8] = bit
    else matrix[14 - i][8] = bit

    // Perto dos finders superior direito e inferior esquerdo
    if (i < 8) {
      matrix[size - 1 - i][8] = bit
    } else {
      matrix[8][size - 15 + i] = bit
    }
  }

  // Retorna matriz booleana estrita
  return matrix.map((row) => row.map((cell) => cell === true))
}

/**
 * Converte a matriz de QR Code em um elemento SVG string pronto para renderização ou impressão.
 */
export function qrMatrixToSvg(matrix: boolean[][], sizePx = 120, quietZone = 2): string {
  const n = matrix.length
  const total = n + quietZone * 2
  let rects = ''

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + quietZone}" y="${r + quietZone}" width="1" height="1" fill="#000000" />`
      }
    }
  }

  return `<svg viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" style="display:block;background:#ffffff;"><rect width="100%" height="100%" fill="#ffffff"/>${rects}</svg>`
}
