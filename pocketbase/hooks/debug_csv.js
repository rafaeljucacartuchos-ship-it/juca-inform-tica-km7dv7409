// TEMPORÁRIO — diagnóstico para descobrir por que o fetch do CSV de produtos
// não retorna conteúdo na migração. Remove-se após o diagnóstico.
routerAdd('GET', '/backend/v1/debug_csv', (e) => {
  var urls = [
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos18082026-53d74.csv',
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos_18_08_2026-53d74.csv',
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/819ad1b5-1865-4f2e-9fe9-f488ce98c0b0/produtos18082026-f5a1f.csv',
  ]
  var out = []
  for (var i = 0; i < urls.length; i++) {
    var res = $http.send({ url: urls[i], method: 'GET', timeout: 30 })
    var rawType = typeof res.raw
    var rawLen = res.raw && res.raw.length ? res.raw.length : 0
    var rawPreview = ''
    if (typeof res.raw === 'string') {
      rawPreview = res.raw.substring(0, 200)
    }
    out.push({
      url: urls[i],
      statusCode: res.statusCode,
      rawType: rawType,
      rawLen: rawLen,
      rawPreview: rawPreview,
      headers: res.headers,
    })
  }
  return e.json(200, out)
})
