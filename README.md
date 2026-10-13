# Indufarma

Sistema de gestão da farmácia: estoque, vendas, mais vendidos, compras, caixa, contas a pagar, clientes, fornecedores e câmbio. Todos os valores em dólar (US$).

## Como os dados ficam salvos

- **Neste computador, sempre.** Tudo é gravado primeiro no próprio computador (IndexedDB do navegador). O sistema abre e funciona mesmo sem internet.
- **Na nuvem, quando configurado.** Com internet e a conta da farmácia conectada, as alterações são enviadas ao Supabase e as feitas no outro computador são trazidas. Vendas feitas nos dois computadores ao mesmo tempo, mesmo sem internet, são somadas no estoque quando a internet volta.
- **Backup manual.** Em "Dados e backup" (canto inferior esquerdo) dá para baixar um arquivo com todos os dados e restaurá-lo depois.

Na primeira vez que esta versão abre em um navegador que já usava a versão anterior (ColorShop), os dados antigos são importados automaticamente.

## Configurar a nuvem (uma vez)

1. Crie uma conta grátis em [supabase.com](https://supabase.com) e um projeto novo.
2. No projeto, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication > Users**, crie o usuário da farmácia (e-mail e senha). Em **Authentication > Sign In / Providers**, desative "Allow new users to sign up" para ninguém mais criar conta.
4. Em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.
5. Na Vercel, em **Settings > Environment Variables**, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com esses valores e publique de novo.
6. Em cada computador, abra o sistema, clique em "Entre para sincronizar" e entre com o e-mail e a senha.

## Instalar nos computadores

Abra o site no Chrome ou Edge e clique em **Instalar no computador** (no menu lateral) ou no ícone de instalar na barra de endereço. O Indufarma ganha um ícone na área de trabalho e abre mesmo sem internet.

## Rodar localmente (opcional, exige Node.js)

```
npm install
cp .env.example .env   # opcional, só para usar a nuvem
npm run dev
```

## Publicar

A Vercel detecta que é um projeto Vite e publica sozinha a cada envio para o GitHub.
