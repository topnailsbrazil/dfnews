<?php

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    $url_fields = ['dfja_video_url', 'dfja_instagram_url', 'dfja_source_url', 'dfja_image_url', 'dfja_cover_image_url'];
    foreach ($url_fields as $field) register_post_meta('post', $field, ['type' => 'string', 'single' => true, 'show_in_rest' => true, 'sanitize_callback' => 'esc_url_raw', 'auth_callback' => function () { return current_user_can('edit_posts'); }]);
    foreach (['dfja_source_name', 'dfja_ai_status', 'dfja_editor_status', 'dfja_n8n_item_id'] as $field) register_post_meta('post', $field, ['type' => 'string', 'single' => true, 'show_in_rest' => true, 'sanitize_callback' => 'sanitize_text_field', 'auth_callback' => function () { return current_user_can('edit_posts'); }]);
    foreach (['dfja_like_count', 'dfja_view_count'] as $field) register_post_meta('post', $field, ['type' => 'integer', 'single' => true, 'show_in_rest' => true, 'sanitize_callback' => 'absint', 'auth_callback' => function () { return false; }]);
});

add_action('add_meta_boxes', function () {
    add_meta_box('dfja_editorial_data', 'DFJÁ • Dados editoriais', 'dfja_render_editorial_box', 'post', 'side', 'high');
});

function dfja_render_editorial_box($post) {
    wp_nonce_field('dfja_editorial_save', 'dfja_editorial_nonce');
    $fields = [
        'dfja_source_name' => 'Fonte',
        'dfja_source_url' => 'Link da fonte',
        'dfja_image_url' => 'URL da imagem',
        'dfja_cover_image_url' => 'URL da capa destacada',
        'dfja_video_url' => 'URL do vídeo',
        'dfja_instagram_url' => 'URL do Instagram',
        'dfja_ai_status' => 'Status da IA',
        'dfja_editor_status' => 'Status editorial',
        'dfja_n8n_item_id' => 'ID do item no n8n',
    ];
    foreach ($fields as $key => $label) {
        $value = get_post_meta($post->ID, $key, true);
        printf('<p><label for="%1$s"><strong>%2$s</strong></label><input class="widefat" id="%1$s" name="%1$s" value="%3$s"></p>', esc_attr($key), esc_html($label), esc_attr($value));
    }
}

add_action('save_post_post', function ($post_id) {
    if (!isset($_POST['dfja_editorial_nonce']) || !wp_verify_nonce($_POST['dfja_editorial_nonce'], 'dfja_editorial_save')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (!current_user_can('edit_post', $post_id)) return;
    $fields = ['dfja_source_name', 'dfja_source_url', 'dfja_image_url', 'dfja_cover_image_url', 'dfja_video_url', 'dfja_instagram_url', 'dfja_ai_status', 'dfja_editor_status', 'dfja_n8n_item_id'];
    foreach ($fields as $key) {
        if (!isset($_POST[$key])) continue;
        $value = in_array($key, ['dfja_source_url', 'dfja_image_url', 'dfja_cover_image_url', 'dfja_video_url', 'dfja_instagram_url'], true) ? esc_url_raw($_POST[$key]) : sanitize_text_field($_POST[$key]);
        update_post_meta($post_id, $key, $value);
    }
}, 10, 1);
