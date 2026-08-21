<?php
/**
 * Plugin Name: SignalDesk Connector
 * Description: Connects one WordPress site to SignalDesk for content indexing and idempotent Gutenberg publishing.
 * Version: 0.2.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 */
if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route('signaldesk/v1', '/status', ['methods'=>'GET','callback'=>'signaldesk_status','permission_callback'=>'signaldesk_authorize']);
    register_rest_route('signaldesk/v1', '/content', ['methods'=>'GET','callback'=>'signaldesk_export_content','permission_callback'=>'signaldesk_authorize']);
    register_rest_route('signaldesk/v1', '/drafts', ['methods'=>'POST','callback'=>'signaldesk_upsert_post','permission_callback'=>'signaldesk_authorize']);
});
function signaldesk_authorize(WP_REST_Request $request) {
    $saved = get_option('signaldesk_token', '');
    $provided = $request->get_header('x-signaldesk-token');
    return $saved && $provided && hash_equals($saved, $provided);
}
function signaldesk_status() {
    return ['connected'=>true,'site'=>get_bloginfo('name'),'url'=>home_url('/'),'version'=>'0.2.0'];
}
function signaldesk_export_content(WP_REST_Request $request) {
    $page = max(1, (int) $request->get_param('page'));
    $query = new WP_Query(['post_type'=>['post','page'],'post_status'=>'publish','posts_per_page'=>50,'paged'=>$page,'orderby'=>'modified','order'=>'DESC']);
    $items = array_map(function ($post) {
        return ['id'=>$post->ID,'url'=>get_permalink($post),'title'=>get_the_title($post),'content'=>apply_filters('the_content',$post->post_content),'author'=>get_the_author_meta('display_name',$post->post_author),'published'=>get_post_time('c',true,$post),'modified'=>get_post_modified_time('c',true,$post)];
    }, $query->posts);
    return ['items'=>$items,'page'=>$page,'pages'=>(int)$query->max_num_pages];
}
function signaldesk_upsert_post(WP_REST_Request $request) {
    $title = sanitize_text_field($request->get_param('title'));
    $content = wp_kses_post($request->get_param('content'));
    $status = $request->get_param('status') === 'publish' ? 'publish' : 'draft';
    $external_id = sanitize_text_field($request->get_param('external_id'));
    if (!$title || !$content || !$external_id) return new WP_Error('invalid_article','Title, content, and external_id are required.',['status'=>400]);
    $existing = get_posts(['post_type'=>'post','post_status'=>'any','meta_key'=>'_signaldesk_external_id','meta_value'=>$external_id,'numberposts'=>1,'fields'=>'ids']);
    $postarr = ['post_title'=>$title,'post_content'=>$content,'post_status'=>$status,'post_type'=>'post'];
    if ($existing) $postarr['ID'] = $existing[0];
    $post_id = wp_insert_post($postarr, true);
    if (is_wp_error($post_id)) return $post_id;
    update_post_meta($post_id, '_signaldesk_external_id', $external_id);
    return new WP_REST_Response(['id'=>$post_id,'status'=>get_post_status($post_id),'permalink'=>get_permalink($post_id),'edit_url'=>get_edit_post_link($post_id,'raw')], $existing ? 200 : 201);
}

add_action('admin_menu', function () { add_options_page('SignalDesk','SignalDesk','manage_options','signaldesk','signaldesk_settings_page'); });
function signaldesk_settings_page() {
    if (!current_user_can('manage_options')) return;
    $notice = '';
    if (isset($_POST['signaldesk_token']) && check_admin_referer('signaldesk_save')) {
        $token = sanitize_text_field(wp_unslash($_POST['signaldesk_token']));
        $endpoint = esc_url_raw(wp_unslash($_POST['signaldesk_endpoint']));
        update_option('signaldesk_token', $token, false);
        update_option('signaldesk_endpoint', $endpoint, false);
        $response = wp_remote_post($endpoint . '/pair', ['timeout'=>15,'headers'=>['X-SignalDesk-Token'=>$token,'Content-Type'=>'application/json'],'body'=>wp_json_encode(['siteUrl'=>home_url('/'),'name'=>get_bloginfo('name'),'version'=>'0.2.0'])]);
        $notice = is_wp_error($response) || wp_remote_retrieve_response_code($response) >= 300 ? 'Settings saved, but SignalDesk could not verify the connection.' : 'SignalDesk connected.';
    }
    $token = esc_attr(get_option('signaldesk_token',''));
    $endpoint = esc_url(get_option('signaldesk_endpoint',''));
    echo '<div class="wrap"><h1>SignalDesk connector</h1>';
    if ($notice) echo '<div class="notice notice-info"><p>'.esc_html($notice).'</p></div>';
    echo '<p>Generate a pairing token in your SignalDesk project, then paste both values here.</p><form method="post">';
    wp_nonce_field('signaldesk_save');
    echo '<table class="form-table"><tr><th><label for="sd-endpoint">Project endpoint</label></th><td><input id="sd-endpoint" class="regular-text" type="url" name="signaldesk_endpoint" value="'.$endpoint.'" required></td></tr><tr><th><label for="sd-token">Pairing token</label></th><td><input id="sd-token" class="regular-text" type="password" name="signaldesk_token" value="'.$token.'" autocomplete="off" required></td></tr></table>';
    submit_button('Connect site');
    echo '</form></div>';
}
