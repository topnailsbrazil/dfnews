# DFJÁ — PWA Editorial V1

## Estado

Implementação separada do protótipo existente. O PWA é servido em `/admin`, exige Supabase Auth e usa o WordPress somente por rotas server-side. O workflow n8n fornecido é um scaffold importável e permanece inativo até configurar os segredos e conectar os nós de produção.

## Fluxo

`RSS/HTML → n8n → WhatsApp → PWA (/admin) → upload media WordPress → featured_media → post WordPress → Supabase → callback n8n → WhatsApp`

## Variáveis de servidor

Copie `.env.example` para o ambiente de desenvolvimento/Vercel e preencha apenas no painel de variáveis. Nunca use `NEXT_PUBLIC_` para segredos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORDPRESS_URL`
- `WORDPRESS_USERNAME`
- `WORDPRESS_APPLICATION_PASSWORD`
- `N8N_PWA_INBOUND_SECRET`
- `N8N_PWA_RESULT_SECRET`
- `N8N_PWA_RESULT_WEBHOOK_URL`

## Contratos

### n8n → PWA

`POST /api/inbound` com header `x-dfja-pwa-secret` e JSON contendo `n8n_item_id`, `title`, `content`, opcionalmente `excerpt`, `image_url`, `image_credit`, `source_name`, `source_url`, `author`, `tags` e categoria. O endpoint faz upsert por `n8n_item_id`; não deve ser alimentado com o conteúdo bruto da fila antiga.

### PWA → WordPress

O editor confirma a publicação. O servidor baixa `image_url`, envia para `/wp-json/wp/v2/media`, guarda o ID e cria/atualiza `/wp-json/wp/v2/posts` com `featured_media`. A imagem não é inserida no corpo.

### Idempotência

O endpoint de publicação retorna sucesso sem repetir a operação quando a matéria já tem `wordpress_post_id` e estado `publicada`. A atualização usa o campo `version` para detectar edição concorrente. A função Supabase `claim_article` reserva a matéria por 30 minutos para um aprovador; os autosaves registram snapshots em `article_revisions`. Tags são persistidas como `text[]` e enviadas ao WordPress quando o endpoint de tags estiver disponível.

## Migração Supabase

Aplicar `supabase/migrations/0004_editorial_pwa.sql` depois das três migrações existentes. Ela adiciona estados editoriais, IDs WordPress, imagem/crédito, auditoria de versões, locks e categorias iniciais.

## Primeiro teste

1. Aplicar a migração.
2. Criar o bucket público `editorial-media` no Storage.
3. Configurar as variáveis server-side.
4. Entrar em `/admin`.
5. Inserir uma matéria de teste ou enviar uma pelo endpoint n8n.
6. Editar título, resumo, categoria, tags e imagem.
7. Confirmar autosave.
8. Publicar com confirmação e verificar `featured_media`, Supabase e callback n8n.

## Limitações atuais

- Não há credenciais nos arquivos; WordPress, Supabase e n8n precisam ser configurados no ambiente.
- A migração ainda precisa ser aplicada no projeto Supabase antes de abrir `/admin`; o código local não aplica migrações automaticamente.
- A sincronização da planilha ainda deve ser conectada aos nós n8n atuais; o PWA mantém a cópia editorial no Supabase e envia callback do resultado.
- O upload por arquivo depende do bucket `editorial-media`; URL pública já funciona sem o bucket.
- A API do WordPress precisa permitir REST, upload de mídia, categorias e metadados editoriais.
