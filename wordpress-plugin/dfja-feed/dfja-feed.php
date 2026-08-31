<?php
/**
 * Plugin Name: DFJÁ Feed
 * Description: Feed vertical mobile-first para notícias do Distrito Federal e Entorno.
 * Version: 0.9.2
 * Author: DFJÁ
 */

if (!defined('ABSPATH')) exit;

define('DFJA_FEED_VERSION', '0.9.2');
define('DFJA_FEED_FILE', __FILE__);
define('DFJA_FEED_DIR', plugin_dir_path(__FILE__));
define('DFJA_FEED_URL', plugin_dir_url(__FILE__));

require_once DFJA_FEED_DIR . 'includes/meta.php';
require_once DFJA_FEED_DIR . 'includes/ajax.php';
require_once DFJA_FEED_DIR . 'includes/ingest.php';
require_once DFJA_FEED_DIR . 'includes/template.php';

function dfja_feed_categories() {
    return [
        'DF', 'Entorno', 'Brasil', 'Política', 'Eleições',
        'Câmara & Senado',
        'Câmara Legislativa do DF', 'Policial', 'Fato ou Fake',
        'Serviços', 'Emprego e Concursos',
        'Vagas', 'Tecnologia', 'Concursos', 'Esporte', 'Social', 'Cultura',
        'Mundo', 'Curiosidades', 'Economia'
    ];
}

register_activation_hook(__FILE__, function () {
    dfja_ensure_categories();
    flush_rewrite_rules();
});

function dfja_ensure_categories() {
    // Corrige o nome editorial antigo sem criar uma categoria duplicada.
    $old = get_term_by('name', 'Assembleia Legislativa do DF', 'category');
    $current = get_term_by('name', 'Câmara Legislativa do DF', 'category');
    if ($old && !$current) {
        wp_update_term($old->term_id, 'category', [
            'name' => 'Câmara Legislativa do DF',
            'slug' => sanitize_title('Câmara Legislativa do DF'),
        ]);
    }
    foreach (dfja_feed_categories() as $category) {
        if (!term_exists($category, 'category')) wp_insert_term($category, 'category');
    }
}

// Garante que categorias adicionadas ao feed também existam em instalações
// já ativadas, sem exigir desativar e ativar o plugin novamente.
add_action('init', 'dfja_ensure_categories', 5);

register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
