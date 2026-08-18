<?php

if (!defined('ABSPATH')) exit;

add_shortcode('dfja_feed', function () {
    $categories = get_categories(['hide_empty' => true, 'fields' => 'id=>name']);

    wp_enqueue_style('dfja-feed', DFJA_FEED_URL . 'assets/style.css', [], '0.1.0');
    wp_enqueue_script('dfja-feed', DFJA_FEED_URL . 'assets/script.js', [], '0.1.0', true);

    wp_localize_script('dfja-feed', 'dfjaConfig', [
        'apiUrl' => esc_url_raw(rest_url('wp/v2/posts')),
        'ajaxUrl' => esc_url_raw(admin_url('admin-ajax.php')),
        'nonce' => wp_create_nonce('wp_rest'),
        'siteName' => get_bloginfo('name'),
        'categories' => $categories,
    ]);

    ob_start();
    include DFJA_FEED_DIR . 'templates/feed.php';
    return ob_get_clean();
});
