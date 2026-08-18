<?php
/**
 * Plugin Name: DFJá Feed
 * Description: Feed vertical mobile-first para notícias do Distrito Federal e Entorno.
 * Version: 0.1.0
 * Author: DFJá
 */

if (!defined('ABSPATH')) exit;

define('DFJA_FEED_FILE', __FILE__);
define('DFJA_FEED_DIR', plugin_dir_path(__FILE__));
define('DFJA_FEED_URL', plugin_dir_url(__FILE__));

require_once DFJA_FEED_DIR . 'includes/meta.php';
require_once DFJA_FEED_DIR . 'includes/ajax.php';
require_once DFJA_FEED_DIR . 'includes/template.php';

register_activation_hook(__FILE__, function () {
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
