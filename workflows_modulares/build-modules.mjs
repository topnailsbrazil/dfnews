import fs from 'node:fs';
const src=JSON.parse(fs.readFileSync(new URL('../dfja_v50_operacional.json',import.meta.url),'utf8'));
const byName=new Map(src.nodes.map(n=>[n.name,n]));
const clone=(name)=>JSON.parse(JSON.stringify(byName.get(name)));
const make=(name,names,connections)=>{const nodes=names.map(clone).filter(Boolean); const j={name, nodes, connections, active:false, settings:{executionOrder:'v1'}, versionId:undefined, meta:{templateCredsSetupCompleted:true}}; return j;};
const out=(file,j)=>fs.writeFileSync(new URL('./'+file,import.meta.url),JSON.stringify(j,null,2));

const trigger=clone('Schedule Trigger'); trigger.name='Despacho a cada 10 min'; trigger.parameters.rule={interval:[{field:'minutes',minutesInterval:10}]};
const n2=['Le Fila Antes do Lote — Notícias','Envia Aprovação WhatsApp — Lote','Marca Envio WhatsApp — Idempotência','Audita whatsapp','Grava Log — whatsapp'];
const j2=make('DFJÁ 02 — Disparo WhatsApp em Lotes',n2,{}); j2.nodes.unshift(trigger);
const mark2=j2.nodes.find((n)=>n.name==='Marca Envio WhatsApp — Idempotência');
if (mark2?.parameters?.columns?.value) {
  mark2.parameters.columns.value.message_id = "={{ (()=>{const r=$json.whatsapp_response||{};return r?.key?.id||r?.data?.key?.id||r?.data?.id||r?.id||(Array.isArray(r?.message_ids)?r.message_ids[0]:'')||''})() }}";
  mark2.parameters.columns.value.http_status = "={{ $json.whatsapp_status === 'enviado' ? '200' : '500' }}";
}
j2.connections={ [trigger.name]:{main:[[{node:n2[0],type:'main',index:0}]]}, [n2[0]]:{main:[[{node:n2[1],type:'main',index:0}]]}, [n2[1]]:{main:[[{node:n2[2],type:'main',index:0}]]}, [n2[2]]:{main:[[{node:n2[3],type:'main',index:0}]]}, [n2[3]]:{main:[[{node:n2[4],type:'main',index:0}]]} }; out('02-disparo-whatsapp-completo.json',j2);

const n3=['Webhook Aprovação — Notícias','Extrai Mensagem — Notícias','Verifica Se É Aprovação — Notícias','Busca Pendentes — Notícias','Pega Mais Antiga Pendente — Notícias','Switch Decisão — Notícias','Atualiza Sheet Rejeitada — Notícias','Confirma Descarte WhatsApp — Notícias','Reescreve Novamente — Notícias','Monta Atualização Refeita — Notícias','Atualiza Sheet Refeita — Notícias','Envia Nova Versão WhatsApp — Notícias'];
const j3=make('DFJÁ 03 — Webhook de Decisão WhatsApp',n3,{}); j3.connections={ [n3[0]]:{main:[[{node:n3[1],type:'main',index:0}]]}, [n3[1]]:{main:[[{node:n3[2],type:'main',index:0}]]}, [n3[2]]:{main:[[{node:n3[3],type:'main',index:0}]]}, [n3[3]]:{main:[[{node:n3[4],type:'main',index:0}]]}, [n3[4]]:{main:[[{node:n3[5],type:'main',index:0}]]}, [n3[5]]:{main:[[{node:'Processa Matéria Aprovada — IA',type:'main',index:0}],[{node:n3[6],type:'main',index:0}],[{node:n3[8],type:'main',index:0}]]}, [n3[6]]:{main:[[{node:n3[7],type:'main',index:0}]]}, [n3[8]]:{main:[[{node:n3[9],type:'main',index:0}]]}, [n3[9]]:{main:[[{node:n3[10],type:'main',index:0}]]}, [n3[10]]:{main:[[{node:n3[11],type:'main',index:0}]]} }; out('03-webhook-whatsapp-completo.json',j3);

const n4=['Processa Matéria Aprovada — IA','Normaliza Matéria Aprovada — IA','Verifica Imagem Candidata — Notícias','Baixa Imagem Candidata — Notícias','Envia Imagem para WordPress — Notícias','Combina Dados com Mídia — Notícias'];
const j4=make('DFJÁ 04 — Processamento Editorial e PWA',n4,{}); const pwa=clone('Envia Aprovação WhatsApp — Notícias'); pwa.name='Envia matéria para PWA'; pwa.parameters.url='https://dfnews-ten.vercel.app/api/editorial/inbox'; j4.nodes.push(pwa); j4.connections={ [n4[0]]:{main:[[{node:n4[1],type:'main',index:0}]]}, [n4[1]]:{main:[[{node:n4[2],type:'main',index:0}]]}, [n4[2]]:{main:[[{node:'Envia matéria para PWA',type:'main',index:0}],[{node:n4[3],type:'main',index:0}]]}, [n4[3]]:{main:[[{node:n4[4],type:'main',index:0}]]}, [n4[4]]:{main:[[{node:n4[5],type:'main',index:0}]]}, [n4[5]]:{main:[[{node:'Envia matéria para PWA',type:'main',index:0}]]} }; out('04-processamento-editorial-pwa-completo.json',j4);

const n5=['Webhook decisão do PWA','Validar decisão e imagem','Fechar ciclo e arquivar'];
const w=clone('Webhook Aprovação — Notícias'); w.name=n5[0]; w.parameters.path='pwa-publicacao-dfja'; const v=clone('Atualiza Sheet Publicada — Notícias'); v.name=n5[1]; const f=clone('Publica WordPress — Notícias'); f.name=n5[2]; const j5={name:'DFJÁ 05 — Publicação WordPress e Arquivo',nodes:[w,v,f,clone('Audita wordpress'),clone('Grava Log — wordpress')],connections:{[n5[0]]:{main:[[{node:n5[1],type:'main',index:0}]]},[n5[1]]:{main:[[{node:n5[2],type:'main',index:0}]]},[n5[2]]:{main:[[{node:'Audita wordpress',type:'main',index:0}]]},['Audita wordpress']:{main:[[{node:'Grava Log — wordpress',type:'main',index:0}]]}},active:false,settings:{executionOrder:'v1'},meta:{templateCredsSetupCompleted:true}}; out('05-publicacao-wordpress-completo.json',j5);
