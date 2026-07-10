# ColorShop

Painel de gestão comercial (estoque, vendas, compras, caixa, contas a pagar, câmbio).

## Rodar localmente (opcional, exige Node.js instalado)
```
npm install
npm run dev
```

## Publicar
Veja o passo a passo completo enviado pelo Claude. Resumo:
1. Suba esta pasta para um repositório no GitHub.
2. Importe o repositório na Vercel (vercel.com).
3. A Vercel detecta automaticamente que é um projeto Vite e publica sozinha.

## Observação sobre os dados
Os dados (estoque, vendas, clientes etc.) ficam salvos no `localStorage` do navegador —
ou seja, salvos naquele computador/navegador específico. Se você abrir o site em outro
aparelho, ele começa "do zero". Para dados compartilhados entre vários aparelhos/usuários,
é necessário um banco de dados real (ex: Supabase), que pode ser adicionado depois.
