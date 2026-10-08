// CANDIDATO: proteção da resposta da coleção, inclusive leitura direta e expansão.
// Não altera a autorização de quais propostas cada sessão pode consultar.
// Não salvar o record alterado neste hook: as mudanças são somente da resposta.
onRecordEnrich((e) => {
  const info = typeof e.requestInfo === 'function' ? e.requestInfo() : e.requestInfo;
  if (info && typeof info.hasSuperuserAuth === 'function' && info.hasSuperuserAuth()) return e.next();
  const auth = (info && info.auth) || e.auth;
  if (auth && typeof auth.isSuperuser === 'function' && auth.isSuperuser()) return e.next();
  const actor = auth && typeof auth.getString === 'function' ? auth : auth && auth.record;
  if (actor && actor.getString('role') === 'admin') return e.next();
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

  function jsonField(name) {
    const value = e.record.get(name);
    if (typeof value === 'string') return JSON.parse(value);
    if (Array.isArray(value) && value.length && value.every(b => Number.isInteger(b) && b >= 0 && b <= 255))
      return JSON.parse(decodeURIComponent(value.map(b => '%' + b.toString(16).padStart(2,'0')).join('')));
    return value;
  }
  let commercial;
  try {
    commercial = projectRentalCommercialQuote({
      id:e.record.id, titulo:e.record.getString('titulo'), created:e.record.getString('created'),
      cliente_nome_livre:e.record.getString('cliente_nome_livre'),
      cliente_documento:e.record.getString('cliente_documento'),
      cliente_telefone:e.record.getString('cliente_telefone'), cliente_endereco:e.record.getString('cliente_endereco'),
      contrato_meses:e.record.get('contrato_meses'), franquia_paginas:e.record.get('franquia_paginas'),
      maquinas_comparadas:jsonField('maquinas_comparadas'), resultados:jsonField('resultados'),
    });
  } catch (_) { throw new ForbiddenError('Proposta comercial pendente de revisão administrativa.'); }
  const allowed = new Set(Object.keys(commercial).concat(['collectionId','collectionName','updated']));
  if (actor && actor.id) { allowed.add('status'); allowed.add('cliente_id'); }
  for (const key of Object.keys(e.record.publicExport())) if (!allowed.has(key)) e.record.hide(key);
  e.record.setExpand({});
  e.record.hide('expand');
  e.record.set('maquinas_comparadas', commercial.maquinas_comparadas);
  // Mesmo snapshots antigos armazenados em resultados nunca saem integralmente.
  e.record.hide('resultados'); e.record.hide('token_acesso');
  e.next();
}, 'rental_quotes');
