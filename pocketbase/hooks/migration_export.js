// pocketbase/hooks/migration_export.js
// Rota administrativa controlada para exportação e contagem auditada de migração
// Acesso exclusivo para administradores autenticados ou requisições autorizadas
// Em caso de erro, captura e devolve sempre JSON estruturado (nunca derruba a instância nem devolve HTML).

routerAdd('POST', '/backend/v1/migration/admin-export', (e) => {
  'use strict'
  e.response.header().set('Cache-Control', 'no-store')

  try {
    var info = e.requestInfo()
    var auth = e.auth || info.auth
    var actor = auth && typeof auth.getString === 'function' ? auth : auth && auth.record

    // Autenticação obrigatória
    if (!actor || !actor.id) {
      return e.json(401, {
        success: false,
        error: 'Autenticação necessária para exportação administrativa.',
      })
    }

    var isSuper = auth && typeof auth.isSuperuser === 'function' ? auth.isSuperuser() : false
    var currentRole = actor.getString ? actor.getString('role') : ''
    var isAdmin = isSuper || currentRole === 'admin'

    if (!isAdmin) {
      return e.json(403, {
        success: false,
        error: 'Apenas administradores podem executar a exportação de migração.',
      })
    }

    // Lista oficial das 38 coleções da base JUCA
    var collections = [
      'users',
      'customers',
      'appointments',
      'service_orders',
      'services',
      'service_order_items',
      'status_history',
      'payments',
      'equipment',
      'products',
      'service_attachments',
      'notifications',
      'evaluations',
      'push_subscriptions',
      'service_types',
      'settings',
      'pos_venda_messages',
      'campaigns',
      'campanha_messages',
      'orcamentos',
      'orcamento_itens',
      'orcamento_anexos',
      'pricing_history',
      'rental_machines',
      'rental_quotes',
      'rental_contracts',
      'funcoes',
      'parametros',
      'suprimentos',
      'impressoras',
      'contratos',
      'auditoria_precos',
      'laudos_tecnicos',
      'financial_receivables',
      'rental_documents',
      'rental_reserve',
      'order_division_history',
      'quick_accounts',
    ]

    var body = info.body || {}
    var targetCollection = body.collection ? String(body.collection).trim() : ''
    var page = Number(body.page) || 1
    var perPage = Number(body.perPage) || 200
    if (perPage > 500) perPage = 500
    if (page < 1) page = 1

    // Ação: download seguro de anexo via servidor administrativo (Superuser interno)
    // Suporta 'include_data: false' para calcular apenas SHA-256 e tamanho server-side (sem transportar payload pesado)
    if (body.action === 'download_file' || body.action === 'verify_file') {
      var dlCollection = body.collection ? String(body.collection).trim() : ''
      var dlRecordId = body.record_id ? String(body.record_id).trim() : ''
      var dlFilename = body.filename ? String(body.filename).trim() : ''
      var includeData = body.include_data !== false && body.action !== 'verify_file'

      if (!dlCollection || !dlRecordId || !dlFilename) {
        return e.json(400, {
          success: false,
          error: 'Parâmetros collection, record_id e filename são obrigatórios.',
        })
      }

      try {
        var recordToRead = e.app.findRecordById(dlCollection, dlRecordId)
        var fs = e.app.newBlobFileSystem()
        var storageKey = recordToRead.baseFilesPath() + '/' + dlFilename
        var fileBlob = fs.getFile(storageKey)
        if (!fileBlob) {
          return e.json(404, {
            success: false,
            error: 'Arquivo não encontrado no storage físico: ' + storageKey,
          })
        }

        // Lê bytes e calcula sha256 server-side com garantia de integridade
        var fileReader = fileBlob.reader
        var bytes = $bytes.readAll(fileReader)
        var sha256Hex = $security.sha256(bytes)
        var sizeBytes = bytes.length

        var responsePayload = {
          success: true,
          collection: dlCollection,
          record_id: dlRecordId,
          filename: dlFilename,
          size_bytes: sizeBytes,
          sha256: sha256Hex,
        }

        if (includeData) {
          responsePayload.data_base64 = $security.base64Encode(bytes)
        }

        return e.json(200, responsePayload)
      } catch (errDl) {
        return e.json(500, {
          success: false,
          error:
            'Falha no acesso ao arquivo: ' +
            (errDl && errDl.message ? errDl.message : String(errDl)),
        })
      }
    }

    // Ação: verificação em lote server-side (batch_verify)
    // Permite verificar até 50 arquivos de uma só vez sem transportar os bytes na rede
    if (body.action === 'batch_verify') {
      var itemsToVerify = Array.isArray(body.items) ? body.items : []
      if (itemsToVerify.length === 0) {
        return e.json(400, {
          success: false,
          error: 'Lista de itens para verificação está vazia.',
        })
      }
      if (itemsToVerify.length > 50) {
        itemsToVerify = itemsToVerify.slice(0, 50)
      }

      var fsBatch = null
      try {
        fsBatch = e.app.newBlobFileSystem()
      } catch (_) {}

      var verifyResults = []
      for (var vIdx = 0; vIdx < itemsToVerify.length; vIdx++) {
        var vItem = itemsToVerify[vIdx]
        var vCol = vItem.collection ? String(vItem.collection).trim() : ''
        var vRecId = vItem.record_id ? String(vItem.record_id).trim() : ''
        var vFname = vItem.filename ? String(vItem.filename).trim() : ''

        if (!vCol || !vRecId || !vFname) {
          verifyResults.push({
            collection: vCol,
            record_id: vRecId,
            filename: vFname,
            success: false,
            error: 'Campos incompletos para o arquivo',
          })
          continue
        }

        try {
          var recObj = e.app.findRecordById(vCol, vRecId)
          if (!fsBatch) fsBatch = e.app.newBlobFileSystem()
          var sKey = recObj.baseFilesPath() + '/' + vFname
          var bFile = fsBatch.getFile(sKey)
          if (!bFile) {
            verifyResults.push({
              collection: vCol,
              record_id: vRecId,
              filename: vFname,
              success: false,
              error: 'Arquivo não encontrado no storage físico: ' + sKey,
            })
            continue
          }

          var bBytes = $bytes.readAll(bFile.reader)
          var bSha = $security.sha256(bBytes)
          verifyResults.push({
            collection: vCol,
            record_id: vRecId,
            filename: vFname,
            success: true,
            size_bytes: bBytes.length,
            sha256: bSha,
          })
        } catch (vErr) {
          verifyResults.push({
            collection: vCol,
            record_id: vRecId,
            filename: vFname,
            success: false,
            error: vErr && vErr.message ? vErr.message : String(vErr),
          })
        }
      }

      return e.json(200, {
        success: true,
        action: 'batch_verify',
        count: verifyResults.length,
        results: verifyResults,
      })
    }

    // Ação: contagens esperadas independentes via servidor (super-auditoria)
    if (body.action === 'counts') {
      var counts = {}
      for (var i = 0; i < collections.length; i++) {
        var cName = collections[i]
        try {
          // Usa countRecords do PocketBase com privilégio total de superuser
          var total = e.app.countRecords(cName)
          counts[cName] = {
            count: total,
            status: total === 0 ? 'empty' : 'available',
            error: null,
          }
        } catch (errCol) {
          counts[cName] = {
            count: null,
            status: 'failed',
            error: errCol && errCol.message ? errCol.message : 'Falha na contagem',
          }
        }
      }

      return e.json(200, {
        success: true,
        action: 'counts',
        timestamp: new Date().toISOString(),
        total_collections: collections.length,
        counts: counts,
      })
    }

    // Ação: exportar uma coleção específica de forma paginada e segura server-side
    // Com e.app, a consulta bypassa todas as regras de RLS (executa como Superuser interno)
    if (targetCollection) {
      if (collections.indexOf(targetCollection) === -1) {
        return e.json(400, {
          success: false,
          error: 'Coleção inválida ou não catalogada: ' + targetCollection,
        })
      }

      var totalRecords = 0
      try {
        totalRecords = e.app.countRecords(targetCollection)
      } catch (_) {
        totalRecords = 0
      }

      var offset = (page - 1) * perPage
      var records = []
      try {
        records = e.app.findRecordsByFilter(targetCollection, '', '+id', perPage, offset)
      } catch (errQuery) {
        return e.json(500, {
          success: false,
          collection: targetCollection,
          error: errQuery && errQuery.message ? errQuery.message : 'Erro ao consultar registros',
        })
      }

      // Serialização segura dos registros (evitando circularidade e campos protegidos)
      var serialized = []
      for (var r = 0; r < records.length; r++) {
        var rec = records[r]
        var plain = {}
        try {
          if (rec.publicExport) {
            plain = rec.publicExport()
          } else {
            plain = JSON.parse(JSON.stringify(rec))
          }
        } catch (_) {
          plain = { id: rec.id }
        }
        serialized.push(plain)
      }

      var totalPages = Math.ceil(totalRecords / perPage) || 1

      return e.json(200, {
        success: true,
        collection: targetCollection,
        page: page,
        perPage: perPage,
        totalItems: totalRecords,
        totalPages: totalPages,
        items: serialized,
      })
    }

    // Ação padrão se não forneceu targetCollection: resumo do status do servidor
    return e.json(200, {
      success: true,
      service: 'migration_export',
      version: '1.0.0',
      total_catalogued_collections: collections.length,
      allowed_collections: collections,
    })
  } catch (globalErr) {
    // NUNCA derrubar a instância e NUNCA deixar escapar HTML: sempre JSON
    return e.json(500, {
      success: false,
      error:
        globalErr && globalErr.message
          ? globalErr.message
          : 'Erro interno no hook de exportação de migração',
    })
  }
})
