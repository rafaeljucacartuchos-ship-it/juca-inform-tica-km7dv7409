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

    // Ação: contagens esperadas independentes via servidor (super-auditoria)
    if (body.action === 'counts') {
      var counts = {}
      for (var i = 0; i < collections.length; i++) {
        var cName = collections[i]
        try {
          // Usa countRecords do PocketBase
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

    // Ação: exportar uma coleção específica de forma paginada e segura
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
          // PocketBase Record.publicExport() ou serialização direta
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
