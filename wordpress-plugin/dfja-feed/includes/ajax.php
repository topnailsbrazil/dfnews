<?php

if (!defined('ABSPATH')) exit;

function dfja_ajax_post_id() {
    return absint($_POST['post_id'] ?? $_GET['post_id'] ?? 0);
}

add_action('wp_ajax_dfja_track_interaction', 'dfja_track_interaction');
add_action('wp_ajax_nopriv_dfja_track_interaction', 'dfja_track_interaction');
function dfja_track_interaction() {
    $post_id = dfja_ajax_post_id();
    $type = sanitize_key($_POST['type'] ?? '');
    if (!$post_id || !$type) wp_send_json_error(['message' => 'Dados inválidos'], 400);
    wp_send_json_success(['post_id' => $post_id, 'type' => $type]);
}

add_action('wp_ajax_dfja_get_comments', 'dfja_get_comments');
add_action('wp_ajax_nopriv_dfja_get_comments', 'dfja_get_comments');
function dfja_get_comments() {
    $post_id = dfja_ajax_post_id();
    if (!$post_id) wp_send_json_error(['message' => 'Post inválido'], 400);

    $comments = get_comments([
        'post_id' => $post_id,
        'status' => 'approve',
        'number' => 50,
        'type' => 'comment',
    ]);

    wp_send_json_success(['comments' => array_map(function ($comment) {
        return [
            'id' => (int) $comment->comment_ID,
            'author_name' => $comment->comment_author,
            'date' => $comment->comment_date_gmt,
            'content' => wp_kses_post($comment->comment_content),
        ];
    }, $comments)]);
}
