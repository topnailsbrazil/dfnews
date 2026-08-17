<?php
/**
 * Plugin Name: DFNews Feed
 * Description: Feed vertical mobile-first para notícias do Distrito Federal e Entorno.
 * Version: 0.1.0
 * Author: DFNews
 */

if (!defined('ABSPATH')) exit;

define('DFNEWS_FEED_FILE', __FILE__);
define('DFNEWS_FEED_DIR', plugin_dir_path(__FILE__));
define('DFNEWS_FEED_URL', plugin_dir_url(__FILE__));

require_once DFNEWS_FEED_DIR . 'includes/meta.php';
require_once DFNEWS_FEED_DIR . 'includes/ajax.php';
require_once DFNEWS_FEED_DIR . 'includes/template.php';

register_activation_hook(__FILE__, function () {
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
