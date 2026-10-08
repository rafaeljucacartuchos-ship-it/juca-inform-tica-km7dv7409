// CANDIDATO LOCAL. Não implantar isoladamente: fechar acesso direto à coleção privada.
// Confirmar requestInfo().query e representação de JSON no runtime do SKIP.
routerAdd('GET', '/backend/v1/rental-proposal/{id}', (e) => {
  e.response.header().set('Cache-Control', 'no-store');
  e.response.header().set('Referrer-Policy', 'no-referrer');
// Candidato para execução NO SERVIDOR, após autorização da proposta/token.
// Esta função não autentica, não consulta banco e não deve ser usada como filtro apenas no navegador.
                                  
function row(value         )      {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Registro comercial inválido.')
  return value       
}
function text(value         , required = false)         {
  if (value === undefined || value === null) {
    if (required) throw new Error('Identificação comercial ausente.')
    return ''
  }
  if (typeof value !== 'string' || (required && !value.trim())) throw new Error('Texto comercial inválido.')
  return value
}
function amount(value         , integer = false, positive = false)         {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      (integer && !Number.isSafeInteger(value)) || (positive && value === 0)) {
    throw new Error('Valor comercial ausente ou inválido.')
  }
  return value
}
function projectRentalCommercialQuote(input         ) {
  const q = row(input)
  // Usa somente os valores congelados da proposta, sem preço atual de catálogo.
  const legacy = q.resultados === undefined || q.resultados === null ? {} : row(q.resultados)
  const machines = q.maquinas_comparadas ?? legacy.machines
  if (!Array.isArray(machines) || machines.length === 0) throw new Error('Proposta sem equipamento comercial.')
  return {
    id: text(q.id, true),
    titulo: text(q.titulo),
    created: text(q.created, true),
    cliente_nome_livre: text(q.cliente_nome_livre, true),
    cliente_documento: text(q.cliente_documento),
    cliente_telefone: text(q.cliente_telefone),
    cliente_endereco: text(q.cliente_endereco),
    contrato_meses: amount(q.contrato_meses, true, true),
    franquia_paginas: amount(q.franquia_paginas, true),
    maquinas_comparadas: machines.map(value => {
      const m = row(value)
      if (typeof m.scanner !== 'boolean') throw new Error('Scanner comercial não confirmado.')
      return {
        machineName: text(m.machineName, true),
        serial: text(m.serial),
        scanner: m.scanner,
        scannerDados: text(m.scannerDados),
        franquiaSugerida: amount(m.franquiaSugerida),
        excedenteSugerido: amount(m.excedenteSugerido),
        tco: amount(m.tco),
      }
    }),
  }
}

  const denied = () => e.json(404, {error:'Proposta indisponível ou acesso inválido.'});
  const id = e.request.pathValue('id');
  const info = e.requestInfo();
  const token = info && info.query ? info.query.token : null;
  if (typeof id !== 'string' || !id || typeof token !== 'string' || !token || token.length > 256) return denied();
  let record;
  try { record = $app.findRecordById('rental_quotes', id); } catch (_) { return denied(); }
  const expected = record.getString('token_acesso');
  if (!expected || expected !== token) return denied();
  // Nenhum lookup de cliente/catálogo antes de autorizar o token do registro específico.
  function jsonField(name) {
    const value = record.get(name);
    if (Array.isArray(value) && value.length > 0 && value.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) {
      const encoded = value.map(b => '%' + b.toString(16).padStart(2, '0')).join('');
      return JSON.parse(decodeURIComponent(encoded));
    }
    return typeof value === 'string' ? JSON.parse(value) : value;
  }
  try {
    const input = {
      id: record.id,
      titulo: record.getString('titulo'),
      created: record.getString('created'),
      cliente_nome_livre: record.getString('cliente_nome_livre'),
      cliente_documento: record.getString('cliente_documento'),
      cliente_telefone: record.getString('cliente_telefone'),
      cliente_endereco: record.getString('cliente_endereco'),
      contrato_meses: record.get('contrato_meses'),
      franquia_paginas: record.get('franquia_paginas'),
      maquinas_comparadas: jsonField('maquinas_comparadas'),
      resultados: jsonField('resultados'),
    };
    // Legado sem identidade comercial congelada falha fechado; não inventa dados.
    return e.json(200, projectRentalCommercialQuote(input));
  } catch (_) { return denied(); }
});
