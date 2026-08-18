// Proxy seguro para a API de imagens do Pexels.
// A chave da API vive apenas no backend (secret PEXELS_API_KEY) e nunca é
// exposta ao cliente. O frontend chama GET /api/pexels/search?query=TERMO.
routerAdd('GET', '/api/pexels/search', (e) => {
  const query = (e.requestInfo().query['query'] || '').toString().trim()
  if (!query) {
    return e.json(200, { photos: [] })
  }

  const apiKey = $os.getenv('PEXELS_API_KEY') || ''
  if (!apiKey) {
    return e.json(500, { error: 'Chave do Pexels não configurada no backend.' })
  }

  const url =
    'https://api.pexels.com/v1/search?query=' +
    encodeURIComponent(query) +
    '&per_page=6&locale=pt-BR'

  const res = $http.send({
    url: url,
    method: 'GET',
    headers: { Authorization: apiKey },
    timeout: 15,
  })

  if (res.statusCode !== 200) {
    return e.json(res.statusCode, { error: 'Falha ao buscar imagens no Pexels.' })
  }

  return e.json(200, res.json)
})
