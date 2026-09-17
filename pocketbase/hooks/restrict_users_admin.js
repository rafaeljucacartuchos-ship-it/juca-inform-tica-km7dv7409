// Impede que usuários sem perfil 'admin' alterem 'role' ou manipulem outros usuários
onRecordUpdateRequest((e) => {
  var auth = e.auth
  if (!auth) {
    return e.forbiddenError('Autenticacao necessaria')
  }

  var isSuper = auth.isSuperuser()
  var currentRole = auth.record ? auth.record.getString('role') : ''
  var isAdmin = isSuper || currentRole === 'admin'

  var body = e.requestInfo().body

  // Se não for admin:
  if (!isAdmin) {
    // 1. Não pode alterar a função (role) de ninguém, nem de si próprio
    if (body.role !== undefined && body.role !== e.record.getString('role')) {
      return e.forbiddenError('Apenas administradores podem alterar a funcao de usuarios')
    }

    // 2. Não pode editar dados de outros usuários
    if (auth.record && auth.record.id !== e.record.id) {
      return e.forbiddenError('Apenas administradores podem gerenciar outros usuarios')
    }
  }

  e.next()
}, 'users')

// Garante no servidor que apenas administradores criem novos usuários
onRecordCreateRequest((e) => {
  var auth = e.auth
  if (!auth) {
    return e.forbiddenError('Autenticacao necessaria')
  }

  var isSuper = auth.isSuperuser()
  var currentRole = auth.record ? auth.record.getString('role') : ''
  var isAdmin = isSuper || currentRole === 'admin'

  if (!isAdmin) {
    return e.forbiddenError('Apenas administradores podem criar novos usuarios')
  }

  e.next()
}, 'users')
