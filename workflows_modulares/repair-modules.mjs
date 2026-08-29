import fs from 'node:fs';

const source = JSON.parse(fs.readFileSync(new URL('../dfja_v50_operacional.json', import.meta.url)));
const byName = (name) => {
  const node = source.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Node ausente no V50: ${name}`);
  return structuredClone(node);
};
const clone = (name, overrides = {}) => ({ ...byName(name), ...overrides, parameters: { ...byName(name).parameters, ...(overrides.parameters || {}) } });
const credSheets = { googleSheetsOAuth2Api: { id: 'RpYIQnWXiTrXaDJO', name: 'Google Sheets account' } };
const base = (name, nodes, connections) => ({
  name, nodes, pinData: {}, connections, active: false,
  settings: { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: false, timeSavedMode: 'fixed', callerPolicy: 'workflowsFromSameOwner' },
  meta: { templateCredsSetupCompleted: true }, tags: []
});
const out = (file, workflow) => fs.writeFileSync(new URL(`./${file}`, import.meta.url), JSON.stringify(workflow, null, 2));

// 01: collection and deduplication only. AI is deliberately absent here.
const collection = JSON.parse(fs.readFileSync(new URL('./01-coleta-normalizacao-v2.json', import.meta.url)));
const cNodes = collection.nodes.filter((node) => node.name !== 'RSS Folha — Notícias' && node.name !== 'RSS UOL — Notícias');
const cMap = new Map(cNodes.map((node) => [node.name, node]));
const brasil = cMap.get('RSS Agência Brasil — Notícias');
if (brasil) { brasil.parameters = { ...brasil.parameters, url: 'https://agenciabrasil.ebc.com.br/rss.xml' }; brasil.credentials = undefined; }
const cnn = cMap.get('RSS CNN Brasil — Notícias');
if (cnn) cnn.parameters = { ...cnn.parameters, url: 'https://www.cnnbrasil.com.br/feed/' };
const metropoles = cMap.get('RSS Metrópoles — Notícias');
if (metropoles) metropoles.parameters = { ...metropoles.parameters, url: 'https://www.metropoles.com/feed' };
const mount = clone('Monta Registro Pendente — Notícias', { name: 'Monta Registro de Fila', id: 'dfja01-mount', position: [1000, 0] });
const prepare = cMap.get('Prepara Registro para Planilha — Notícias');
if (prepare) prepare.name = 'Prepara Registro para Planilha';
const save = cMap.get('Salva Pendente — Notícias');
if (save) save.credentials = credSheets;
const audit = cMap.get('Audita entrada');
const log = cMap.get('Grava Log — entrada');
if (log) log.credentials = credSheets;
cNodes.push(mount);
if (prepare) prepare.position = [1260, 0];
const c1 = {};
for (const [name, value] of Object.entries(collection.connections)) {
  if (!cMap.has(name)) continue;
  const cleaned = structuredClone(value);
  for (const output of Object.values(cleaned)) for (const branches of output) for (const branch of branches) {
    for (let i = branch.length - 1; i >= 0; i--) if (!cMap.has(branch[i].node)) branch.splice(i, 1);
  }
  c1[name] = cleaned;
}
c1['Schedule Trigger'].main[0] = c1['Schedule Trigger'].main[0].filter((item) => cMap.has(item.node));
c1['Filtra Duplicadas — Notícias'] = { main: [[{ node: 'Monta Registro de Fila', type: 'main', index: 0 }]] };
c1['Monta Registro de Fila'] = { main: [[{ node: 'Prepara Registro para Planilha', type: 'main', index: 0 }]] };
delete c1['Salva Pendente — Notícias'];
out('01-coleta-normalizacao-v3.json', base('DFJÁ 01 — Coleta e Normalização V3', cNodes, c1));

// 03: WhatsApp is the only gate that invokes the AI/PWA branch.
const w3nodes = [
  clone('Webhook Aprovação — Notícias', { name: 'Webhook Aprovação WhatsApp', id: 'dfja03-webhook', webhookId: 'dfja03-webhook-id', position: [0, 0], parameters: { httpMethod: 'POST', path: 'noticias-aprovacao-dfja-v2', options: {} } }),
  clone('Extrai Mensagem — Notícias', { name: 'Interpreta comando do aprovador', id: 'dfja03-extract', position: [260, 0] }),
  clone('Verifica Se É Aprovação — Notícias', { name: 'Valida comando e token', id: 'dfja03-validate', position: [520, 0] }),
  clone('Busca Pendentes — Notícias', { name: 'Busca Fila para decisão', id: 'dfja03-read', position: [780, 0], credentials: credSheets }),
  clone('Pega Mais Antiga Pendente — Notícias', { name: 'Resolve matéria pelo token', id: 'dfja03-resolve', position: [1040, 0] }),
  clone('Switch Decisão — Notícias', { name: 'Roteia decisão', id: 'dfja03-switch', position: [1300, 0] }),
  clone('Atualiza Sheet Rejeitada — Notícias', { name: 'Marca rejeitada na Fila', id: 'dfja03-reject', position: [1560, 160], credentials: credSheets }),
  clone('Confirma Descarte WhatsApp — Notícias', { name: 'Confirma rejeição no WhatsApp', id: 'dfja03-confirm-reject', position: [1820, 160] }),
  {
    id: 'dfja03-process', name: 'Envia matéria aprovada ao processamento', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1560, -120],
    parameters: { method: 'POST', url: 'https://n8n.dfja.com.br/webhook/dfja-processamento-pwa-v2', sendHeaders: true, headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json) }}', options: { timeout: 30000 } }
  },
  clone('Reescreve Novamente — Notícias', { name: 'Reescreve novamente sob comando', id: 'dfja03-refazer-ai', position: [1560, 420] }),
  clone('OpenAI Chat Model Refazer — Notícias', { name: 'Modelo IA para refazer', id: 'dfja03-refazer-model', position: [1560, 650] }),
  clone('Monta Atualização Refeita — Notícias', { name: 'Monta nova versão', id: 'dfja03-refazer-monta', position: [1820, 420] }),
  clone('Atualiza Sheet Refeita — Notícias', { name: 'Atualiza Fila após refazer', id: 'dfja03-refazer-save', position: [2080, 420], credentials: credSheets }),
  clone('Envia Nova Versão WhatsApp — Notícias', { name: 'Envia nova versão ao WhatsApp', id: 'dfja03-refazer-send', position: [2340, 420] })
];
const c3 = {
  'Webhook Aprovação WhatsApp': { main: [[{ node: 'Interpreta comando do aprovador', type: 'main', index: 0 }]] },
  'Interpreta comando do aprovador': { main: [[{ node: 'Valida comando e token', type: 'main', index: 0 }]] },
  'Valida comando e token': { main: [[{ node: 'Busca Fila para decisão', type: 'main', index: 0 }]] },
  'Busca Fila para decisão': { main: [[{ node: 'Resolve matéria pelo token', type: 'main', index: 0 }]] },
  'Resolve matéria pelo token': { main: [[{ node: 'Roteia decisão', type: 'main', index: 0 }]] },
  'Roteia decisão': { main: [[{ node: 'Envia matéria aprovada ao processamento', type: 'main', index: 0 }], [{ node: 'Marca rejeitada na Fila', type: 'main', index: 0 }], [{ node: 'Reescreve novamente sob comando', type: 'main', index: 0 }]] },
  'Marca rejeitada na Fila': { main: [[{ node: 'Confirma rejeição no WhatsApp', type: 'main', index: 0 }]] },
  'Reescreve novamente sob comando': { main: [[{ node: 'Monta nova versão', type: 'main', index: 0 }]] },
  'Modelo IA para refazer': { ai_languageModel: [[{ node: 'Reescreve novamente sob comando', type: 'ai_languageModel', index: 0 }]] },
  'Monta nova versão': { main: [[{ node: 'Atualiza Fila após refazer', type: 'main', index: 0 }]] },
  'Atualiza Fila após refazer': { main: [[{ node: 'Envia nova versão ao WhatsApp', type: 'main', index: 0 }]] }
};
out('03-webhook-whatsapp-v2.json', base('DFJÁ 03 — Webhook WhatsApp V2', w3nodes, c3));

// 04: AI runs only after PROCESSAR, then sends the rewrite to the actual PWA inbound route.
const w4nodes = [
  {
    id: 'dfja04-webhook', name: 'Webhook processamento aprovado', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: 'dfja04-webhook-id',
    parameters: { httpMethod: 'POST', path: 'dfja-processamento-pwa-v2', options: {} }
  },
  clone('Processa Matéria Aprovada — IA', { name: 'Reescreve matéria aprovada com IA', id: 'dfja04-ai', position: [300, 0] }),
  clone('OpenAI Chat Model — Notícias', { name: 'Modelo IA editorial', id: 'dfja04-model', position: [300, 500] }),
  {
    id: 'dfja04-normalize', name: 'Normaliza payload editorial', type: 'n8n-nodes-base.code', typeVersion: 2, position: [600, 0],
    parameters: { mode: 'runOnceForAllItems', jsCode: `const input = $input.first()?.json || {};
let parsed = {};
try {
  const fences = String.fromCharCode(96).repeat(3);
  const raw = String(input.output || input.text || input.response || '').replace(new RegExp('^\\\\s*' + fences + 'json\\\\s*', 'i'), '').replace(new RegExp('\\\\s*' + fences + '\\\\s*$'), '').trim();
  parsed = raw ? JSON.parse(raw) : {};
} catch (_) {}
const original = $('Webhook processamento aprovado').first()?.json || {};
const pick = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim()) || '';
return [{ json: {
  ...original,
  id: pick(original.id, original.story_id, original.n8n_item_id),
  titulo: pick(parsed.titulo, parsed.title, original.titulo, original.title),
  conteudo: pick(parsed.conteudo, parsed.content, original.conteudo, original.content, original.resumo),
  resumo: pick(parsed.resumo, parsed.summary, original.resumo, original.excerpt),
  categoria: pick(parsed.categoria, parsed.category, original.categoria, original.category, 'Brasil'),
  imagem_url: pick(parsed.imagem_url, parsed.image_url, original.imagem_url, original.image_url),
  link_original: pick(parsed.link, parsed.url, original.link_original, original.link, original.source_url),
  fonte: pick(parsed.fonte, original.fonte, original.source_name),
  processado_ia_em: new Date().toISOString()
} }];` }
  },
  {
    id: 'dfja04-pwa', name: 'Envia para PWA Editorial', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [900, 0],
    parameters: { method: 'POST', url: 'https://dfnews-ten.vercel.app/api/inbound', sendHeaders: true, headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }, { name: 'x-dfja-pwa-secret', value: '={{$env.N8N_PWA_INBOUND_SECRET}}' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ n8n_item_id: $json.id || $json.story_id, title: $json.titulo || $json.title, content: $json.conteudo || $json.content, excerpt: $json.resumo || $json.excerpt, image_url: $json.imagem_url || $json.image_url, image_credit: $json.image_credit || "", source_name: $json.fonte || $json.source_name, source_url: $json.link_original || $json.link || $json.source_url, author: $json.author || "Redação", tags: Array.isArray($json.tags) ? $json.tags : [], categoria: $json.categoria || $json.category || "Brasil" }) }}', options: { timeout: 30000 } }
  },
  clone('Atualiza Sheet Publicada — Notícias', { name: 'Marca enviada ao PWA na Fila', id: 'dfja04-sheet', position: [1200, 0], credentials: credSheets, parameters: { ...byName('Atualiza Sheet Publicada — Notícias').parameters, operation: 'update', columns: { ...byName('Atualiza Sheet Publicada — Notícias').parameters.columns, value: { id: "={{$('Normaliza payload editorial').first().json.id || $('Normaliza payload editorial').first().json.story_id}}", status: 'em_revisao_pwa', evento_ultimo: 'enviada_pwa', agente_ultimo: 'n8n:pwa', transicao_em: '={{new Date().toISOString()}}' }, matchingColumns: ['id'] } } })
];
const c4 = { 'Webhook processamento aprovado': { main: [[{ node: 'Reescreve matéria aprovada com IA', type: 'main', index: 0 }]] }, 'Reescreve matéria aprovada com IA': { main: [[{ node: 'Normaliza payload editorial', type: 'main', index: 0 }]] }, 'Modelo IA editorial': { ai_languageModel: [[{ node: 'Reescreve matéria aprovada com IA', type: 'ai_languageModel', index: 0 }]] }, 'Normaliza payload editorial': { main: [[{ node: 'Envia para PWA Editorial', type: 'main', index: 0 }]] }, 'Envia para PWA Editorial': { main: [[{ node: 'Marca enviada ao PWA na Fila', type: 'main', index: 0 }]] } };
out('04-processamento-editorial-pwa-v2.json', base('DFJÁ 04 — Processamento Editorial e PWA V2', w4nodes, c4));

// 05: the PWA callback is the source of truth for the final state in the Sheet.
const w5nodes = [
  {
    id: 'dfja05-webhook', name: 'Webhook retorno do PWA', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: 'dfja05-webhook-id',
    parameters: { httpMethod: 'POST', path: 'dfja-retorno-pwa-v2', options: {} }
  },
  { id: 'dfja05-validate', name: 'Valida retorno e estado', type: 'n8n-nodes-base.code', typeVersion: 2, position: [300, 0], parameters: { mode: 'runOnceForAllItems', jsCode: "const out=[]; for (const item of $input.all()) { const j=item.json||{}; if (!j.n8n_item_id && !j.article_id) continue; const status=String(j.status||j.editorial_status||'').toLowerCase(); const mapped=status==='publicada'?'publicada':status==='rascunho_wp'?'rascunho_wp':status==='erro_publicacao'?'erro_publicacao':'em_revisao_pwa'; out.push({json:{...j,id:j.n8n_item_id||j.id||'',status:mapped,link_wp:j.wordpress_url||j.wp_url||'',wp_post_id:j.wordpress_post_id||j.wp_post_id||'',wp_media_id:j.wordpress_media_id||j.wp_media_id||'',evento_ultimo:'retorno_pwa',agente_ultimo:'pwa',transicao_em:new Date().toISOString(),erro:j.last_error||j.erro||''}}); } return out;" } },
  clone('Atualiza Sheet Publicada — Notícias', { name: 'Atualiza Fila com resultado do PWA', id: 'dfja05-sheet', position: [600, 0], credentials: credSheets, parameters: { ...byName('Atualiza Sheet Publicada — Notícias').parameters, operation: 'update', columns: { ...byName('Atualiza Sheet Publicada — Notícias').parameters, value: { id: '={{$json.id}}', status: '={{$json.status}}', link_wp: '={{$json.link_wp}}', wp_post_id: '={{$json.wp_post_id}}', wp_media_id: '={{$json.wp_media_id}}', erro: '={{$json.erro}}', evento_ultimo: '={{$json.evento_ultimo}}', agente_ultimo: '={{$json.agente_ultimo}}', transicao_em: '={{$json.transicao_em}}' }, matchingColumns: ['id'] } } }),
  clone('Audita wordpress', { name: 'Audita retorno do PWA', id: 'dfja05-audit', position: [900, 0] }),
  clone('Grava Log — wordpress', { name: 'Grava log do retorno PWA', id: 'dfja05-log', position: [1200, 0], credentials: credSheets })
];
const c5 = { 'Webhook retorno do PWA': { main: [[{ node: 'Valida retorno e estado', type: 'main', index: 0 }]] }, 'Valida retorno e estado': { main: [[{ node: 'Atualiza Fila com resultado do PWA', type: 'main', index: 0 }]] }, 'Atualiza Fila com resultado do PWA': { main: [[{ node: 'Audita retorno do PWA', type: 'main', index: 0 }]] }, 'Audita retorno do PWA': { main: [[{ node: 'Grava log do retorno PWA', type: 'main', index: 0 }]] } };
out('05-publicacao-wordpress-v2.json', base('DFJÁ 05 — Retorno PWA, WordPress e Arquivo V2', w5nodes, c5));

console.log('Arquivos V2 gerados: módulos 03, 04 e 05.');
