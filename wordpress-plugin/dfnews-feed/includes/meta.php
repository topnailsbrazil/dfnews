<?php

if (!defined('ABSPATH')) exit;

add_action('init', function () {
    register_post_meta('post', 'dfnews_video_url', [
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'esc_url_raw',
        'auth_callback' => function () { return current_user_can('edit_posts'); },
    ]);
});
