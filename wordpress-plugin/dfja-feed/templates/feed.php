<div class="dfja-stage"><div class="dfja-phone"><div id="dfja-feed" class="dfja-feed" aria-label="Feed de notícias DFJÁ">
    <header class="dfja-topbar"><a class="dfja-home-link" href="<?php echo esc_url(home_url('/')); ?>" aria-label="DFJÁ — página inicial"><strong><span>DF</span>JÁ</strong></a><small>A NOTÍCIA NA PALMA DA MÃO</small></header>
    <nav class="dfja-categories" aria-label="Categorias">
        <button class="dfja-category is-active" data-category="0" type="button">Últimas</button>
        <?php foreach ((array) $categories as $category_id => $category_name): ?>
            <button class="dfja-category" data-category="<?php echo esc_attr($category_id); ?>" type="button">
                <?php echo esc_html($category_name); ?>
            </button>
        <?php endforeach; ?>
    </nav>
    <div id="dfja-feed-list" class="dfja-feed-list">
        <div id="dfja-refresh-indicator" class="dfja-refresh-indicator" aria-live="polite">Puxe para atualizar</div>
        <div class="dfja-loader" aria-live="polite">Carregando notícias…</div>
        <div id="dfja-feed-sentinel" aria-hidden="true"></div>
    </div>
    <div id="dfja-modal" class="dfja-modal" aria-hidden="true">
        <button class="dfja-modal-close" type="button" aria-label="Fechar">×</button>
        <article id="dfja-modal-content"></article>
    </div>
</div></div></div>
