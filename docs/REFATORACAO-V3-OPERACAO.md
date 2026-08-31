# DFJÁ — Contrato operacional V3

## Fonte única da fila

Os workflows ativos usam a aba `Fila_Operacional` da planilha `DFJÁ — Pauta Editorial`.
A aba `Fila` foi preservada como legado e não recebe novas gravações.

## Estados principais

`aguardando_moderacao` → `aguardando_aprovacao` → `processando_ia` → `em_revisao_pwa` → `rascunho_wp`/`publicada`.

Estados terminais ou de exceção: `rejeitada` e `erro`.

## Identidade e idempotência

- `story_key` identifica a matéria de forma durável.
- `approval_token` identifica a decisão e é curto o suficiente para o limite do Telegram.
- `telegram_message_id` e `telegram_sent_at` impedem o reenvio da mesma matéria.
- `pwa_article_id` e `wp_post_id` vinculam os destinos editoriais.
- `evento_ultimo`, `agente_ultimo`, `execution_id` e `transicao_em` formam a trilha operacional.

## Cadeia publicada

1. `DFJÁ 01 — Coleta e Normalização V3` grava registros canônicos na fila.
2. `DFJÁ 02 — Disparo Telegram em Lotes` lê somente itens não enviados, em lotes de 10.
3. `DFJÁ 03 — Webhook Telegram V2` resolve o token, atualiza a decisão e chama o processamento.
4. `DFJÁ 04 — Processamento Editorial e PWA V2 — Telegram` reescreve com IA e envia ao PWA.
5. `DFJÁ 05 — Retorno PWA, WordPress e Arquivo V2` sincroniza os estados e IDs de publicação.

As mudanças foram publicadas somente depois de a fila receber matérias e de dois lotes consecutivos serem enviados sem erro.
