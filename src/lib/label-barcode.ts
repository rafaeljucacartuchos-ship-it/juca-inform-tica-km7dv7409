/**
 * Gerador de Código de Barras Code 128 (Conjunto B) em SVG / Canvas puro.
 * Converte qualquer texto alfanumérico ASCII (como o número da OS ou número de série)
 * em barras preto/branco com dígito verificador e stop pattern.
 */

// Padrões de barras do Code 128 (108 símbolos, cada um composto por 6 larguras: 3 barras e 3 espaços que somam 11 módulos, exceto stop que tem 7 e soma 13)
const CODE128_PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
]

const START_CODE_B = 104
const STOP_CODE = 106

/**
 * Converte caractere ASCII no índice Code 128 B (ASCII 32 a 126 equivalem a 0 a 94)
 */
function charToCodeB(char: string): number {
  const code = char.charCodeAt(0)
  if (code >= 32 && code <= 126) {
    return code - 32
  }
  return 0 // Fallback para espaço
}

/**
 * Gera as larguras de barras e espaços do Code 128 para o texto fornecido.
 * Retorna string binária (1 = barra, 0 = espaço).
 */
export function generateCode128Binary(text: string): string {
  const cleanText = text.trim() || 'OS'
  const codes: number[] = [START_CODE_B]

  for (let i = 0; i < cleanText.length; i++) {
    codes.push(charToCodeB(cleanText[i]))
  }

  // Calcula checksum: (START + soma(indice * code)) % 103
  let checksum = START_CODE_B
  for (let i = 1; i < codes.length; i++) {
    checksum += i * codes[i]
  }
  codes.push(checksum % 103)
  codes.push(STOP_CODE)

  // Transforma cada código em sequência de 1s e 0s
  let binary = '0000000000' // Quiet zone inicial (10 módulos)
  for (let c = 0; c < codes.length; c++) {
    const pattern = CODE128_PATTERNS[codes[c]]
    let isBar = true
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10)
      binary += (isBar ? '1' : '0').repeat(width)
      isBar = !isBar
    }
  }
  binary += '0000000000' // Quiet zone final (10 módulos)

  return binary
}

/**
 * Gera código de barras em SVG.
 */
export function code128ToSvg(
  text: string,
  heightPx = 45,
  moduleWidth = 1.2,
  showText = true,
): string {
  const binary = generateCode128Binary(text)
  const totalModules = binary.length
  const totalWidth = totalModules * moduleWidth

  let rects = ''
  let currentStart = -1

  for (let i = 0; i < totalModules; i++) {
    if (binary[i] === '1') {
      if (currentStart === -1) currentStart = i
    } else {
      if (currentStart !== -1) {
        const w = (i - currentStart) * moduleWidth
        const x = currentStart * moduleWidth
        rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${heightPx}" fill="#000000"/>`
        currentStart = -1
      }
    }
  }
  if (currentStart !== -1) {
    const w = (totalModules - currentStart) * moduleWidth
    const x = currentStart * moduleWidth
    rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${heightPx}" fill="#000000"/>`
  }

  const svgHeight = showText ? heightPx + 14 : heightPx
  const textElement = showText
    ? `<text x="${(totalWidth / 2).toFixed(2)}" y="${(heightPx + 11).toFixed(2)}" font-family="monospace" font-size="9" font-weight="bold" fill="#000000" text-anchor="middle">${text}</text>`
    : ''

  return `<svg viewBox="0 0 ${totalWidth.toFixed(2)} ${svgHeight}" width="${totalWidth.toFixed(2)}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;background:#ffffff;"><rect width="100%" height="100%" fill="#ffffff"/>${rects}${textElement}</svg>`
}
