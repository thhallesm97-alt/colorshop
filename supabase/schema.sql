-- Banco na nuvem do Indufarma (Supabase).
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

drop policy if exists "usuarios logados" on registros;
create policy "usuarios logados" on registros
  for all to authenticated using (true) with check (true);

-- Recebe um lote de alterações; quando o mesmo registro já tem uma versão mais nova, ela é mantida.
create or replace function salvar_registros(linhas jsonb) returns void
language sql security invoker set search_path = '' as $$
  insert into public.registros (colecao, id, dados, excluido, atualizado_em, criado_em)
  select r.colecao, r.id, r.dados, coalesce(r.excluido, false), r.atualizado_em, r.criado_em
  from jsonb_to_recordset(linhas) as r(colecao text, id text, dados jsonb, excluido boolean, atualizado_em bigint, criado_em bigint)
  on conflict (colecao, id) do update
    set dados = excluded.dados,
        excluido = excluded.excluido,
        atualizado_em = excluded.atualizado_em
    where public.registros.atualizado_em < excluded.atualizado_em;
$$;

revoke all on function salvar_registros(jsonb) from public, anon;
grant execute on function salvar_registros(jsonb) to authenticated;
