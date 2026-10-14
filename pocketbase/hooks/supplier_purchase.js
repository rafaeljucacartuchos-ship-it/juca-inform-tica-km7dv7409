// Preview and commit use identical matching; all writes happen in one transaction.

routerAdd('POST', '/backend/v1/supplier-purchase', (e) => {
  e.response.header().set('Cache-Control', 'no-store')

  const actor = e.auth

  if (!actor || !actor.id) return e.json(401, { error: 'Entre no sistema.' })

  if (actor.getString('role') !== 'admin') return e.json(403, { error: 'Apenas administrador.' })

  const body = e.requestInfo().body

  try {
    const fail = (message) => {
      throw new Error(message)
    }

    const text = (v, max) =>
      typeof v === 'string' && v.trim().length <= max ? v.trim() : fail('Texto inválido.')

    const invoiceKey = text(body.invoiceKey, 44)

    if (!/^\d{44}$/.test(invoiceKey)) fail('Informe a chave de 44 dígitos da nota.')

    let sum = 0,
      weight = 2

    for (let i = 42; i >= 0; i--) {
      sum += Number(invoiceKey[i]) * weight
      weight = weight === 9 ? 2 : weight + 1
    }

    const dv = 11 - (sum % 11)

    if (Number(invoiceKey[43]) !== (dv >= 10 ? 0 : dv)) fail('Chave da nota inválida.')

    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500)
      fail('Quantidade de linhas inválida.')

    if (body.mode !== 'preview' && body.mode !== 'commit') fail('Operação inválida.')

    const codes = Object.create(null),
      bars = Object.create(null)

    const items = body.items.map((x) => {
      const sku = text(x.sku, 100),
        barcode = text(x.barcode, 32),
        name = text(x.name, 255)

      if (!sku || !name || (barcode && !/^\d{8,14}$/.test(barcode)))
        fail('Código, nome ou código de barras inválido.')

      if (codes[sku] || (barcode && bars[barcode])) fail('Código repetido no arquivo.')

      codes[sku] = true
      if (barcode) bars[barcode] = true

      if (
        typeof x.quantity !== 'number' ||
        !Number.isFinite(x.quantity) ||
        x.quantity <= 0 ||
        x.quantity > 1000000
      )
        fail('Quantidade inválida.')

      if (!Number.isSafeInteger(x.priceCents) || x.priceCents <= 0 || x.priceCents > 1000000000)
        fail('Preço inválido.')

      return {
        sku,
        sourceSku: text(x.sourceSku || sku, 100),
        barcode,
        name,
        quantity: x.quantity,
        priceCents: x.priceCents,
        unit: text(x.unit, 12),
      }
    })

    const payload = {
      invoiceKey,
      invoice: text(body.invoice, 30),
      supplier: text(body.supplier, 255),
      items,
    }

    if (!payload.invoice || !payload.supplier) fail('Fornecedor e número da nota são obrigatórios.')

    if (
      body.declaredCount !== null &&
      body.declaredCount !== undefined &&
      body.declaredCount !== items.length &&
      body.countConfirmed !== true
    )
      fail('Confirme a divergência entre o rodapé e os produtos da nota.')

    payload.declaredCount = body.declaredCount == null ? null : body.declaredCount

    payload.countConfirmed = body.countConfirmed === true

    const canonical = JSON.stringify(payload)

    let response

    e.app.runInTransaction((app) => {
      // A missing collection or failed query aborts, never means an empty product list.

      const ledger = app.findCollectionByNameOrId('supplier_purchase_receipts')

      const prior = app.findRecordsByFilter(ledger.id, 'invoice_key = {:key}', '', 2, 0, {
        key: invoiceKey,
      })

      if (prior.length) {
        if (prior[0].getString('canonical') !== canonical)
          fail('Esta nota já foi registrada com dados diferentes. Confira o recibo existente.')

        response = { alreadyImported: true, receiptId: prior[0].id, result: prior[0].get('result') }

        return
      }

      const plans = items.map((x) => {
        const found = app.findRecordsByFilter(
          'products',

          'sku = {:sku} || (barcode != "" && barcode = {:bar}) || (codigo_barras != "" && codigo_barras = {:bar})',

          '',
          3,
          0,
          { sku: x.sku, bar: x.barcode },
        )

        if (found.length > 1) fail('Conflito entre cadastros para código ' + x.sku)

        const p = found[0]

        if (p && !p.getBool('active')) fail('Produto inativo: ' + x.sku)

        if (p && p.getString('sku') && p.getString('sku') !== x.sku)
          fail('Código de barras pertence a outro código: ' + x.sku)

        if (
          p &&
          x.barcode &&
          [p.getString('barcode'), p.getString('codigo_barras')].some((b) => b && b !== x.barcode)
        )
          fail('Código de barras divergente: ' + x.sku)

        const normalizeName = (v) =>
          v
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/^\s*\d+\s*[-–]\s*/, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
        if (p && normalizeName(p.getString('name')) !== normalizeName(x.name))
          fail(
            'O código ' +
              x.sku +
              ' pertence a ' +
              p.getString('name') +
              '. Confira a identidade e use outro código para um produto diferente.',
          )
        const stock = p ? p.getFloat('stock_quantity') : 0

        if (!Number.isFinite(stock)) fail('Saldo inválido: ' + x.sku)

        return {
          item: x,
          record: p,
          id: p ? p.id : null,
          previousStock: stock,
          nextStock: stock + x.quantity,
          previousPrice: p ? p.getFloat('price') : null,
        }
      })

      const preview = plans.map((p) => ({
        sku: p.item.sku,
        id: p.id,
        previousStock: p.previousStock,
        nextStock: p.nextStock,
        previousPrice: p.previousPrice,
        price: p.item.priceCents / 100,
        action: p.id ? 'update' : 'create',
      }))

      if (body.mode === 'preview') {
        response = { preview }
        return
      }

      if (
        !Array.isArray(body.expectedPreview) ||
        body.expectedPreview.length !== preview.length ||
        preview.some((row, i) =>
          Object.keys(row).some((key) => row[key] !== body.expectedPreview[i][key]),
        )
      )
        fail('O cadastro ou estoque mudou. Confira uma nova prévia antes de confirmar.')

      const products = app.findCollectionByNameOrId('products')

      for (let i = 0; i < plans.length; i++) {
        const p = plans[i],
          x = p.item,
          r = p.record || new Record(products)

        if (!p.record) {
          r.set('name', x.name)
          r.set('sku', x.sku)
          r.set('active', true)

          r.set(
            'description',
            'Cadastro por entrada de compra. Custo unitário não informado no relatório.',
          )
        }

        if (x.barcode) {
          r.set('barcode', x.barcode)
          r.set('codigo_barras', x.barcode)
        }

        r.set('search_text', [r.getString('name'), x.sku, x.barcode].join(' ').toLowerCase())

        r.set('stock_quantity', p.nextStock)
        r.set('price', x.priceCents / 100)

        app.save(r)

        preview[i].id = r.id
      }

      const receipt = new Record(ledger)

      receipt.set('invoice_key', invoiceKey)
      receipt.set('payload', payload)
      receipt.set('canonical', canonical)

      receipt.set('result', preview)
      receipt.set('actor', actor.id)

      app.save(receipt)

      response = { alreadyImported: false, receiptId: receipt.id, result: preview }
    })

    return e.json(200, response)
  } catch (err) {
    return e.json(409, {
      error: String(err),
      message: 'Entrada não concluída. Nenhum item desta tentativa foi gravado.',
    })
  }
})
