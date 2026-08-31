(function () {
  'use strict';
  const config = window.dfjaConfig || {};
  const feed = document.getElementById('dfja-feed-list');
  const sentinel = document.getElementById('dfja-feed-sentinel');
  const refreshIndicator = document.getElementById('dfja-refresh-indicator');
  const modal = document.getElementById('dfja-modal');
  const modalContent = document.getElementById('dfja-modal-content');
  if (!feed || !modal || !modalContent) return;

  const state = { page: 1, loading: false, exhausted: false, category: 0, pointer: null, moved: false, suppressClick: false, requestId: 0 };
  const loadedPostIds = new Set();
  const trackedViewIds = new Set();
  const demo = [
    ['DF', 'DFJÁ: informação local em um novo formato', 'Um feed rápido, visual e direto para acompanhar o que acontece no Distrito Federal.', 'https://images.unsplash.com/photo-1585202900225-6d3ac20a6962?auto=format&fit=crop&w=1200&q=80'],
    ['Serviços', 'Informação útil para a rotina de quem vive no DF', 'Mobilidade, serviços públicos e oportunidades reunidos em um só lugar.', 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80'],
    ['Entorno', 'Um olhar regional com identidade e voz próprias', 'Notícias de Brasília, das regiões administrativas e do Entorno.', 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80'],
    ['Fato ou Fake', 'DFJÁ explica: como conferir uma informação', 'Veja sinais de alerta e fontes oficiais antes de compartilhar conteúdos.', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80'],
    ['Tecnologia', 'Serviços digitais ganham espaço no DF', 'Aplicativos e plataformas ajudam a resolver demandas sem deslocamento.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'],
    ['Concursos', 'Concursos e seleções movimentam oportunidades', 'Acompanhe editais, inscrições e prazos confirmados.', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80'],
    ['DF', 'Brasília recebe novas ações de mobilidade urbana', 'Obras, trânsito e transporte público estão entre os assuntos acompanhados pelo DFJÁ.', 'https://images.unsplash.com/photo-1494522358652-f30e61a60313?auto=format&fit=crop&w=1200&q=80'],
    ['Entorno', 'Cidades do Entorno ampliam serviços ao cidadão', 'Veja as iniciativas que afetam a rotina de quem vive e trabalha na região.', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=80'],
    ['Policial', 'Operação reúne forças de segurança nesta manhã', 'Órgãos oficiais divulgaram orientações e informações sobre a ocorrência.', 'https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=1200&q=80'],
    ['Emprego e Concursos', 'Empresas abrem novas oportunidades no Distrito Federal', 'Confira áreas, requisitos e como acompanhar os processos seletivos.', 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=80'],
    ['Vagas', 'Semana começa com vagas para diferentes níveis de experiência', 'A seleção reúne oportunidades presenciais e remotas.', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80'],
    ['Tecnologia', 'Conectividade transforma serviços públicos', 'Novas ferramentas digitais facilitam o acesso a informações e atendimentos.', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'],
    ['Serviços', 'Veja o que funciona e o que muda no atendimento desta semana', 'Informação prática para organizar compromissos e deslocamentos.', 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80'],
    ['Cultura', 'Agenda cultural reúne opções para o fim de semana', 'Eventos, exposições e atividades gratuitas entram na programação.', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'],
    ['Esporte', 'Competições movimentam espaços esportivos do DF', 'Confira os destaques e a programação prevista para os próximos dias.', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80']
  ];
  const esc = (v) => String(v || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const icon = (kind) => kind === 'like' ? '<svg viewBox="0 0 24 24"><path d="M7 10v10H4V10h3Zm2 10V10l4-8 1 1c.7.8.8 1.9.4 2.9L13.5 9H19c1.1 0 2 .9 2 2l-1 7c-.2 1.1-1.1 2-2.2 2H9Z"/></svg>' : kind === 'share' ? '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.2"/><circle cx="17.5" cy="5.5" r="2.2"/><circle cx="17.5" cy="18.5" r="2.2"/><path d="m7.8 11 7.6-4.3M7.8 13l7.6 4.3"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M5 5h14v11H9l-4 3V5Z"/></svg>';
  const shareIcon = (kind) => {
    if (kind === 'instagram') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" class="dfja-icon-fill"/></svg>';
    if (kind === 'x') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h4.1l4.1 5.4L16.8 4H20l-6.3 7.1L20.5 20h-4.1l-4.6-6-5.1 6H3.5l6.8-7.7L4 4Zm3.2 2.1 9.9 11.8h.9L8.1 6.1h-.9Z"/></svg>';
    if (kind === 'whatsapp') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 0 0-7.3 13.1L3.5 20.5l4-1.1A8.5 8.5 0 1 0 12 3.5Z"/><path d="M9.2 8.2c.2-.3.4-.3.7-.3h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4-.1.6l-.5.6c.5 1 1.3 1.8 2.4 2.3l.7-.5c.2-.2.4-.2.6-.1l1.7.8c.2.1.3.3.3.5v.5c0 .3-.1.5-.4.7-.4.2-1 .3-1.5.2-2.5-.5-5.2-3.2-5.8-5.2-.2-.8-.2-1.7.2-2.2Z"/></svg>';
    return icon('share');
  };
  const formatDate = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
  };

  function postFromDemo(item, index) { return { id: `demo-${index}`, title: { rendered: item[1] }, excerpt: { rendered: item[2] }, content: { rendered: `<p>${item[2]}</p><p>Texto demonstrativo preparado para validar a experiência de leitura do DFJÁ.</p>` }, meta: {}, _embedded: { 'wp:term': [[{ name: item[0] }]], 'wp:featuredmedia': [{ source_url: item[3] }] } }; }
  function imageOf(post) { return post.meta?.dfja_cover_image_url || post._embedded?.['wp:featuredmedia']?.[0]?.source_url || post.meta?.dfja_image_url || ''; }
  function articleImageOf(post) { return post.meta?.dfja_image_url || post._embedded?.['wp:featuredmedia']?.[0]?.source_url || ''; }
  function closeMenus() { feed.querySelectorAll('.dfja-share-menu').forEach((node) => node.remove()); }
  function storageKey(post) { return `dfja-liked-${post.id}`; }
  const preferenceKey = 'dfja-category-preferences-v1';
  function categoryOf(post) { return post._embedded?.['wp:term']?.[0]?.[0]?.name || 'DF'; }
  function readPreferences() {
    try { return JSON.parse(localStorage.getItem(preferenceKey) || '{}'); } catch (_) { return {}; }
  }
  function recordPreference(post, type) {
    if (String(post.id).startsWith('demo-')) return;
    const category = categoryOf(post);
    const weights = { view: 1, read: 3, like: 5, share: 2, category: 2 };
    const preferences = readPreferences();
    preferences[category] = Math.min(100, Number(preferences[category] || 0) + (weights[type] || 1));
    try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch (_) {}
  }
  function personalize(posts) {
    if (state.category || posts.length < 2) return posts;
    const preferences = readPreferences();
    if (!Object.keys(preferences).length) return posts;
    return posts
      .map((post, index) => ({ post, index, score: Number(preferences[categoryOf(post)] || 0) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ post }) => post);
  }
  function visitorId() {
    const key = 'dfja-visitor-id';
    let value = localStorage.getItem(key);
    if (!value) { value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(key, value); }
    return value;
  }
  function commentsKey(post) { return `dfja-comments-${post.id}`; }
  function setCommentStatus(message, type) { const node = modalContent.querySelector('.dfja-comment-status'); if (node) { node.textContent = message; node.dataset.type = type || ''; } }
  function renderComments(comments) {
    const list = modalContent.querySelector('.dfja-comment-list');
    if (!list) return;
    list.innerHTML = comments.length ? comments.map((comment) => `<li><strong>${esc(comment.author_name)}</strong><time>${esc(comment.date || '')}</time><p>${esc(String(comment.content || '').replace(/<[^>]+>/g, ''))}</p></li>`).join('') : '<li class="is-empty">Ainda não há comentários aprovados.</li>';
  }
  function demoComments(post) {
    try { return JSON.parse(localStorage.getItem(commentsKey(post)) || '[]'); } catch (_) { return []; }
  }
  async function loadComments(post) {
    if (String(post.id).startsWith('demo-')) { renderComments(demoComments(post)); return; }
    try {
      const response = await fetch(`${config.ajaxUrl}?action=dfja_get_comments&post_id=${encodeURIComponent(post.id)}`);
      const data = await response.json();
      if (data.success) renderComments(data.data.comments || []);
    } catch (_) { setCommentStatus('Não foi possível carregar os comentários.', 'error'); }
  }
  function mediaMarkup(meta) {
    const rawVideo = String(meta.dfja_video_url || '').trim();
    const rawInstagram = String(meta.dfja_instagram_url || '').trim();
    const video = esc(rawVideo);
    const instagram = esc(rawInstagram);
    let html = '';
    if (rawVideo) {
      let embedUrl = '';
      const youtube = rawVideo.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i);
      const vimeo = rawVideo.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
      if (youtube) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(youtube[1])}`;
      else if (vimeo) embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(vimeo[1])}`;
      html += `<div class="dfja-video-embed"><strong>Vídeo da matéria</strong>${embedUrl ? `<iframe src="${esc(embedUrl)}" title="Vídeo da matéria" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` : `<video controls preload="metadata" src="${video}" playsinline></video>`}</div>`;
    }
    if (rawInstagram) html += `<div class="dfja-instagram-embed"><strong>Instagram</strong><blockquote class="instagram-media" data-instgrm-permalink="${instagram}" data-instgrm-version="14"><a href="${instagram}" target="_blank" rel="noopener">Ver publicação no Instagram</a></blockquote></div>`;
    return html;
  }
  const videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => entries.forEach((entry) => {
    const video = entry.target;
    if (entry.isIntersecting) video.play?.().catch(() => {});
    else video.pause?.();
  }), { threshold: 0.55 }) : null;

  function openReader(post, fromHistory) {
    closeMenus();
    const image = articleImageOf(post);
    const meta = post.meta || {};
    const liked = localStorage.getItem(storageKey(post)) === '1';
    const author = post._embedded?.author?.[0]?.name || post.author_name || 'Redação';
    const published = formatDate(post.date || post.date_gmt) || formatDate(new Date().toISOString());
    modalContent.innerHTML = `<button class="dfja-reader-close" type="button" aria-label="Fechar">×</button><div class="dfja-reader-content"><span class="dfja-reader-label">DFJÁ • leitura rápida</span><div class="dfja-reader-byline"><span>${esc(author)}</span><span aria-hidden="true">•</span><time datetime="${esc(post.date || post.date_gmt || '')}">${esc(published)}</time></div><h1>${esc(post.title?.rendered)}</h1>${image ? `<img class="dfja-reader-image" src="${esc(image)}" alt="">` : ''}<div class="dfja-modal-body">${post.content?.rendered || `<p>${esc(post.excerpt?.rendered)}</p>`}</div>${mediaMarkup(meta)}<section class="dfja-comments"><h3>Comentários</h3><ul class="dfja-comment-list"><li class="is-empty">Carregando comentários…</li></ul><textarea maxlength="500" placeholder="Escreva um comentário" aria-label="Comentário"></textarea><button class="dfja-comment-submit" type="button">Enviar comentário</button><p class="dfja-comment-status" aria-live="polite"></p></section></div>`;
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
    recordPreference(post, 'read');
    document.documentElement.classList.add('dfja-modal-open');
    document.body.classList.add('dfja-modal-open');
    modalContent.querySelector('.dfja-reader-close').addEventListener('click', closeReader);
    if (!fromHistory) history.pushState({ dfjaPost: post.id }, '', `${location.pathname}?post=${encodeURIComponent(post.id)}`);
    modalContent.querySelector('.dfja-comment-submit').addEventListener('click', async () => {
      const textarea = modalContent.querySelector('textarea'); const content = textarea.value.trim();
      if (!content) { setCommentStatus('Escreva um comentário antes de enviar.', 'error'); return; }
      if (String(post.id).startsWith('demo-')) { const comments = demoComments(post); comments.unshift({ author_name: 'Você', date: 'agora', content }); localStorage.setItem(commentsKey(post), JSON.stringify(comments)); renderComments(comments); setCommentStatus('Comentário salvo nesta prévia.', 'success'); textarea.value = ''; return; }
      const body = new URLSearchParams({ action: 'dfja_submit_comment', nonce: config.ajaxNonce || '', post_id: post.id, content });
      try { const response = await fetch(config.ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); const data = await response.json(); if (!data.success) throw new Error(data.data?.message || 'Falha'); textarea.value = ''; setCommentStatus(data.data.message, 'success'); } catch (error) { setCommentStatus(error.message || 'Não foi possível enviar.', 'error'); }
    });
    loadComments(post);
    if (window.instgrm?.Embeds) window.instgrm.Embeds.process();
    else if (meta.dfja_instagram_url && !document.querySelector('script[data-dfja-instagram]')) { const script = document.createElement('script'); script.async = true; script.src = 'https://www.instagram.com/embed.js'; script.dataset.dfjaInstagram = '1'; document.body.appendChild(script); }
  }
  function closeReader() {
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('dfja-modal-open');
    document.body.classList.remove('dfja-modal-open');
    if (history.state?.dfjaPost) history.replaceState(null, '', location.pathname + location.search.replace(/([?&])post=[^&]*/,'').replace(/[?&]$/,''));
  }
  function track(post, type) {
    if (String(post.id).startsWith('demo-') || !config.ajaxUrl) return;
    const body = new URLSearchParams({ action: 'dfja_track_interaction', nonce: config.ajaxNonce || '', post_id: post.id, type, visitor_id: visitorId() });
    fetch(config.ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }).catch(() => {});
  }
  async function loadInteractions(post, button) {
    if (String(post.id).startsWith('demo-') || !config.ajaxUrl) return;
    try {
      const response = await fetch(`${config.ajaxUrl}?action=dfja_get_interactions&post_id=${encodeURIComponent(post.id)}&visitor_id=${encodeURIComponent(visitorId())}`);
      const data = await response.json();
      if (!data.success || !button.isConnected) return;
      button.classList.toggle('is-liked', !!data.data.liked);
      button.querySelector('small').textContent = String(data.data.like_count || 0);
      button.dataset.likeCount = String(data.data.like_count || 0);
    } catch (_) {}
  }

  function share(anchor, post) {
    closeMenus();
    // Abre o leitor visual do DFJÁ em qualquer dispositivo, em vez do
    // template preto do post individual do WordPress.
    const feedHome = String(config.homeUrl || `${location.origin}/`).replace(/\/?$/, '/');
    const url = `${feedHome}?post=${encodeURIComponent(post.id)}`;
    const title = String(post.title?.rendered || 'DFJÁ').replace(/<[^>]+>/g, '');
    const menu = document.createElement('div'); menu.className = 'dfja-share-menu';
    menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Opções de compartilhamento');
    menu.innerHTML = `<strong>Compartilhar</strong><div class="dfja-share-actions"><button type="button" data-share="instagram" aria-label="Instagram" title="Instagram"><span class="dfja-share-icon">${shareIcon('instagram')}</span></button><button type="button" data-share="x" aria-label="X" title="X"><span class="dfja-share-icon">${shareIcon('x')}</span></button><button type="button" data-share="whatsapp" aria-label="WhatsApp" title="WhatsApp"><span class="dfja-share-icon">${shareIcon('whatsapp')}</span></button><button type="button" data-share="native" aria-label="Compartilhar" title="Compartilhar"><span class="dfja-share-icon">${shareIcon('share')}</span></button></div>`;
    anchor.closest('.dfja-card').appendChild(menu);
    menu.querySelector('[data-share="instagram"]').onclick = async () => { try { await navigator.clipboard?.writeText(url); } catch (_) {} window.open('https://www.instagram.com/', '_blank', 'noopener'); closeMenus(); };
    menu.querySelector('[data-share="x"]').onclick = () => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank', 'noopener'); closeMenus(); };
    menu.querySelector('[data-share="whatsapp"]').onclick = () => { window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank', 'noopener'); closeMenus(); };
    menu.querySelector('[data-share="native"]').onclick = async () => { if (navigator.share) { try { await navigator.share({ title, url }); closeMenus(); return; } catch (_) {} } try { await navigator.clipboard?.writeText(url); anchor.querySelector('small').textContent = 'Copiado'; } catch (_) { window.prompt('Copie o link da matéria:', url); } closeMenus(); };
  }

  function createSlide(post) {
    const fallback = demo[feed.children.length % demo.length]; const image = imageOf(post) || fallback[3]; const card = document.createElement('article'); card.className = 'dfja-card post-slide';
    const category = post._embedded?.['wp:term']?.[0]?.[0]?.name || 'DFJÁ';
    const author = post._embedded?.author?.[0]?.name || post.author_name || 'Redação';
    const published = formatDate(post.date || post.date_gmt) || formatDate(new Date().toISOString());
    const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 180) || '';
    card.innerHTML = `${image ? `<img class="slide-bg-blur dfja-card-image" src="${esc(image)}" alt="" aria-hidden="true"><div class="slide-img-container"><img class="slide-img-center" src="${esc(image)}" alt=""></div>` : ''}<div class="slide-gradient dfja-card-shade"></div><div class="dfja-card-content slide-content"><div class="dfja-story-meta"><span>${esc(category)}</span></div><div class="dfja-story-byline"><span>${esc(author)}</span><span aria-hidden="true">•</span><time datetime="${esc(post.date || post.date_gmt || '')}">${esc(published)}</time></div><h2>${esc(post.title?.rendered)}</h2><p>${esc(excerpt)}</p><div class="swipe-indicator"><span>‹</span><b>Deslize para ler</b><span>›</span></div></div><div class="dfja-social slide-actions"><div class="dfja-avatar">DF<span>JÁ</span></div><button type="button" data-action="like" aria-label="Curtir"><span>${icon('like')}</span><small>0</small></button><button type="button" data-action="share" aria-label="Compartilhar"><span>${icon('share')}</span><small>Compartilhar</small></button><button type="button" data-action="comment" aria-label="Comentar"><span>${icon('comment')}</span><small>0</small></button></div>`;
    let startX = 0; let startY = 0; let moved = false; let horizontalSwipe = false; let trackingTouch = false;
    const beginGesture = (x, y) => {
      startX = x; startY = y; moved = false; horizontalSwipe = false; trackingTouch = true;
    };
    const finishGesture = (x, y) => {
      if (!trackingTouch) return;
      const dx = Math.abs(x - startX); const dy = Math.abs(y - startY);
      moved = dx > 10 || dy > 10;
      horizontalSwipe = dx > 56 && dx > dy * 1.25;
      if (horizontalSwipe) {
        state.suppressClick = true; openReader(post);
        window.setTimeout(() => { state.suppressClick = false; }, 450);
      }
      trackingTouch = false;
    };
    card.addEventListener('touchstart', (event) => {
      if (event.target.closest('button, a, textarea, input, select, .dfja-share-menu, .dfja-social')) return;
      const touch = event.changedTouches[0];
      if (touch) beginGesture(touch.clientX, touch.clientY);
    }, { passive: true });
    card.addEventListener('touchend', (event) => {
      if (event.target.closest('button, a, textarea, input, select, .dfja-share-menu, .dfja-social')) return;
      const touch = event.changedTouches[0];
      if (touch) finishGesture(touch.clientX, touch.clientY);
    }, { passive: true });
    card.addEventListener('touchcancel', () => { trackingTouch = false; moved = true; horizontalSwipe = false; }, { passive: true });
    card.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || event.target.closest('button, a, textarea, input, select, .dfja-share-menu, .dfja-social')) return;
      beginGesture(event.clientX, event.clientY);
    }, { passive: true });
    card.addEventListener('mouseup', (event) => {
      if (event.target.closest('button, a, textarea, input, select, .dfja-share-menu, .dfja-social')) return;
      finishGesture(event.clientX, event.clientY);
    }, { passive: true });
    card.addEventListener('click', (event) => { if (state.suppressClick || horizontalSwipe || moved || event.target.closest('button, a, textarea, input, select, .dfja-share-menu, .dfja-social')) return; openReader(post); });
    card.querySelector('.dfja-read')?.addEventListener('click', () => openReader(post));
    card.querySelector('.swipe-indicator')?.addEventListener('click', (event) => { event.stopPropagation(); openReader(post); });
    const likeButton = card.querySelector('[data-action="like"]');
    if (localStorage.getItem(storageKey(post)) === '1') { likeButton.classList.add('is-liked'); likeButton.querySelector('small').textContent = '1'; }
    loadInteractions(post, likeButton);
    if (!trackedViewIds.has(post.id)) { trackedViewIds.add(post.id); recordPreference(post, 'view'); track(post, 'view'); }
    card.querySelector('.dfja-social')?.addEventListener('pointerdown', (event) => event.stopPropagation());
    card.querySelector('.dfja-social')?.addEventListener('click', (event) => event.stopPropagation());
    card.querySelectorAll('video').forEach((video) => videoObserver?.observe(video));
    card.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async (event) => { event.preventDefault(); event.stopPropagation(); const action = button.dataset.action; if (action === 'like') { const liked = !button.classList.contains('is-liked'); const previousCount = Number(button.dataset.likeCount || button.querySelector('small').textContent || 0); const nextCount = Math.max(0, previousCount + (liked ? 1 : -1)); button.classList.toggle('is-liked', liked); button.querySelector('small').textContent = String(nextCount); button.dataset.likeCount = String(nextCount); localStorage.setItem(storageKey(post), liked ? '1' : '0'); if (liked) recordPreference(post, 'like'); if (!String(post.id).startsWith('demo-') && config.ajaxUrl) { const body = new URLSearchParams({ action: 'dfja_track_interaction', nonce: config.ajaxNonce || '', post_id: post.id, type: 'like', liked: liked ? '1' : '0', visitor_id: visitorId() }); try { const response = await fetch(config.ajaxUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); const data = await response.json(); if (!data.success) throw new Error('like-failed'); button.querySelector('small').textContent = String(data.data.count || 0); button.dataset.likeCount = String(data.data.count || 0); } catch (_) { button.classList.toggle('is-liked', !liked); button.querySelector('small').textContent = String(previousCount); button.dataset.likeCount = String(previousCount); localStorage.setItem(storageKey(post), liked ? '0' : '1'); } } } if (action === 'share') { recordPreference(post, 'share'); share(button, post); } if (action === 'comment') openReader(post); }));
    return card;
  }

  async function loadNextPage() {
    if (state.loading || state.exhausted) return; state.loading = true;
    const requestId = state.requestId;
    // O feed deve abrir com todas as publicações recentes visíveis. Mantemos
    // paginação para listas maiores, mas nunca limitamos a primeira carga a
    // cinco cards, que fazia a aba Últimas parecer incompleta.
    const pageSize = Math.min(100, Math.max(20, Number(config.postsPerPage) || 20));
    let url = `${config.apiUrl}?_embed&orderby=date&order=desc&per_page=${pageSize}&page=${state.page}&dfja_refresh=${Date.now()}`; if (state.category) url += `&categories=${state.category}`;
    try {
      const response = await fetch(url, { cache: 'no-store', headers: { 'X-WP-Nonce': config.nonce, 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw new Error('feed-end');
      const posts = await response.json();
      if (requestId !== state.requestId) return;
      const activeName = document.querySelector('.dfja-category.is-active')?.textContent?.trim() || 'DF';
      const matchingDemo = demo.filter((item) => !state.category || item[0] === activeName);
      const fallback = config.demoMode && state.page <= 6 ? (matchingDemo.length ? matchingDemo : demo).map(postFromDemo) : [];
      let items = personalize(posts.length ? posts : fallback);
      if (config.demoMode && state.page === 1) {
        const demoSource = fallback.length ? fallback : demo.map(postFromDemo);
        const needed = Math.max(0, 12 - posts.length);
        const demoFill = demoSource.length ? Array.from({ length: needed }, (_, index) => demoSource[index % demoSource.length]) : [];
        items = personalize(posts.concat(demoFill));
      }
      feed.querySelector('.dfja-loader')?.remove();
      if (!items.length) state.exhausted = true;
      items.forEach((post) => {
        if (!String(post.id).startsWith('demo-') && loadedPostIds.has(post.id)) return;
        if (!String(post.id).startsWith('demo-')) loadedPostIds.add(post.id);
        feed.insertBefore(createSlide(post), sentinel || null);
      });
      state.page += 1;
    } catch (error) {
      if (state.page === 1) {
        const activeName = document.querySelector('.dfja-category.is-active')?.textContent?.trim() || 'DF';
        feed.querySelector('.dfja-loader')?.remove();
        if (config.demoMode) {
          const matchingDemo = demo.filter((item) => !state.category || item[0] === activeName);
          const fallback = matchingDemo.length ? matchingDemo : demo;
          fallback.map(postFromDemo).forEach((post) => feed.insertBefore(createSlide(post), sentinel || null));
        } else {
          const empty = document.createElement('p');
          empty.className = 'dfja-feed-empty';
          empty.textContent = state.category ? `Nenhuma matéria publicada em ${activeName}.` : 'Não foi possível carregar as matérias agora.';
          feed.insertBefore(empty, sentinel || null);
        }
        state.page += 1;
      } else state.exhausted = true;
    } finally { state.loading = false; }
  }
  function resetFeed(category) {
    state.requestId += 1;
    state.page = 1; state.category = category; state.exhausted = false; state.loading = false;
    loadedPostIds.clear();
    feed.querySelectorAll('.post-slide').forEach((card) => card.remove());
    feed.scrollTop = 0;
    loadNextPage();
  }

  document.querySelectorAll('.dfja-category').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); const category = button.textContent.trim(); if (category !== 'Últimas') { const preferences = readPreferences(); preferences[category] = Math.min(100, Number(preferences[category] || 0) + 2); try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch (_) {} } document.querySelectorAll('.dfja-category').forEach((item) => item.classList.remove('is-active')); button.classList.add('is-active'); resetFeed(Number(button.dataset.category || 0)); }));
  document.querySelector('.dfja-modal-close')?.addEventListener('click', closeReader);
  window.addEventListener('popstate', () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('dfja-modal-open'); document.body.classList.remove('dfja-modal-open'); });
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) loadNextPage(); }, { root: feed, rootMargin: '900px 0px' }).observe(sentinel);
  }
  feed.addEventListener('scroll', () => { if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 900) loadNextPage(); }, { passive: true });
  let refreshStartY = 0;
  feed.addEventListener('touchstart', (event) => { refreshStartY = event.changedTouches[0].clientY; }, { passive: true });
  feed.addEventListener('touchmove', (event) => {
    if (feed.scrollTop > 0 || !refreshIndicator) return;
    const distance = event.changedTouches[0].clientY - refreshStartY;
    if (distance > 12) { refreshIndicator.classList.add('is-visible'); refreshIndicator.textContent = distance > 72 ? 'Solte para atualizar' : 'Puxe para atualizar'; }
  }, { passive: true });
  feed.addEventListener('touchend', (event) => {
    if (feed.scrollTop > 0 || !refreshIndicator) return;
    const distance = event.changedTouches[0].clientY - refreshStartY;
    if (distance > 72 && !state.loading) {
      refreshIndicator.classList.add('is-visible', 'is-refreshing'); refreshIndicator.textContent = 'Atualizando…';
      resetFeed(state.category);
      window.setTimeout(() => { refreshIndicator.classList.remove('is-visible', 'is-refreshing'); refreshIndicator.textContent = 'Puxe para atualizar'; }, 700);
    } else { refreshIndicator.classList.remove('is-visible'); }
  }, { passive: true });
  const directPost = new URLSearchParams(location.search).get('post');
  loadNextPage();
  if (directPost && !String(directPost).startsWith('demo-')) {
    fetch(`${config.apiUrl}/${encodeURIComponent(directPost)}?_embed&dfja_refresh=${Date.now()}`, { cache: 'no-store', headers: { 'X-WP-Nonce': config.nonce, 'Cache-Control': 'no-cache' } }).then((response) => response.ok ? response.json() : null).then((post) => { if (post) openReader(post, true); }).catch(() => {});
  }
})();
