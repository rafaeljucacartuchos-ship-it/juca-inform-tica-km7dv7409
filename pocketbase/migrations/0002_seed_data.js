migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'rafaeljucacartuchos@gmail.com')
      adminUser.set('role', 'admin')
      adminUser.set('phone', '(11) 99999-8888')
      app.save(adminUser)
    } catch (_) {
      adminUser = new Record(usersCol)
      adminUser.setEmail('rafaeljucacartuchos@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Rafael Juca (Admin)')
      adminUser.set('role', 'admin')
      adminUser.set('phone', '(11) 99999-8888')
      app.save(adminUser)
    }

    let techUser
    try {
      techUser = app.findAuthRecordByEmail('_pb_users_auth_', 'tecnico.carlos@assistencia.com')
    } catch (_) {
      techUser = new Record(usersCol)
      techUser.setEmail('tecnico.carlos@assistencia.com')
      techUser.setPassword('Skip@Pass')
      techUser.setVerified(true)
      techUser.set('name', 'Carlos Oliveira')
      techUser.set('role', 'technician')
      techUser.set('phone', '(11) 98765-1122')
      app.save(techUser)
    }

    let attendantUser
    try {
      attendantUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'atendimento.ana@assistencia.com',
      )
    } catch (_) {
      attendantUser = new Record(usersCol)
      attendantUser.setEmail('atendimento.ana@assistencia.com')
      attendantUser.setPassword('Skip@Pass')
      attendantUser.setVerified(true)
      attendantUser.set('name', 'Ana Santos')
      attendantUser.set('role', 'attendant')
      attendantUser.set('phone', '(11) 97777-3344')
      app.save(attendantUser)
    }

    const custCol = app.findCollectionByNameOrId('customers')
    let cust1, cust2, cust3
    try {
      cust1 = app.findFirstRecordByData('customers', 'name', 'Mariana Souza')
    } catch (_) {
      cust1 = new Record(custCol)
      cust1.set('name', 'Mariana Souza')
      cust1.set('email', 'mariana.souza@gmail.com')
      cust1.set('phone', '(11) 98765-4321')
      cust1.set('street', 'Av. Paulista')
      cust1.set('number', '1500')
      cust1.set('city', 'São Paulo')
      cust1.set('state', 'SP')
      cust1.set('zip', '01310-100')
      cust1.set('notes', 'Atendimento preferencial no período da manhã')
      app.save(cust1)
    }

    try {
      cust2 = app.findFirstRecordByData('customers', 'name', 'Tech Solutions Ltda')
    } catch (_) {
      cust2 = new Record(custCol)
      cust2.set('name', 'Tech Solutions Ltda')
      cust2.set('email', 'contato@techsolutions.com.br')
      cust2.set('phone', '(11) 3344-5566')
      cust2.set('street', 'Rua Funchal')
      cust2.set('number', '418')
      cust2.set('city', 'São Paulo')
      cust2.set('state', 'SP')
      cust2.set('zip', '04551-060')
      cust2.set('notes', 'Contrato corporativo de suporte de rede')
      app.save(cust2)
    }

    try {
      cust3 = app.findFirstRecordByData('customers', 'name', 'Roberto Mendonça')
    } catch (_) {
      cust3 = new Record(custCol)
      cust3.set('name', 'Roberto Mendonça')
      cust3.set('email', 'roberto.mendonca@hotmail.com')
      cust3.set('phone', '(11) 97123-8899')
      cust3.set('street', 'Rua Barão de Jaguara')
      cust3.set('number', '920')
      cust3.set('city', 'Campinas')
      cust3.set('state', 'SP')
      cust3.set('zip', '13015-002')
      cust3.set('notes', 'Cliente particular, proprietário de notebook Dell')
      app.save(cust3)
    }

    const servCol = app.findCollectionByNameOrId('services')
    const catalog = [
      {
        name: 'Formatação e Reinstalação de OS',
        desc: 'Instalação limpa do Windows/Linux com drivers e programas essenciais',
        price: 180,
        duration: 120,
      },
      {
        name: 'Remoção de Vírus e Malwares',
        desc: 'Varredura profunda, eliminação de ameaças e otimização do sistema',
        price: 120,
        duration: 60,
      },
      {
        name: 'Upgrade de Hardware (SSD / RAM)',
        desc: 'Substituição ou adição de memória RAM / disco SSD com clonagem',
        price: 150,
        duration: 45,
      },
      {
        name: 'Manutenção Preventiva e Limpeza',
        desc: 'Limpeza interna de componentes, troca de pasta térmica e testes de estresse',
        price: 140,
        duration: 90,
      },
      {
        name: 'Configuração de Rede e Roteador',
        desc: 'Instalação de roteador Wi-Fi, cabeamento e configuração de segurança',
        price: 200,
        duration: 90,
      },
      {
        name: 'Recuperação de Dados de HD/SSD',
        desc: 'Recuperação lógica de arquivos excluídos ou unidades corrompidas',
        price: 350,
        duration: 180,
      },
    ]

    const seededServices = []
    for (const s of catalog) {
      try {
        const existing = app.findFirstRecordByData('services', 'name', s.name)
        seededServices.push(existing)
      } catch (_) {
        const rec = new Record(servCol)
        rec.set('name', s.name)
        rec.set('description', s.desc)
        rec.set('price', s.price)
        rec.set('estimated_duration', s.duration)
        rec.set('active', true)
        app.save(rec)
        seededServices.push(rec)
      }
    }

    const todayStr = new Date().toISOString().substring(0, 10)
    const apptCol = app.findCollectionByNameOrId('appointments')
    let appt1
    try {
      appt1 = app.findFirstRecordByData('appointments', 'address_note', 'Visita na sede do cliente')
    } catch (_) {
      appt1 = new Record(apptCol)
      appt1.set('customer', cust2.id)
      appt1.set('technician', techUser.id)
      appt1.set('date', todayStr + ' 00:00:00.000Z')
      appt1.set('start_time', '09:00')
      appt1.set('end_time', '11:00')
      appt1.set('status', 'in_progress')
      appt1.set('address_note', 'Visita na sede do cliente')
      appt1.set('notes', 'Lavar kit de ferramentas para diagnóstico de rede')
      app.save(appt1)
    }

    const soCol = app.findCollectionByNameOrId('service_orders')
    let order1, order2, order3
    try {
      order1 = app.findFirstRecordByData('service_orders', 'number', 'OS-0001')
    } catch (_) {
      order1 = new Record(soCol)
      order1.set('number', 'OS-0001')
      order1.set('customer', cust1.id)
      order1.set('technician', techUser.id)
      order1.set('status', 'in_progress')
      order1.set('priority', 'high')
      order1.set('title', 'Notebook Lento e Aquecendo')
      order1.set(
        'description',
        'O cliente relata lentidão extrema ao ligar e desligamento súbito durante uso pesado.',
      )
      order1.set('equipment', 'Dell Inspiron 15 5000 - i7 / 8GB')
      order1.set(
        'diagnostic',
        'Pasta térmica ressecada e cooler obstruído por poeira. Recomendado upgrade para SSD.',
      )
      order1.set('estimated_cost', 320)
      order1.set('total', 320)
      app.save(order1)
    }

    try {
      order2 = app.findFirstRecordByData('service_orders', 'number', 'OS-0002')
    } catch (_) {
      order2 = new Record(soCol)
      order2.set('number', 'OS-0002')
      order2.set('customer', cust2.id)
      order2.set('technician', adminUser.id)
      order2.set('appointment', appt1.id)
      order2.set('status', 'open')
      order2.set('priority', 'urgent')
      order2.set('title', 'Queda de Sinal de Wi-Fi no Escritório')
      order2.set('description', 'A rede sem fio cai intermitentemente afetando o setor de vendas.')
      order2.set('equipment', 'Roteador Mikrotik + 2 Access Points UniFi')
      order2.set('diagnostic', 'Aguardando análise técnica no local.')
      order2.set('estimated_cost', 200)
      order2.set('total', 200)
      app.save(order2)
    }

    try {
      order3 = app.findFirstRecordByData('service_orders', 'number', 'OS-0003')
    } catch (_) {
      order3 = new Record(soCol)
      order3.set('number', 'OS-0003')
      order3.set('customer', cust3.id)
      order3.set('technician', techUser.id)
      order3.set('status', 'closed')
      order3.set('priority', 'medium')
      order3.set('title', 'Recuperação de Fotos e Arquivos')
      order3.set('description', 'HD externo não reconhecido no sistema operacional.')
      order3.set('equipment', 'HD Externo Seagate 1TB')
      order3.set('diagnostic', 'Tabela de partições restaurada e arquivos copiados para pendrive.')
      order3.set('estimated_cost', 350)
      order3.set('total', 350)
      app.save(order3)
    }

    const itemCol = app.findCollectionByNameOrId('service_order_items')
    try {
      app.findFirstRecordByData('service_order_items', 'service_order', order1.id)
    } catch (_) {
      const item1 = new Record(itemCol)
      item1.set('service_order', order1.id)
      item1.set('service', seededServices[2].id)
      item1.set('description', 'Upgrade de Hardware (SSD / RAM)')
      item1.set('quantity', 1)
      item1.set('unit_price', 180)
      item1.set('total', 180)
      app.save(item1)

      const item2 = new Record(itemCol)
      item2.set('service_order', order1.id)
      item2.set('service', seededServices[3].id)
      item2.set('description', 'Manutenção Preventiva e Limpeza')
      item2.set('quantity', 1)
      item2.set('unit_price', 140)
      item2.set('total', 140)
      app.save(item2)
    }

    const shCol = app.findCollectionByNameOrId('status_history')
    try {
      app.findFirstRecordByData('status_history', 'service_order', order1.id)
    } catch (_) {
      const sh1 = new Record(shCol)
      sh1.set('service_order', order1.id)
      sh1.set('status', 'open')
      sh1.set('note', 'Ordem de serviço criada no atendimento')
      sh1.set('changed_by', attendantUser.id)
      app.save(sh1)

      const sh2 = new Record(shCol)
      sh2.set('service_order', order1.id)
      sh2.set('status', 'in_progress')
      sh2.set('note', 'Técnico iniciou a desmontagem e limpeza técnica')
      sh2.set('changed_by', techUser.id)
      app.save(sh2)
    }

    const payCol = app.findCollectionByNameOrId('payments')
    try {
      app.findFirstRecordByData('payments', 'service_order', order3.id)
    } catch (_) {
      const p1 = new Record(payCol)
      p1.set('service_order', order3.id)
      p1.set('amount', 350)
      p1.set('method', 'pix')
      p1.set('status', 'paid')
      p1.set('paid_at', todayStr + ' 00:00:00.000Z')
      p1.set('notes', 'Pagamento via Pix confirmado pelo cliente')
      app.save(p1)
    }
  },
  (app) => {},
)
