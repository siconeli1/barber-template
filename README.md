# Barber Template

Template de site de agendamento para barbearias (Next.js App Router), derivado do projeto da Barbearia Imperio Ferreira. Toda a marca — nome, logo, cores, fonte, servicos, precos, horarios, WhatsApp, endereco e redes sociais — vem de um unico arquivo de configuracao. Nenhum componente escreve dado de negocio direto.

## Modo demo (padrao, sem banco de dados)

Sem nenhuma variavel de ambiente o site roda em **modo demo**: clientes, agendamentos, bloqueios, assinaturas e financeiro sao gravados em `data/demo-db.json` (criado automaticamente, fora do git). Nao ha conexao com banco externo — ideal para mostrar o sistema a novos leads.

- **Login do painel admin**: usuario `admin`, senha `1234`
- **Barbeiro**: um unico barbeiro generico chamado "Barbeiro" (definido em `barbeiros` no config)
- Para resetar a demo, apague `data/demo-db.json`
- Em hospedagem com filesystem somente leitura (ex.: Vercel), os dados vivem em memoria e resetam a cada cold start — comportamento aceitavel para demo

Para producao com banco real, defina `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_SESSION_SECRET` (ver `.env.example`) e rode as migrations de `db/migrations/` — o mesmo codigo passa a usar o Supabase do cliente.

## Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Supabase / PostgreSQL

## Como a configuracao funciona

- [`barbershop.config.ts`](barbershop.config.ts) — aponta para a config ativa (uma linha).
- [`configs/`](configs/) — um arquivo por cliente ([`imperio-ferreira.ts`](configs/imperio-ferreira.ts) e o exemplo [`magnata.ts`](configs/magnata.ts)).
- [`lib/barbershop-config-types.ts`](lib/barbershop-config-types.ts) — o tipo `BarbershopConfig` com todos os campos documentados.
- [`public/logos/`](public/logos/) — as logos referenciadas pelo config.

As cores e fontes do config viram CSS variables (`--accent`, `--background`, `--font-sans`, ...) injetadas no `<html>` por [`lib/theme.ts`](lib/theme.ts) via [`app/layout.tsx`](app/layout.tsx). Os componentes so usam `var(--accent)` / `rgba(var(--accent-rgb), ...)`, entao trocar a paleta inteira e editar um unico lugar. Horarios de funcionamento alimentam tanto o motor de agenda ([`lib/agenda.ts`](lib/agenda.ts)) quanto o texto da home. Servicos e planos do config sao o fallback quando o banco esta vazio ou indisponivel — a fonte primaria em producao continua sendo as tabelas `servicos` e `planos` do Supabase.

## Criando a demo de um novo cliente

1. **Logo**: salve a logo em `public/logos/<cliente>.jpg` (ou `.svg`/`.png`).
2. **Config**: copie `configs/magnata.ts` para `configs/<cliente>.ts` e preencha nome, `slug` (sem espacos/acentos — isola sessoes no navegador), WhatsApp, endereco, redes sociais, cores, fonte, horarios, barbeiros, servicos e planos.
3. **Ative**: em `barbershop.config.ts`, troque o import:

   ```ts
   export { default } from "@/configs/<cliente>";
   ```

4. **Favicon** (opcional): substitua `app/favicon.ico`.
5. **Confira**: `npm run dev` e revise home, /agendar e /admin.
6. **Deploy**: crie um projeto no Vercel apontando para o repo/branch da demo. Para demo nenhuma variavel de ambiente e necessaria (opcionalmente `NEXT_PUBLIC_SITE_URL` com a URL final); para producao configure o Supabase (ver "Modo demo" acima). O `vercel.json` ja roda `npm run verify` antes de cada deploy.

Para dados reais (servicos, planos, barbeiros) em producao, rode as migrations de [`db/migrations/`](db/migrations/) num projeto Supabase proprio do cliente e cadastre o catalogo nas tabelas — o config cobre a demo e o fallback.

## Variaveis de ambiente

Nenhuma e necessaria no modo demo. Para producao, crie `.env.local` (ver `.env.example`):

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

## Validacao

```bash
npm run verify        # lint + testes + smoke + build
npm run verify:release # verify + e2e (Playwright)
```

O workflow [`verify.yml`](.github/workflows/verify.yml) roda a bateria em todo `push`/`pull request`, e o [`vercel.json`](vercel.json) a executa antes de cada deploy. Hook local de pre-push: `npm run setup:hooks`.

## Funcionalidades

- Home institucional com identidade visual do cliente
- Agendamento com escolha de servico, data e barbeiro (ou "qualquer um disponivel")
- Area administrativa com login individual por barbeiro: agenda, bloqueios, marcacoes manuais, clientes, financeiro e planos
- Consulta/cancelamento de agendamentos pelo cliente
- Planos mensais com assinatura via WhatsApp
