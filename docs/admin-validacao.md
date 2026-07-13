# Checklist de validacao do admin

Use este roteiro sempre que houver mudancas no painel administrativo, nas permissoes de cargo ou nas regras de agenda.

## Perfis para teste

- Socio: `lucas` ou `ryan`
- Barbeiro comum: `alexandre` ou `peixoto`

## 1. Login e sessao

- Entrar como socio e confirmar que o painel abre normalmente.
- Entrar como barbeiro comum e confirmar que o painel abre normalmente.
- Fazer logout e confirmar retorno para `/admin/login`.

## 2. Agenda

- Como socio, abrir [Agenda](c:\projetos\git\imperio-ferreira\app\admin\page.tsx) e confirmar que existe seletor de barbeiro.
- Como barbeiro comum, abrir a mesma tela e confirmar que nao existe seletor de barbeiro.
- Como socio, selecionar outro barbeiro e confirmar que a mensagem de contexto mostra o nome correto.
- Como socio, concluir ou cancelar um agendamento de outro barbeiro e confirmar sucesso.
- Como barbeiro comum, tentar cancelar um agendamento de outro barbeiro via API e confirmar retorno `403`.

## 3. Bloqueios

- Como socio, abrir [Bloqueios](c:\projetos\git\imperio-ferreira\app\admin\bloqueios\page.tsx) e confirmar seletor de barbeiro.
- Como socio, criar um bloqueio para outro barbeiro e confirmar que ele aparece apenas para o barbeiro selecionado.
- Como barbeiro comum, confirmar ausencia do seletor de barbeiro.
- Como barbeiro comum, tentar remover bloqueio de outro barbeiro via API e confirmar retorno `403`.

## 4. Marcacao manual

- Como socio, abrir [Marcar horarios](c:\projetos\git\imperio-ferreira\app\admin\marcar\page.tsx) e confirmar seletor de barbeiro.
- Como socio, marcar um horario para outro barbeiro e confirmar que ele aparece na agenda correta.
- Como barbeiro comum, confirmar que a tela opera apenas no proprio barbeiro.
- Confirmar que conflitos de agenda continuam sendo barrados.

## 5. Financeiro

- Como socio, abrir [Financeiro](c:\projetos\git\imperio-ferreira\app\admin\financeiro\page.tsx) e confirmar acesso a `Visao geral da barbearia`.
- Como barbeiro comum, confirmar que so existe `Meu financeiro`.
- Como barbeiro comum, tentar chamar `/api/admin/financeiro?escopo=geral` e confirmar retorno `403`.

## 6. Clientes

- Como qualquer admin, abrir [Clientes](c:\projetos\git\imperio-ferreira\app\admin\clientes\page.tsx) e confirmar listagem geral.
- Confirmar busca por nome, telefone e e-mail Google.
- Abrir o perfil de um cliente e confirmar carregamento do historico.
- Como barbeiro comum, tentar editar dados cadastrais diretamente via API e confirmar retorno `403`.

## 7. Planos

- Como qualquer admin, abrir [Planos](c:\projetos\git\imperio-ferreira\app\admin\planos\page.tsx) e confirmar listagem de assinantes.
- Adicionar um plano para cliente sem plano e confirmar criacao da assinatura.
- Renovar plano existente e confirmar criacao do lancamento financeiro.
- Registrar uso manual e confirmar reducao do saldo.
- Cancelar plano e confirmar mudanca de status.

## 8. Regressao rapida

- `npm run lint`
- `npm run build`
- Confirmar navegacao mobile nas rotas:
  - `/admin`
  - `/admin/bloqueios`
  - `/admin/marcar`
  - `/admin/financeiro`
  - `/admin/clientes`
  - `/admin/planos`

## 9. Pontos de atencao

- Sempre testar socio e barbeiro comum no mesmo ciclo.
- Sempre validar tanto a interface quanto a API.
- Se um botao sumir no front, ainda assim testar a rota correspondente para garantir que o backend continua protegido.
