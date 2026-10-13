# Documentação de Migração — Equipe e Divisão de Ordens de Serviço (JUCA INFORMÁTICA)

Este documento descreve detalhadamente a arquitetura de dados, relacionamentos, fórmulas de cálculo e procedimentos para exportação e importação/migração das funcionalidades de **Equipe e Divisão da OS** no sistema JUCA INFORMÁTICA.

---

## 1. Tabelas e Estruturas de Dados

### 1.1 Coleção Principal: `service_orders`

Adicionados campos estruturados para suportar múltiplos técnicos, vendedor responsável e o detalhamento da divisão apurada:

| Campo               | Tipo               | Descrição                                                                                                                                             |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `technician`        | `relation` (users) | Técnico principal / responsável pela O.S.                                                                                                             |
| `second_technician` | `relation` (users) | Segundo técnico coparticipante (opcional).                                                                                                            |
| `seller`            | `relation` (users) | Vendedor responsável pelo atendimento/fechamento (opcional).                                                                                          |
| `division_model`    | `select`           | Modelo de divisão aplicado. Valores: `single_tech`, `two_techs_split_services`, `two_split_all`, `tech_and_seller`, `two_techs_and_seller`, `custom`. |
| `division_details`  | `json`             | Objeto com apuração exata em centavos dos serviços e produtos de cada participante.                                                                   |

#### Estrutura do JSON `division_details`:

```json
{
  "model": "two_techs_split_services",
  "isCustom": false,
  "configured": true,
  "totalServices": 250.0,
  "totalProducts": 100.0,
  "orderTotal": 350.0,
  "participants": [
    {
      "userId": "usr_tech1",
      "userName": "Rafael Técnico",
      "role": "primary_tech",
      "servicesPct": 50,
      "productsPct": 0,
      "servicesAmount": 125.0,
      "productsAmount": 0.0,
      "totalAmount": 125.0
    },
    {
      "userId": "usr_tech2",
      "userName": "Lucas Suporte",
      "role": "second_tech",
      "servicesPct": 50,
      "productsPct": 0,
      "servicesAmount": 125.0,
      "productsAmount": 0.0,
      "totalAmount": 125.0
    }
  ]
}
```

### 1.2 Coleção de Auditoria: `order_division_history`

Registra todas as alterações de atribuição de equipe e divisão de valores para conferência administrativa, com trava de segurança e justificativa obrigatória caso a O.S. já esteja finalizada ou possua recebimentos:

| Campo                    | Tipo                        | Obrigatório | Descrição                                                                                   |
| ------------------------ | --------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `id`                     | `text` (PK)                 | Sim         | ID único estável do PocketBase (15 caracteres alfanuméricos).                               |
| `service_order`          | `relation` (service_orders) | Sim         | Chave estrangeira da O.S. (com cascade delete).                                             |
| `user`                   | `relation` (users)          | Não         | Usuário autenticado que realizou a alteração.                                               |
| `user_name`              | `text`                      | Não         | Nome do usuário para leitura imediata sem join.                                             |
| `action`                 | `text`                      | Não         | Ação executada (ex: `updated`).                                                             |
| `reason`                 | `text`                      | Não         | Motivo / justificativa da alteração.                                                        |
| `previous_state`         | `json`                      | Não         | Estado anterior dos campos (`technician`, `second_technician`, `seller`, `division_model`). |
| `new_state`              | `json`                      | Não         | Novo estado dos campos.                                                                     |
| `previous_details`       | `json`                      | Não         | Snapshot anterior de `division_details`.                                                    |
| `new_details`            | `json`                      | Não         | Novo snapshot de `division_details`.                                                        |
| `order_status_at_change` | `text`                      | Não         | Status da O.S. no momento em que ocorreu a modificação.                                     |
| `created`                | `autodate`                  | Sim         | Timestamp UTC de criação do registro.                                                       |
| `updated`                | `autodate`                  | Sim         | Timestamp UTC de atualização.                                                               |

---

## 2. Fórmulas de Cálculo e Regras da Divisão

### 2.1 Separação Rígida: Serviços vs. Produtos

- **Base de Serviços (`totalServicesCents`)**: Soma dos itens do tipo serviço (`item.product == null` ou `expand.product.type == 'servico'`) convertida em centavos inteiros (`Math.round(totalServices * 100)`).
- **Base de Produtos (`totalProductsCents`)**: Soma dos itens do tipo produto convertida em centavos inteiros (`Math.round(totalProducts * 100)`).

### 2.2 Distribuição Centavo a Centavo (Sem Perda de Precisão)

Para evitar discrepâncias decorrentes de arredondamentos decimais (dízimas periódicas como 33.33% ou divisões com resíduos):

1. **Truncamento inteiro para cada participante:**
   $$\text{cota\_participante\_centavos} = \left\lfloor \frac{\text{base\_centavos} \times \text{percentual}}{100} \right\rfloor$$
2. **Cálculo da soma e apuração do resíduo:**
   $$\text{residuo\_centavos} = \text{base\_centavos} - \sum \text{cotas\_calculadas}$$
3. **Atribuição do resíduo:**
   O resíduo remanescente (normalmente 1 ou 2 centavos) é atribuído ao **primeiro participante com cota $> 0\%$**, garantindo que a soma dos participantes seja **exatamente idêntica** ao total da O.S. ao centavo.

---

## 3. Regras de Integridade e Negócio

1. **Valor atribuído $\neq$ Comissão:**
   - Os valores de divisão apurados representam **produção/faturamento atribuído** a cada profissional.
   - O sistema **não cria nem altera regras de comissão** inexistentes.
2. **Ordens antigas sem divisão ("Divisão não informada"):**
   - Ordens históricas sem `division_details` são preservadas intactas.
   - Nos relatórios e exportações, são explicitamente rotuladas como **"Divisão não informada"** e mantidas separadas dos valores apurados, sem redistribuição retroativa arbitrária.
3. **Totais da Empresa (Contagem Única):**
   - Na consolidação financeira da empresa, cada O.S., venda e recebimento conta **uma única vez** através de seus IDs estáveis únicos. A presença de 2 técnicos ou vendedor em uma O.S. divide a responsabilidade e a produção daquela ordem, mas **jamais duplica** o faturamento ou a contagem de O.S. da empresa.
4. **Sigilo perante o Cliente:**
   - O cliente final (impressão de O.S., orçamento, link público, WhatsApp) tem acesso apenas à descrição do serviço e ao valor total devido. Percentuais de divisão, custos, margens e valores internos de divisão são estritamente restritos à equipe e administração.
