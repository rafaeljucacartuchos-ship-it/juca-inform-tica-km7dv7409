migrate(
  (app) => {
    // BUGFIX v0.0.247 — RESTABELECER PERMISSÕES DE ADMINISTRADORES
    // O usuário administrador 'administrador' (Rafael) teve suas permissões registradas
    // com campos desatualizados (incluindo dashboard=false), causando perda de módulos e
    // impossibilidade de navegar.
    // Esta migração garante de forma idempotente que TODOS os usuários com role='admin'
    // na coleção 'users' tenham todas as permissões de ALL_PERMISSION_MODULES habilitadas (true).
    // Não altera permissões de técnicos ou atendentes.

    console.log('[Migration 0084] Iniciando restabelecimento de permissões de administradores...')

    const allModules = [
      'dashboard',
      'clientes',
      'os_create',
      'agendamentos',
      'ordens',
      'os_delete',
      'orcamentos',
      'pos_venda',
      'campanhas',
      'pedido_mercadoria',
      'tecnicos',
      'relatorios',
      'exportacoes',
      'permissoes',
      'equipamentos',
      'produtos',
      'servicos',
      'service_types',
      'precificacao',
      'locacao',
    ]

    const fullAdminPermissions = {}
    for (let i = 0; i < allModules.length; i++) {
      fullAdminPermissions[allModules[i]] = true
    }

    try {
      const adminUsers = app.findRecordsByFilter('users', 'role = "admin"', 'created', 0, 0)
      console.log(`[Migration 0084] Encontrados ${adminUsers.length} administradores.`)

      for (let j = 0; j < adminUsers.length; j++) {
        const admin = adminUsers[j]
        console.log(
          `[Migration 0084] Atualizando permissões do admin: ${admin.get('username') || admin.get('name') || admin.id}`,
        )
        admin.set('permissions', fullAdminPermissions)
        app.save(admin)
      }

      console.log(
        '[Migration 0084] Permissões de todos os administradores restabelecidas com sucesso!',
      )
    } catch (err) {
      console.log('[Migration 0084] Erro ao atualizar permissões de administradores:', err)
      throw err
    }
  },
  (app) => {
    // Reversão não é necessária pois full permissions é o estado natural de admin
  },
)
