/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0078:
 * 1) Para cada orçamento com status 'rascunho' ou 'aguardando_aprovacao' vinculado a uma O.S. (id_os)
 *    cujo status seja 'completed' ou 'closed':
 *    - Atualizar status para 'aprovado'
 *    - Anexar carimbo nas observações:
 *      '[Aprovado automaticamente por conclusão da O.S. {numero} em {data} às {hora} por Sistema]'
 * 2) Atualizar qualquer orçamento restante com status='rascunho' para status='aguardando_aprovacao'
 * 3) Idempotente e seguro com down/no-op.
 */

migrate(
  (app) => {
    // 1) Identificar e auto-aprovar orçamentos pendentes de O.S. concluídas/fechadas
    try {
      const orcamentos = app.findRecordsByFilter(
        'orcamentos',
        'id_os != "" && (status = "rascunho" || status = "aguardando_aprovacao")',
        'created',
        0,
        0,
      )

      for (let i = 0; i < orcamentos.length; i++) {
        const orc = orcamentos[i]
        const idOs = orc.get('id_os')
        if (!idOs) continue

        let osRecord = null
        try {
          osRecord = app.findRecordById('service_orders', idOs)
        } catch (_) {
          continue
        }

        if (!osRecord) continue
        const osStatus = osRecord.get('status')
        if (osStatus !== 'completed' && osStatus !== 'closed') continue

        const osNum = osRecord.get('number') || 'S/N'
        const obsAtual = (orc.get('observacoes') || '').trim()

        let d = new Date()
        const osUpdated = osRecord.get('updated')
        if (osUpdated) {
          const parsed = new Date(osUpdated)
          if (!isNaN(parsed.getTime())) {
            d = parsed
          }
        }

        const dia = String(d.getDate()).padStart(2, '0')
        const mes = String(d.getMonth() + 1).padStart(2, '0')
        const ano = d.getFullYear()
        const hora = String(d.getHours()).padStart(2, '0')
        const min = String(d.getMinutes()).padStart(2, '0')
        const dataStr = dia + '/' + mes + '/' + ano
        const horaStr = hora + ':' + min

        const carimbo = `[Aprovado automaticamente por conclusão da O.S. ${osNum} em ${dataStr} às ${horaStr} por Sistema]`
        const novasObs = obsAtual ? `${obsAtual}\n${carimbo}` : carimbo

        orc.set('status', 'aprovado')
        orc.set('observacoes', novasObs)
        app.save(orc)
      }
    } catch (err) {
      console.log('[migration 0078] Erro ao auto-aprovar orçamentos de OS concluídas:', err)
      throw err
    }

    // 2) Converter quaisquer orçamentos restantes em 'rascunho' para 'aguardando_aprovacao'
    try {
      const rascunhos = app.findRecordsByFilter(
        'orcamentos',
        'status = "rascunho"',
        'created',
        0,
        0,
      )

      for (let j = 0; j < rascunhos.length; j++) {
        const rasc = rascunhos[j]
        rasc.set('status', 'aguardando_aprovacao')
        app.save(rasc)
      }
    } catch (err) {
      console.log('[migration 0078] Erro ao converter rascunho para aguardando_aprovacao:', err)
      throw err
    }
  },
  (app) => {
    // Reversão no-op segura
  },
)
