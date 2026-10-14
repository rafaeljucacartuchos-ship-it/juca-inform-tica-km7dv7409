migrate(
  (app) => {
    // Teste automatizado dos cenários da tarefa
    const techs = app.findRecordsByFilter(
      'users',
      "role = 'technician' && ativo = true",
      '-created',
      10,
      0,
    )
    if (techs.length < 2) {
      throw new Error('Menos de 2 técnicos ativos para teste')
    }

    const tech1Id = techs[0].id
    const tech2Id = techs[1].id
    const custs = app.findRecordsByFilter(
      'customers',
      "celular = '' || phone = ''",
      '-created',
      10,
      0,
    )
    const customerId = custs.length > 0 ? custs[0].id : 'j89odx306rv7s2p'
    const soCol = app.findCollectionByNameOrId('service_orders')

    // Cenário 1: 1 técnico
    const so1 = new Record(soCol)
    so1.set('title', 'Cenário 1: 1 Técnico')
    so1.set('customer', customerId)
    so1.set('technician', tech1Id)
    so1.set('status', 'open')
    so1.set('priority', 'low')
    app.save(so1)

    // Cenário 2: 2 técnicos
    const so2 = new Record(soCol)
    so2.set('title', 'Cenário 2: 2 Técnicos')
    so2.set('customer', customerId)
    so2.set('technician', tech1Id)
    so2.set('second_technician', tech2Id)
    so2.set('status', 'open')
    so2.set('priority', 'low')
    app.save(so2)

    // Cenário 3: 2 técnicos sendo 1 vendedor
    const so3 = new Record(soCol)
    so3.set('title', 'Cenário 3: 2 Técnicos + Vendedor')
    so3.set('customer', customerId)
    so3.set('technician', tech1Id)
    so3.set('second_technician', tech2Id)
    so3.set('seller', tech1Id)
    so3.set('status', 'open')
    so3.set('priority', 'low')
    app.save(so3)

    // Cenário 4: sem técnico
    const so4 = new Record(soCol)
    so4.set('title', 'Cenário 4: Sem Técnico')
    so4.set('customer', customerId)
    so4.set('status', 'open')
    so4.set('priority', 'low')
    app.save(so4)

    const notifs1 = app.findRecordsByFilter(
      'notifications',
      `link = '/ordens/${so1.id}'`,
      '',
      10,
      0,
    )
    const notifs2 = app.findRecordsByFilter(
      'notifications',
      `link = '/ordens/${so2.id}'`,
      '',
      10,
      0,
    )
    const notifs3 = app.findRecordsByFilter(
      'notifications',
      `link = '/ordens/${so3.id}'`,
      '',
      10,
      0,
    )
    const notifs4 = app.findRecordsByFilter(
      'notifications',
      `link = '/ordens/${so4.id}'`,
      '',
      10,
      0,
    )

    // Verificações
    if (notifs1.length !== 1 || notifs1[0].getString('user') !== tech1Id) {
      throw new Error(
        'Cenário 1 falhou: esperado 1 notificação para tech1, obtido ' + notifs1.length,
      )
    }

    const uMap2 = {}
    notifs2.forEach((n) => {
      uMap2[n.getString('user')] = (uMap2[n.getString('user')] || 0) + 1
    })
    if (notifs2.length !== 2 || uMap2[tech1Id] !== 1 || uMap2[tech2Id] !== 1) {
      throw new Error(
        'Cenário 2 falhou: esperado 1 notificação para cada técnico, obtido ' + notifs2.length,
      )
    }

    const uMap3 = {}
    notifs3.forEach((n) => {
      uMap3[n.getString('user')] = (uMap3[n.getString('user')] || 0) + 1
    })
    if (notifs3.length !== 2 || uMap3[tech1Id] !== 1 || uMap3[tech2Id] !== 1) {
      throw new Error(
        'Cenário 3 falhou: esperado 1 notificação para cada técnico mesmo sendo vendedor, obtido ' +
          notifs3.length,
      )
    }

    if (notifs4.length !== 0) {
      throw new Error('Cenário 4 falhou: esperado 0 notificações, obtido ' + notifs4.length)
    }

    // Limpar os registros de teste
    const allOrders = [so1, so2, so3, so4]
    for (let o of allOrders) {
      const rNotifs = app.findRecordsByFilter(
        'notifications',
        `link = '/ordens/${o.id}'`,
        '',
        50,
        0,
      )
      for (let rn of rNotifs) {
        app.delete(rn)
      }
      app.delete(o)
    }
  },
  (app) => {},
)
