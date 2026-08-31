<?php

if (!defined('ABSPATH')) exit;

add_shortcode('dfja_feed', function ($atts = []) {
    $atts = shortcode_atts(['posts_per_page' => 5], $atts, 'dfja_feed');
    $all = get_categories(['hide_empty' => false]);
    $categories = [];
    $wanted = array_flip(dfja_feed_categories());
    foreach ($all as $cat) {
        // Exibe todas as categorias editoriais existentes no WordPress, mantendo
        // a ordem definida pelo plugin e incluindo categorias novas sem deploy.
        if (isset($wanted[$cat->name])) $categories[$cat->term_id] = $cat->name;
    }
    uksort($categories, static function ($a, $b) use ($categories, $wanted) {
        return ($wanted[$categories[$a]] ?? PHP_INT_MAX) <=> ($wanted[$categories[$b]] ?? PHP_INT_MAX);
    });

    wp_enqueue_style('dfja-feed', DFJA_FEED_URL . 'assets/style.css', [], DFJA_FEED_VERSION);
    wp_enqueue_script('dfja-feed', DFJA_FEED_URL . 'assets/script.js', [], DFJA_FEED_VERSION, true);

    wp_localize_script('dfja-feed', 'dfjaConfig', [
        'apiUrl' => esc_url_raw(rest_url('wp/v2/posts')),
        'ajaxUrl' => esc_url_raw(admin_url('admin-ajax.php')),
        'ajaxNonce' => wp_create_nonce('dfja_ajax'),
        'nonce' => wp_create_nonce('wp_rest'),
        'siteName' => get_bloginfo('name'),
        'categories' => $categories,
        'postsPerPage' => max(1, min(20, absint($atts['posts_per_page']))),
        'homeUrl' => esc_url_raw(home_url('/')),
        // Produção: o feed deve refletir apenas posts reais do WordPress.
        'demoMode' => false,
    ]);

    ob_start();
    include DFJA_FEED_DIR . 'templates/feed.php';
    return ob_get_clean();
});

// O WhatsApp e outras redes usam estes metadados para montar a prévia da
// matéria compartilhada a partir de ?post=ID.
add_action('wp_head', function () {
    $post_id = is_singular('post') ? get_queried_object_id() : (isset($_GET['post']) ? absint($_GET['post']) : 0);
    if (!$post_id) return;
    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'post') return;

    $title = wp_strip_all_tags(get_the_title($post_id));
    $description = wp_trim_words(wp_strip_all_tags(get_the_excerpt($post_id)), 35, '…');
    $url = get_permalink($post_id);
    $image = get_post_meta($post_id, 'dfja_cover_image_url', true) ?: get_the_post_thumbnail_url($post_id, 'large') ?: get_post_meta($post_id, 'dfja_image_url', true);
    if (!$image) return;

    printf("\n<!-- DFJÁ social preview -->\n<meta property=\"og:type\" content=\"article\">\n<meta property=\"og:site_name\" content=\"DFJÁ\">\n<meta property=\"og:title\" content=\"%s\">\n<meta property=\"og:description\" content=\"%s\">\n<meta property=\"og:url\" content=\"%s\">\n<meta property=\"og:image\" content=\"%s\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n<meta name=\"twitter:title\" content=\"%s\">\n<meta name=\"twitter:description\" content=\"%s\">\n<meta name=\"twitter:image\" content=\"%s\">\n", esc_attr($title), esc_attr($description), esc_url($url), esc_url($image), esc_attr($title), esc_attr($description), esc_url($image));
}, 5);
