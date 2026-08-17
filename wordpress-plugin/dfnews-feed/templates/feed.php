<div id="dfnews-feed" class="dfnews-feed" aria-label="Feed de notícias DFNews">
    <nav class="dfnews-categories" aria-label="Categorias">
        <button class="dfnews-category is-active" data-category="0" type="button">Para você</button>
        <?php foreach ((array) $categories as $category_id => $category_name): ?>
            <button class="dfnews-category" data-category="<?php echo esc_attr($category_id); ?>" type="button">
                <?php echo esc_html($category_name); ?>
            </button>
        <?php endforeach; ?>
    </nav>
    <div id="dfnews-feed-list" class="dfnews-feed-list">
        <div class="dfnews-loader" aria-live="polite">Carregando notícias…</div>
    </div>
    <div id="dfnews-modal" class="dfnews-modal" aria-hidden="true">
        <button class="dfnews-modal-close" type="button" aria-label="Fechar">×</button>
        <article id="dfnews-modal-content"></article>
    </div>
</div>
