# Imperio Ferreira

Projeto Next.js App Router para a barbearia Imperio Ferreira, reconstruido com base conceitual na `conceito-barbearia` e adaptado para operacao multi-barbeiro.

## Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Supabase / PostgreSQL

## O que foi implementado

- Home institucional com nova identidade visual
- Fluxo de agendamento com escolha de servico, data, barbeiro especifico ou `qualquer um disponivel`
- Reserva confirmada no backend com selecao real do barbeiro quando o cliente escolhe `qualquer`
- Area administrativa com login individual por barbeiro
- Agenda filtrada por sessao do barbeiro logado
- Bloqueios e horarios personalizados por barbeiro
- Consulta de meus agendamentos por celular com cancelamento
- Migration SQL inicial para barbeiros, servicos, agendamentos, bloqueios e horarios personalizados

## Variaveis de ambiente

Crie um arquivo `.env.local` com:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SESSION_SECRET=
```

## Como rodar

```bash
npm install
npm run dev
```

## Validacao local

```bash
npm run lint
npm run build
```

## Homologacao para producao

Checklist operacional completo em:

- [docs/homologacao-producao.md](docs/homologacao-producao.md)

Validacao automatizada recomendada antes de subir para producao:

```bash
npm run verify
npm run test:e2e
```

Atalho unico (gate de release):

```bash
npm run verify:release
```

Se for a primeira vez usando Playwright na maquina:

```bash
npm run test:e2e:install
```

## Verificacao automatica antes de deploy

O projeto agora possui uma bateria unificada:

```bash
npm run verify
```

Ela executa:

- `npm run lint`
- `npm run test`
- `npm run smoke`
- `npm run build`

### GitHub Actions

O workflow [`verify.yml`](c:\projetos\git\imperio-ferreira\.github\workflows\verify.yml) roda essa bateria em todo `push` e `pull request`.

### Vercel

O arquivo [`vercel.json`](c:\projetos\git\imperio-ferreira\vercel.json) configura o Vercel para executar `npm run verify` antes do deploy. Se qualquer etapa falhar, o deploy falha.

### Hook local

Para ativar o hook local de `pre-push` neste clone:

```bash
npm run setup:hooks
```

Depois disso, todo `git push` roda a bateria automaticamente antes de enviar a branch.
