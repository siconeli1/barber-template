# Homologacao real para entrada em producao

Este roteiro existe para responder uma pergunta objetiva: **"podemos colocar no ar com seguranca?"**

Ele combina 2 camadas:
- camada automatizada (lint, unit, build, e2e)
- camada manual operacional (cliente + admin + regras de negocio)

---

## 1) Pre-check de ambiente

Antes de qualquer teste:

1. Confirmar que a branch de release esta atualizada.
2. Confirmar variaveis de ambiente no ambiente alvo:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_SESSION_SECRET`
3. Confirmar que as migrations novas estao aplicadas no Supabase.
4. Confirmar dados minimos de teste:
   - servicos ativos
   - barbeiros ativos
   - pelo menos 1 cliente sem plano e 1 cliente com plano

---

## 2) Validacao automatizada (obrigatoria)

Rode nesta ordem:

```bash
npm run verify
npm run test:e2e
```

Se for primeira execucao do Playwright na maquina:

```bash
npm run test:e2e:install
```

Saida esperada:
- `verify` sem erro
- `test:e2e` sem falhas
- relatorio HTML gerado em `playwright-report/`

---

## 3) Escopo da suite E2E (Playwright)

Arquivos em [`e2e/`](../e2e):
- `home-navigation.spec.ts`
  - confirma carregamento da home
  - valida navegacao para `agendar`, `meus-agendamentos`, `minha-conta`
- `agendar-critical.spec.ts`
  - fluxo critico de cadastro por telefone + reserva
  - validacao de cobertura de plano e confirmacao avulsa
- `meus-agendamentos.spec.ts`
  - consulta por telefone
  - cancelamento com confirmacao
- `admin-login.spec.ts`
  - erro de credencial invalida
  - login com sucesso e acesso ao painel

---

## 4) Checklist manual de aceite (go/no-go)

### Cliente

- Home abre rapido no mobile e desktop.
- Fluxo de agendamento completo:
  - cadastro (nome + telefone quando necessario)
  - servico
  - data
  - barbeiro
  - horario
  - confirmacao
- Cliente com plano:
  - servico coberto -> confirma com saldo
  - sem saldo -> avisa e confirma avulso
  - servico fora do plano -> avisa e confirma avulso
- Meus agendamentos:
  - lista ativos
  - lista historico
  - cancelamento respeitando regra de 2 horas

### Admin

- Login/logout por barbeiro funcionando.
- Agenda dia e semana sem inconsistencias visuais.
- Socio visualiza dados gerais; barbeiro comum visualiza apenas escopo proprio.
- Acoes destrutivas com confirmacao:
  - cancelar
  - marcar falta
  - concluir atendimento
- Bloqueios funcionando por barbeiro.
- Marcacao manual funcionando com regras de cobranca:
  - cliente sem plano -> avulso automatico
  - cliente com plano -> seletor de cobranca visivel

### Integridade de negocio

- Horario cancelado volta para `Horario livre`.
- Agendamentos `no_show` nao aparecem como ativos para cliente.
- Historico do plano condiz com consumo real.
- Financeiro nao mistura escopos indevidos.

---

## 5) Evidencias que precisam ser salvas

- Print ou video curto de cada fluxo critico no mobile.
- Print do painel admin (agenda, bloqueios, marcar, financeiro, planos).
- Resultado do terminal:
  - `npm run verify`
  - `npm run test:e2e`
- Link do deploy candidato (preview/producao).

Sem evidencias, nao aprovar release.

---

## 6) Criterio de aprovacao final

A release so entra em producao se:

1. Todos os testes automatizados passaram.
2. Checklist manual completo sem bloqueadores.
3. Nenhum erro critico de UX/logica encontrado.
4. Responsavel registrou "APROVADO" com data/hora.

Se falhar qualquer item: **NO-GO**.

---

## 7) Comando rapido de release gate

```bash
npm run verify:release
```

Esse comando junta validacao tecnica base + E2E antes de subir para producao.
