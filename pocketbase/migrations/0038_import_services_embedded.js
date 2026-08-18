// Importa os 57 serviços do CSV servicos_18_08_2026-2dc70.csv.
//
// Os dados estão EMBUTIDOS diretamente no código — não dependem de URL
// externa nem de filesystem. O $http não está disponível em migrações
// (apenas em hooks), por isso os dados foram extraídos do CSV e
// hardcoded como array.
//
// Colunas do CSV original:
//   Título | Descrição NFS-e | Formatação | Preço | Código externo
//   | Status | Observação | Template obs | obs editável | CNAE
//
// Regras:
//   - Título → name + title
//   - Descrição NFS-e → description
//   - Preço → price (vírgula decimal convertida)
//   - Código externo → external_code
//   - Status "Ativo" → active=true, status="active"
//   - Observação → obs
//   - CNAE → cnae
//   - Sem try/catch silencioso — falha se algo der errado
//   - Deleta registros existentes antes de importar

migrate(
  (app) => {
    // Cada linha: [title, description, price, external_code, cnae]
    var data = [
      ['3844 - SERVIÇO DE IMPLANTAÇAÕ E INSTALAÇÃO DE EQUIPAMENTOS', '', 50, '', ''],
      [
        '4074 - SERVIÇO DE INFRAESTRUTURA, REDE INTERNET, REDE TELECOMUNICAÇÃO, REDE CFTV E REDE ALARME',
        '',
        0,
        '',
        '',
      ],
      ['4227 - ANTI VIRUS KASPERSKY', '', 50, '4227', ''],
      [
        '6151 - CONFIG. E SEGURANÇA DE SERVIDOR LOCAL OTIMIZAÇÃO DE INFRA E GESTÃO DE ACESSO',
        '',
        110,
        '',
        '',
      ],
      ['Análise de Notebook', '', 40, '', ''],
      ['Antivirus Kaspersky  1 Ano', 'Kaspersky', 150, '', ''],
      ['Assistencia E Manutenção De Impressora', 'teste', 2, '', ''],
      ['ASSISTENCIA TECNICA', '', 80, '', ''],
      ['BANHO QUIMICO', '', 0, '', ''],
      ['Banho Químico Placa Mãe', '', 160, '', ''],
      ['Clonagem Do HD/SSD', '', 150, '', ''],
      ['configuração de rede wifi', '', 50, '', ''],
      ['Configurar Terminal SERVICE', '', 180, '', ''],
      ['CRIPAGEM', '', 10, '', ''],
      ['Envelopamento de Notebook', '', 0, '', ''],
      ['FORMATAÇÃO COM BKP E INSTALAÇÃO SISTEMA OPERACIONAL', '', 150, '', ''],
      ['Gravação e Atualização de Bios', '', 150, '', ''],
      [
        'Hora Técnica',
        'tempo cobrado por hora no local ( além do serviço contratado)',
        120,
        '',
        '',
      ],
      ['Instalação Corel', '', 150, '', ''],
      ['Instalação de Drives', '', 0, '', ''],
      ['Instalação de Impressora', '', 100, '', ''],
      ['Instalar Programas', '', 130, '', ''],
      ['Limpeza De Servidor Troca De Pasta Termica', '', 150, '', ''],
      ['LIMPEZA DO PICKP ROOLLER', '', 80, '', ''],
      ['LIMPEZA E TROCA DE PASTE TERMICA', '', 150, '', ''],
      ['LIMPEZA IMPRESSORA TERMICA', '', 0, '', ''],
      ['Limpeza interna projetor', '', 150, '', ''],
      ['manutenção e configuração de balança', '', 50, '', ''],
      ['MANUTENÇAO LASER IMPRESSORA', '', 150, '5919', ''],
      ['MANUTENÇAO SENSOR DE FOLHA', '', 0, '5964', ''],
      ['Mão de Obra', '', 0, '', ''],
      ['Montagem e adequação Gabinete gamer', '', 0, '', ''],
      ['REAJUSTE DE SISTEMA', '', 80, '', ''],
      ['RECARGA DE CARTUCHO PRETO', '', 20, '', ''],
      ['RECARGA DE TONER', '', 50, '', ''],
      ['RECUPERAÇÃO DE DADOS', '', 0, '', ''],
      ['Recuperação de dados Perdidos', 'valor partir de 150', 150, '', ''],
      ['Remoção de virus', '', 0, '', ''],
      ['Remoção de Virus', 'Remover vírus sem formatar', 120, '', ''],
      ['Remover Senha esquecida', '', 80, '', ''],
      ['Reparo  Usb Computador', 'Serviço De Reparo Em Usb Quebrada', 120, '', ''],
      ['Reparo Alto Falantes Note', '', 150, '', ''],
      ['Reparo Brinco Symbol', '', 0, '', ''],
      ['Reparo carcaça notebook', '', 0, '', ''],
      ['Reparo Carregador Norebook', '', 50, '', ''],
      ['Reparo de MBR SSD com recuperação de Arquivos', '', 280, '', ''],
      ['Reparo De Placa Mae', 'Reparo e troca de componentes placa mae', 0, '', ''],
      ['Reparo Inicialização do Notebook', '', 140, '', ''],
      ['Reparo Placa Mãe Computador', '', 150, '', ''],
      ['Reparo rack de Norebook', '', 300, '', ''],
      ['Reparo Tampa da Tela', '', 140, '', ''],
      ['Reparo Terminal Balança', '', 0, '', ''],
      ['RESETE DAS ALMOFADAS IMPRESSORA', '', 150, '', ''],
      ['Tempo Gasto para análise ( Buscas e Levar)', '', 0, '', ''],
      ['Transferência de Arquivos', '', 80, '', ''],
      ['TROCA TERMINAL DE ENTRADA DO TECLADO', '', 100, '', ''],
      ['VISITA TECNICA', '', 25, '', ''],
    ]

    var col = app.findCollectionByNameOrId('services')

    // Deletar registros existentes antes de importar
    app.truncateCollection(col)

    var count = 0
    var total = data.length

    for (var i = 0; i < data.length; i++) {
      var row = data[i]
      var title = (row[0] || '').trim()
      var description = (row[1] || '').trim()
      var price = row[2]
      var external_code = (row[3] || '').trim()
      var cnae = (row[4] || '').trim()

      var record = new Record(col)
      record.set('name', title)
      record.set('title', title)
      record.set('description', description)
      record.set('price', price)
      record.set('external_code', external_code)
      record.set('status', 'active')
      record.set('obs', '')
      record.set('obs_template', '')
      record.set('obs_editable', false)
      record.set('cnae', cnae)
      record.set('active', true)
      record.set('category', 'outros')
      record.set('estimated_duration', 0)

      // Sem try/catch — se falhar, a migração falha
      app.save(record)
      count++
    }

    console.log('✅ Serviços importados: ' + count + ' de ' + total)
  },
  (app) => {
    // Reversão: não restauramos os registros antigos.
  },
)
