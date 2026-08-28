# DFJÁ

Domínio previsto: https://dfja.com.br

MVP de um portal mobile-first de notícias do Distrito Federal e Entorno.

## Stack

- Next.js + React + TypeScript
- Supabase para banco, autenticação e mídia
- Vercel para deploy
- GitHub para versionamento

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Central Editorial PWA

Abra http://localhost:3000/admin para a fila editorial. A configuração completa está em `docs/PWA-EDITORIAL-INTEGRACAO.md`; aplique a migração `supabase/migrations/0004_editorial_pwa.sql` antes de usar a fila.

As credenciais ficam em `.env.local`, que não deve ser commitado. Use `.env.example` como referência.
