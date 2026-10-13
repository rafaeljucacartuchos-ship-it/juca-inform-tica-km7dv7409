migrate(
  (app) => {
    // 1) Adicionar novos campos de técnicos e vendedor na collection service_orders
    const soCol = app.findCollectionByNameOrId('service_orders')

    // second_technician (relação com users, opcional)
    if (!soCol.fields.getByName('second_technician')) {
      soCol.fields.add(
        new RelationField({
          name: 'second_technician',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // seller (relação com users, opcional)
    if (!soCol.fields.getByName('seller')) {
      soCol.fields.add(
        new RelationField({
          name: 'seller',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // division_model (modelo de divisão pré-configurado para os 5 cenários)
    if (!soCol.fields.getByName('division_model')) {
      soCol.fields.add(
        new SelectField({
          name: 'division_model',
          values: [
            'single_tech',
            'two_techs_split_services',
            'two_split_all',
            'tech_and_seller',
            'two_techs_and_seller',
            'custom',
          ],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // division_details (JSON estruturado com participações, percentuais, valores atribuídos e histórico)
    if (!soCol.fields.getByName('division_details')) {
      soCol.fields.add(
        new JSONField({
          name: 'division_details',
          required: false,
          maxSize: 2000000,
        }),
      )
    }

    app.save(soCol)
    console.log('0098: Campos de equipe e divisão adicionados a service_orders')

    // 2) Corrigir URLs das mensagens de pós-venda pendentes no banco
    // Substitui links internos incorretos por https://assistencia-tecnica-movel-86527.goskip.app
    // Apenas mensagens pendentes, ready ou lembrete (mensagens sent permanecem intocadas)
    try {
      const pendingMsgs = app.findRecordsByFilter(
        'pos_venda_messages',
        'status = "pending" || status = "ready" || status = "lembrete"',
        'created',
        5000,
        0,
      )

      let fixedCount = 0
      for (let i = 0; i < pendingMsgs.length; i++) {
        const msg = pendingMsgs[i]
        let txt = msg.getString('texto_gerado') || ''
        let link = msg.getString('wa_me_link') || ''
        let changed = false

        if (txt.includes('assistencia-tecnica-movel-86527--skip-app.shrd00.internal.goskip.dev')) {
          txt = txt.replace(
            /https:\/\/assistencia-tecnica-movel-86527--skip-app\.shrd00\.internal\.goskip\.dev/g,
            'https://assistencia-tecnica-movel-86527.goskip.app',
          )
          changed = true
        }

        // Higienizar menções a Not dell - Dell
        if (txt.includes('Not dell - Dell')) {
          txt = txt.replace(/Not dell - Dell/g, 'Notebook Dell')
          changed = true
        }

        if (link.includes('assistencia-tecnica-movel-86527--skip-app.shrd00.internal.goskip.dev')) {
          link = link.replace(
            /https(%3A%2F%2F|:\/\/)assistencia-tecnica-movel-86527--skip-app\.shrd00\.internal\.goskip\.dev/g,
            'https$1assistencia-tecnica-movel-86527.goskip.app',
          )
          changed = true
        }

        if (changed) {
          msg.set('texto_gerado', txt)
          msg.set('wa_me_link', link)
          app.save(msg)
          fixedCount++
        }
      }
      console.log('0098: Links de pós-venda pendentes regenerados com sucesso: ' + fixedCount)
    } catch (msgErr) {
      console.log('0098: Aviso ao atualizar links pendentes:', String(msgErr))
    }
  },
  (app) => {
    // Reversão segura
    try {
      const soCol = app.findCollectionByNameOrId('service_orders')
      if (soCol.fields.getByName('second_technician')) {
        soCol.fields.removeByName('second_technician')
      }
      if (soCol.fields.getByName('seller')) {
        soCol.fields.removeByName('seller')
      }
      if (soCol.fields.getByName('division_model')) {
        soCol.fields.removeByName('division_model')
      }
      if (soCol.fields.getByName('division_details')) {
        soCol.fields.removeByName('division_details')
      }
      app.save(soCol)
    } catch (_) {}
  },
)
