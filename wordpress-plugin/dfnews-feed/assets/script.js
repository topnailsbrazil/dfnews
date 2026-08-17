(function () {
  'use strict';

  const config = window.dfnewsConfig || {};
  const list = document.getElementById('dfnews-feed-list');
  const modal = document.getElementById('dfnews-modal');
  const modalContent = document.getElementById('dfnews-modal-content');
  let page = 1;
  let loading = false;
  let hasMore = true;
  let category = 0;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function createCard(post) {
    const image = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
    const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 180) || '';
    const card = document.createElement('article');
    card.className = 'dfnews-card';
    card.innerHTML = `${image ? `<img class="dfnews-card-image" src="${escapeHtml(image)}" alt="">` : ''}<div class="dfnews-card-shade"></div><div class="dfnews-card-content"><span class="dfnews-card-meta">DFNews</span><h2>${escapeHtml(post.title?.rendered)}</h2><p>${escapeHtml(excerpt)}</p><button class="dfnews-read" type="button">Ler notícia</button></div>`;
    card.querySelector('.dfnews-read').addEventListener('click', () => openPost(post));
    return card;
  }

  function openPost(post) {
    modalContent.innerHTML = `<h1>${escapeHtml(post.title?.rendered)}</h1><div class="dfnews-modal-body">${post.content?.rendered || ''}</div>`;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    history.pushState({ dfnewsPost: post.id }, '', `?post=${post.id}`);
    fetch(`${config.ajaxUrl}?action=dfnews_get_comments&post_id=${post.id}`);
  }

  function loadPosts() {
    if (loading || !hasMore) return;
    loading = true;
    let url = `${config.apiUrl}?_embed&per_page=5&page=${page}`;
    if (category) url += `&categories=${category}`;
    fetch(url, { headers: { 'X-WP-Nonce': config.nonce } })
      .then((response) => { if (!response.ok) throw new Error('Fim do feed'); return response.json(); })
      .then((posts) => { if (!posts.length) hasMore = false; posts.forEach((post) => list.appendChild(createCard(post))); page += 1; })
      .catch(() => { hasMore = false; })
      .finally(() => { loading = false; });
  }

  document.querySelectorAll('.dfnews-category').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.dfnews-category').forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active'); category = Number(button.dataset.category || 0); page = 1; hasMore = true; list.innerHTML = ''; loadPosts();
  }));
  document.querySelector('.dfnews-modal-close').addEventListener('click', () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); history.back(); });
  list.addEventListener('scroll', () => { if (list.scrollTop + list.clientHeight >= list.scrollHeight - 500) loadPosts(); });
  loadPosts();
})();
