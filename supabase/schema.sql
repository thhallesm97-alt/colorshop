-- Banco na nuvem do Shopping 25 (Supabase).
-- Rode este arquivo uma vez no "SQL Editor" do projeto no Supabase.

create sequence if not exists registros_seq;

create table if not exists registros (
  colecao       text    not null,
  id            text    not null,
  dados         jsonb,
  excluido      boolean not null default false,
  atualizado_em bigint  not null,            -- hora da alteração no computador (ms)
  criado_em     bigint  not null,            -- ordem de exibição
  seq           bigint  not null default nextval('registros_seq'), -- ordem de chegada no servidor
  alterado_por  uuid    default auth.uid(),
  primary key (colecao, id)
);

create index if not exists registros_seq_idx on registros (seq);

-- Cada alteração recebe um novo número de sequência, para os computadores saberem o que é novo.
create or replace function registros_nova_seq() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.seq := nextval('public.registros_seq');
  new.alterado_por := auth.uid();
  return new;
end $$;

drop trigger if exists registros_nova_seq on registros;
create trigger registros_nova_seq before update on registros
  for each row execute function registros_nova_seq();

-- Só usuários com login acessam os dados.
alter table registros enable row level security;
revoke all on table registros from anon;
revoke all on sequence registros_seq from anon;


-- =====================================================================
-- Acessos: o dono vê tudo; cada vendedor vê só os próprios clientes, vendas
-- e orçamentos, e nunca o custo real, o caixa, as contas ou as compras.
-- =====================================================================

-- Donos do sistema (cadastrados à mão):
--   insert into public.acessos (email, papel) values ('email@do.dono', 'dono');
-- Vendedores não ficam aqui: entra como vendedor quem tem o e-mail no cadastro de
-- vendedores do sistema (e está ativo).
create table if not exists public.acessos (
  email       text primary key,
  papel       text not null check (papel in ('dono', 'vendedor')),
  vendedor_id text
);
alter table public.acessos enable row level security;
revoke all on table public.acessos from anon, authenticated;

create or replace function public.meu_vendedor() returns text
language sql stable security definer set search_path = '' as $$
  select r.id from public.registros r
  where r.colecao = 'vendedores' and not r.excluido
    and coalesce(r.dados ->> 'ativo', 'true') <> 'false'
    and lower(trim(r.dados ->> 'email')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and not exists (select 1 from public.acessos a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')))
  order by r.criado_em
  limit 1
$$;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select papel from public.acessos where email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    case when public.meu_vendedor() is not null then 'vendedor' end
  )
$$;

create or replace function public.meu_acesso() returns table (papel text, vendedor_id text)
language sql stable security definer set search_path = '' as $$
  select public.meu_papel(), public.meu_vendedor() where public.meu_papel() is not null
$$;

-- O que um vendedor pode ver.
create or replace function public.vendedor_ve(p_colecao text, p_id text, p_dados jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_colecao in ('clientes', 'vendas', 'orcamentos', 'movimentos', 'pedidosProduto', 'indicacoes') then coalesce(p_dados ->> 'vendedorId', '') = public.meu_vendedor()
    when p_colecao = 'vendedores' then p_id = public.meu_vendedor()
    when p_colecao in ('freteiros', 'config') then true
    else false
  end
$$;

drop policy if exists "usuarios logados" on public.registros;
drop policy if exists "ler conforme o acesso" on public.registros;
create policy "ler conforme o acesso" on public.registros
  for select to authenticated
  using ((select public.meu_papel()) = 'dono' or ((select public.meu_papel()) = 'vendedor' and public.vendedor_ve(colecao, id, dados)));

-- Gravação só pela função abaixo, que confere o acesso registro por registro.
revoke insert, update, delete on table public.registros from authenticated;

create or replace function public.salvar_registros(linhas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_papel  text := public.meu_papel();
  v_vend   text := public.meu_vendedor();
  r        record;
  atual    public.registros;
  v_existe boolean;
  v_dados  jsonb;
begin
  if v_papel is null then
    raise exception 'Este login não tem acesso ao sistema.' using errcode = '42501';
  end if;
  for r in
    select * from jsonb_to_recordset(linhas)
      as x(colecao text, id text, dados jsonb, excluido boolean, atualizado_em bigint, criado_em bigint)
  loop
    v_dados := r.dados;
    if v_papel = 'vendedor' then
      -- Vendedor só grava os próprios clientes, vendas e orçamentos; não mexe no caixa.
      -- O que ele não pode gravar é ignorado (não trava a sincronização dele).
      if r.colecao not in ('clientes', 'vendas', 'orcamentos', 'historico', 'pedidosProduto', 'indicacoes') then continue; end if;
      -- Cadastrar produto e indicar vendedor só com a permissão que o dono deu no cadastro dele.
      if r.colecao = 'pedidosProduto' and not coalesce((select (x.dados ->> 'podeCadastrarProduto')::boolean from public.registros x where x.colecao = 'vendedores' and x.id = v_vend), false) then continue; end if;
      if r.colecao = 'indicacoes' and not coalesce((select (x.dados ->> 'podeIndicarVendedor')::boolean from public.registros x where x.colecao = 'vendedores' and x.id = v_vend), false) then continue; end if;
      select * into atual from public.registros where colecao = r.colecao and id = r.id;
      v_existe := found;
      -- Histórico: o vendedor só acrescenta (não muda nem apaga), sempre com o nome dele.
      if r.colecao = 'historico' then
        if v_existe or coalesce(r.excluido, false) or v_dados is null then continue; end if;
        v_dados := v_dados || jsonb_build_object('vendedorId', v_vend, 'papel', 'vendedor',
          'quem', coalesce((select x.dados ->> 'nome' from public.registros x where x.colecao = 'vendedores' and x.id = v_vend), 'Vendedor'));
      end if;
      if v_existe and coalesce(atual.dados ->> 'vendedorId', '') <> v_vend then continue; end if;
      if coalesce(r.excluido, false) then
        -- Só o dono exclui vendas, clientes, produtos e indicações para aprovação.
        if r.colecao in ('vendas', 'clientes', 'pedidosProduto', 'indicacoes') then continue; end if;
      elsif coalesce(r.dados ->> 'vendedorId', '') <> v_vend then
        continue;
      end if;
      -- Só o dono marca a venda como paga: o vendedor mantém o status que já estava.
      if r.colecao = 'vendas' and v_dados is not null then
        v_dados := jsonb_set(v_dados, '{status}', case when v_existe then coalesce(atual.dados -> 'status', '"Pendente"'::jsonb) else '"Pendente"'::jsonb end);
      end if;
      -- Só o dono define a tabela de preço e o limite de crédito do cliente.
      if r.colecao = 'clientes' and v_dados is not null then
        v_dados := (v_dados - 'tabela' - 'limiteCredito') || jsonb_build_object(
          'tabela', case when v_existe then coalesce(atual.dados -> 'tabela', '"Varejo"'::jsonb) else '"Varejo"'::jsonb end,
          'limiteCredito', case when v_existe then coalesce(atual.dados -> 'limiteCredito', 'null'::jsonb) else 'null'::jsonb end);
      end if;
      -- Só o dono registra devoluções e pagamentos: o vendedor mantém os que já estavam.
      if r.colecao = 'vendas' and v_dados is not null then
        v_dados := (v_dados - 'devolucoes' - 'pagamentos') || jsonb_build_object(
          'devolucoes', case when v_existe then coalesce(atual.dados -> 'devolucoes', '[]'::jsonb) else '[]'::jsonb end,
          'pagamentos', case when v_existe then coalesce(atual.dados -> 'pagamentos', '[]'::jsonb) else '[]'::jsonb end);
      end if;
      -- Só o dono aprova a entrada do produto e o vendedor indicado.
      if r.colecao in ('pedidosProduto', 'indicacoes') and v_dados is not null then
        v_dados := (v_dados - 'status' - 'itemId' - 'vendedorCriadoId' - 'respondidoEm') || jsonb_build_object(
          'status', case when v_existe then coalesce(atual.dados -> 'status', '"Pendente"'::jsonb) else '"Pendente"'::jsonb end,
          'itemId', case when v_existe then coalesce(atual.dados -> 'itemId', 'null'::jsonb) else 'null'::jsonb end,
          'vendedorCriadoId', case when v_existe then coalesce(atual.dados -> 'vendedorCriadoId', 'null'::jsonb) else 'null'::jsonb end,
          'respondidoEm', case when v_existe then coalesce(atual.dados -> 'respondidoEm', 'null'::jsonb) else 'null'::jsonb end);
      end if;
      -- Só o dono aprova o preço alterado no orçamento.
      if r.colecao = 'orcamentos' and coalesce(v_dados ->> 'aprovacaoPreco', '') = 'Aprovado'
         and not (v_existe and coalesce(atual.dados ->> 'aprovacaoPreco', '') = 'Aprovado') then
        v_dados := jsonb_set(v_dados, '{aprovacaoPreco}', '"Pendente"'::jsonb);
      end if;
    end if;
    insert into public.registros (colecao, id, dados, excluido, atualizado_em, criado_em)
    values (r.colecao, r.id, v_dados, coalesce(r.excluido, false), r.atualizado_em, r.criado_em)
    on conflict (colecao, id) do update
      -- Um registro excluído guarda os últimos dados, para a exclusão chegar a quem podia vê-lo.
      set dados = case when excluded.excluido then coalesce(public.registros.dados, excluded.dados) else excluded.dados end,
          excluido = excluded.excluido,
          atualizado_em = excluded.atualizado_em
      where public.registros.atualizado_em < excluded.atualizado_em;
  end loop;
end $$;

-- Estoque para o vendedor: quantidade atual já calculada pelo servidor (ele não recebe as
-- compras nem as vendas dos outros) e sem o custo real.
create or replace function public.estoque_vendedor() returns table (id text, dados jsonb, criado_em bigint)
language sql stable security definer set search_path = '' as $$
  with itens as (
    select r.id, r.dados, r.criado_em,
           coalesce(nullif(r.dados ->> 'baseEm', '')::numeric, 0) as base_em,
           coalesce(nullif(r.dados ->> 'qtd', '')::numeric, 0) as qtd
    from public.registros r
    where r.colecao = 'estoque' and not r.excluido and public.meu_papel() is not null
  ),
  mov as (
    select l ->> 'itemId' as item_id,
           (case when r.colecao = 'compras' then 1 else -1 end) * coalesce(nullif(l ->> 'qtd', '')::numeric, 0) as q,
           coalesce(nullif(r.dados ->> 'ts', '')::numeric, 0) as ts
    from public.registros r
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.dados -> 'itens') = 'array' then r.dados -> 'itens' else '[]'::jsonb end) l
    where r.colecao in ('compras', 'vendas') and not r.excluido
    union all
    -- Produtos que o cliente devolveu voltam ao estoque.
    select x ->> 'itemId', coalesce(nullif(x ->> 'qtd', '')::numeric, 0), coalesce(nullif(d ->> 'ts', '')::numeric, 0)
    from public.registros r
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.dados -> 'devolucoes') = 'array' then r.dados -> 'devolucoes' else '[]'::jsonb end) d
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d -> 'itens') = 'array' then d -> 'itens' else '[]'::jsonb end) x
    where r.colecao = 'vendas' and not r.excluido
  )
  select i.id,
         -- Sem custo para vendedores definido, o vendedor vê (e ganha comissão sobre) o custo real.
         (i.dados - 'custo') || jsonb_build_object(
           'custoVendedor', coalesce(nullif(i.dados -> 'custoVendedor', 'null'::jsonb), i.dados -> 'custo'),
           'qtd', i.qtd + coalesce((select sum(m.q) from mov m where m.item_id = i.id and m.ts > i.base_em), 0),
           'baseEm', floor(extract(epoch from clock_timestamp()) * 1000)
         ),
         i.criado_em
  from itens i
$$;

-- Funções que só devolvem o acesso de quem chama; a regra de leitura usa as três primeiras.
revoke all on function public.meu_papel(), public.meu_vendedor(), public.vendedor_ve(text, text, jsonb),
  public.meu_acesso(), public.salvar_registros(jsonb), public.estoque_vendedor() from public, anon;
grant execute on function public.meu_papel(), public.meu_vendedor(), public.vendedor_ve(text, text, jsonb),
  public.meu_acesso(), public.salvar_registros(jsonb), public.estoque_vendedor() to authenticated;

-- =====================================================================
-- Fotos dos produtos: qualquer pessoa com o link vê (é o link enviado ao
-- cliente); só o dono envia.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-produtos', 'fotos-produtos', true, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "dono envia fotos" on storage.objects;
create policy "dono envia fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-produtos' and (select public.meu_papel()) = 'dono');

-- =====================================================================
-- Login por usuário: "joao" vira o e-mail interno joao@shopping25.app.
-- O dono cria e troca o login e a senha dos vendedores pelo sistema.
-- =====================================================================
create or replace function public.email_de_login(p text) returns text
language sql immutable set search_path = '' as $$
  select case when p is null or trim(p) = '' then null
              when position('@' in p) > 0 then lower(trim(p))
              else lower(trim(p)) || '@shopping25.app' end
$$;

create or replace function public.meu_vendedor() returns text
language sql stable security definer set search_path = '' as $$
  select r.id from public.registros r
  where r.colecao = 'vendedores' and not r.excluido
    and coalesce(r.dados ->> 'ativo', 'true') <> 'false'
    and public.email_de_login(r.dados ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
    and not exists (select 1 from public.acessos a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')))
  order by r.criado_em
  limit 1
$$;

-- Cria o login (ou troca a senha, se já existir). Só o dono pode, e nunca para um dono.
create or replace function public.definir_login(p_usuario text, p_senha text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := public.email_de_login(p_usuario);
  v_id uuid;
begin
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'Só o dono cria ou troca logins.' using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]+$' then
    raise exception 'Usuário inválido. Use letras, números, ponto ou traço.';
  end if;
  if length(coalesce(p_senha, '')) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  if exists (select 1 from public.acessos where email = v_email) then
    raise exception 'Este login é de um dono e não pode ser mudado por aqui.';
  end if;
  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now() where id = v_id;
  end if;
  return v_email;
end $$;

revoke all on function public.definir_login(text, text) from public, anon;
grant execute on function public.definir_login(text, text), public.email_de_login(text) to authenticated;

-- =====================================================================
-- Comissão de indicação: o vendedor vê os vendedores que indicou e as vendas
-- deles, só com produtos, quantidades e o custo para vendedores (sem clientes).
-- =====================================================================
create or replace function public.vendas_dos_indicados()
returns table (vendedor_id text, vendedor_nome text, indicado_por text, meta numeric, venda jsonb)
language sql stable security definer set search_path = '' as $$
  select iv.id, iv.dados ->> 'nome', iv.dados ->> 'indicadoPor', coalesce(nullif(iv.dados ->> 'meta', '')::numeric, 0),
         case when v.id is null then null else jsonb_build_object(
           'id', v.id, 'vendedorId', v.dados -> 'vendedorId', 'data', v.dados -> 'data',
           'valor', v.dados -> 'valor', 'valorProdutos', v.dados -> 'valorProdutos',
           'itens', (select coalesce(jsonb_agg(jsonb_build_object('itemId', l -> 'itemId', 'qtd', l -> 'qtd', 'subtotal', l -> 'subtotal', 'custoVendedor', l -> 'custoVendedor') order by i), '[]'::jsonb)
                     -- Mantém a ordem dos produtos: as devoluções apontam para a posição (linha).
                     from jsonb_array_elements(case when jsonb_typeof(v.dados -> 'itens') = 'array' then v.dados -> 'itens' else '[]'::jsonb end) with ordinality as x(l, i)),
           'devolucoes', (select coalesce(jsonb_agg(jsonb_build_object('itens', d -> 'itens')), '[]'::jsonb)
                     from jsonb_array_elements(case when jsonb_typeof(v.dados -> 'devolucoes') = 'array' then v.dados -> 'devolucoes' else '[]'::jsonb end) d)
         ) end
  from public.registros iv
  left join public.registros v on v.colecao = 'vendas' and not v.excluido and v.dados ->> 'vendedorId' = iv.id
  where iv.colecao = 'vendedores' and not iv.excluido
    and public.meu_vendedor() is not null
    and iv.dados ->> 'indicadoPor' = public.meu_vendedor()
$$;
revoke all on function public.vendas_dos_indicados() from public, anon;
grant execute on function public.vendas_dos_indicados() to authenticated;
