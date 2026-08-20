<?php
/**
 * Plugin Name: SignalDesk Connector
 * Description: Securely publishes SignalDesk drafts as editable WordPress posts.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 */
if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route('signaldesk/v1', '/status', [
        'methods' => 'GET',
        'callback' => fn() => new WP_REST_Response(['connected' => true, 'site' => get_bloginfo('name'), 'version' => '0.1.0']),
        'permission_callback' => 'signaldesk_authorize'
    ]);
    register_rest_route('signaldesk/v1', '/drafts', [
        'methods' => 'POST',
        'callback' => 'signaldesk_create_draft',
        'permission_callback' => 'signaldesk_authorize'
    ]);
});

function signaldesk_authorize(WP_REST_Request $request) {
    $secret = get_option('signaldesk_shared_secret', '');
    $provided = $request->get_header('x-signaldesk-secret');
    return $secret && $provided && hash_equals($secret, $provided);
}

function signaldesk_create_draft(WP_REST_Request $request) {
    $title = sanitize_text_field($request->get_param('title'));
    $content = wp_kses_post($request->get_param('content'));
    if (!$title || !$content) return new WP_Error('invalid_draft', 'A title and content are required.', ['status' => 400]);
    $post_id = wp_insert_post(['post_title' => $title, 'post_content' => $content, 'post_status' => 'draft', 'post_type' => 'post'], true);
    if (is_wp_error($post_id)) return $post_id;
    return new WP_REST_Response(['id' => $post_id, 'edit_url' => get_edit_post_link($post_id, 'raw')], 201);
}

add_action('admin_menu', function () {
    add_options_page('SignalDesk', 'SignalDesk', 'manage_options', 'signaldesk', 'signaldesk_settings_page');
});
function signaldesk_settings_page() {
    if (!current_user_can('manage_options')) return;
    if (isset($_POST['signaldesk_secret']) && check_admin_referer('signaldesk_save')) update_option('signaldesk_shared_secret', sanitize_text_field(wp_unslash($_POST['signaldesk_secret'])));
    $secret = esc_attr(get_option('signaldesk_shared_secret', ''));
    echo '<div class="wrap"><h1>SignalDesk connector</h1><p>Paste the shared secret from your SignalDesk site connection.</p><form method="post">';
    wp_nonce_field('signaldesk_save');
    echo '<input type="password" class="regular-text" name="signaldesk_secret" value="'.$secret.'" autocomplete="off" /><p><button class="button button-primary">Save connection</button></p></form></div>';
}
