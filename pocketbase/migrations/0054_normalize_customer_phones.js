migrate(
  (app) => {
    // Padroniza o prefixo 55 em todos os telefones de clientes existentes no banco de dados SQLite
    const records = app.findRecordsByFilter('customers', '', '', 0, 0)
    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      const rawCel = rec.getString('celular') || rec.getString('phone') || ''
      if (!rawCel) continue

      let digits = rawCel.replace(/\D/g, '')
      if (!digits) continue

      while (digits.startsWith('0')) {
        digits = digits.substring(1)
      }

      let normalized = digits
      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        normalized = digits
      } else if (digits.length === 10 || digits.length === 11) {
        normalized = '55' + digits
      } else if (digits.length === 8 || digits.length === 9) {
        normalized = '5567' + digits
      }

      rec.set('celular', normalized)
      rec.set('phone', normalized)
      app.save(rec)
    }
  },
  (app) => {
    // Reversão não necessária para padronização de dados
  },
)
