<?php
/**
 * Plugin Name: Casa Mexico Store Locator Sync
 * Description: Caches the Casa Mexico Google Sheets locator feed and exposes it to the front end.
 * Version: 1.0.0
 * Author: Casa Mexico
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

const CMX_LOCATOR_OPTION = 'cmx_locator_sync_options';
const CMX_LOCATOR_CRON = 'cmx_locator_sync_cron';
const CMX_LOCATOR_FILENAME = 'casa-mexico-locations.json';

register_activation_hook(__FILE__, 'cmx_locator_activate');
register_deactivation_hook(__FILE__, 'cmx_locator_deactivate');

add_filter('cron_schedules', 'cmx_locator_cron_schedules');
add_action(CMX_LOCATOR_CRON, 'cmx_locator_sync');
add_action('admin_menu', 'cmx_locator_admin_menu');
add_action('admin_init', 'cmx_locator_register_settings');
add_action('admin_post_cmx_locator_sync_now', 'cmx_locator_sync_now');
add_action('wp_enqueue_scripts', 'cmx_locator_enqueue_config');

function cmx_locator_defaults()
{
    return array(
        'endpoint' => '',
        'minimum_locations' => 50,
        'last_sync_at' => '',
        'last_count' => 0,
        'last_error' => '',
    );
}

function cmx_locator_options()
{
    return wp_parse_args(get_option(CMX_LOCATOR_OPTION, array()), cmx_locator_defaults());
}

function cmx_locator_activate()
{
    if (!wp_next_scheduled(CMX_LOCATOR_CRON)) {
        wp_schedule_event(time() + 60, 'cmx_fifteen_minutes', CMX_LOCATOR_CRON);
    }
}

function cmx_locator_deactivate()
{
    wp_clear_scheduled_hook(CMX_LOCATOR_CRON);
}

function cmx_locator_cron_schedules($schedules)
{
    $schedules['cmx_fifteen_minutes'] = array(
        'interval' => 15 * MINUTE_IN_SECONDS,
        'display' => __('Every 15 minutes', 'cmx-locator'),
    );
    return $schedules;
}

function cmx_locator_sync()
{
    $options = cmx_locator_options();
    $endpoint = trim($options['endpoint']);
    if (!$endpoint) {
        return new WP_Error('missing_endpoint', 'The Apps Script endpoint is not configured.');
    }

    $response = wp_remote_get($endpoint, array(
        'timeout' => 25,
        'redirection' => 3,
        'headers' => array('Accept' => 'application/json'),
    ));
    if (is_wp_error($response)) {
        return cmx_locator_record_error($response->get_error_message());
    }

    $status = wp_remote_retrieve_response_code($response);
    if ($status !== 200) {
        return cmx_locator_record_error('Feed returned HTTP ' . $status . '.');
    }

    $payload = json_decode(wp_remote_retrieve_body($response), true);
    $validated = cmx_locator_validate_payload($payload, (int) $options['minimum_locations']);
    if (is_wp_error($validated)) {
        return cmx_locator_record_error($validated->get_error_message());
    }

    $upload = wp_upload_dir();
    if (!empty($upload['error'])) {
        return cmx_locator_record_error($upload['error']);
    }

    $path = trailingslashit($upload['basedir']) . CMX_LOCATOR_FILENAME;
    $backup = $path . '.bak';
    $temporary = $path . '.tmp';
    $json = wp_json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false || file_put_contents($temporary, $json, LOCK_EX) === false) {
        return cmx_locator_record_error('Could not write the temporary locator feed.');
    }

    if (file_exists($path) && !copy($path, $backup)) {
        @unlink($temporary);
        return cmx_locator_record_error('Could not back up the previous locator feed.');
    }
    if (!rename($temporary, $path)) {
        @unlink($temporary);
        return cmx_locator_record_error('Could not replace the cached locator feed.');
    }

    $options['last_sync_at'] = gmdate('c');
    $options['last_count'] = count($validated);
    $options['last_error'] = '';
    update_option(CMX_LOCATOR_OPTION, $options, false);
    do_action('cmx_locator_sync_complete', $payload, $path);

    return count($validated);
}

function cmx_locator_validate_payload($payload, $minimum)
{
    if (!is_array($payload) || !empty($payload['error']) || !isset($payload['locations']) || !is_array($payload['locations'])) {
        return new WP_Error('invalid_payload', 'The endpoint did not return a valid locator payload.');
    }
    if (isset($payload['count']) && (int) $payload['count'] !== count($payload['locations'])) {
        return new WP_Error('count_mismatch', 'The feed count does not match its locations array.');
    }
    if (count($payload['locations']) < max(1, $minimum)) {
        return new WP_Error('below_floor', 'The feed contained fewer than ' . max(1, $minimum) . ' locations. The existing map was preserved.');
    }

    foreach ($payload['locations'] as $index => $location) {
        if (!is_array($location) || empty($location['name']) || empty($location['address'])) {
            return new WP_Error('invalid_location', 'Location ' . ($index + 1) . ' is missing its name or address.');
        }
        $latitude = isset($location['latitude']) ? filter_var($location['latitude'], FILTER_VALIDATE_FLOAT) : false;
        $longitude = isset($location['longitude']) ? filter_var($location['longitude'], FILTER_VALIDATE_FLOAT) : false;
        if ($latitude === false || $longitude === false || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
            return new WP_Error('invalid_coordinates', 'Location ' . ($index + 1) . ' has invalid coordinates.');
        }
    }
    return $payload['locations'];
}

function cmx_locator_record_error($message)
{
    $options = cmx_locator_options();
    $options['last_error'] = sanitize_text_field($message);
    update_option(CMX_LOCATOR_OPTION, $options, false);
    error_log('Casa Mexico locator sync: ' . $message);
    return new WP_Error('cmx_locator_sync_failed', $message);
}

function cmx_locator_feed_url()
{
    $upload = wp_upload_dir();
    return trailingslashit($upload['baseurl']) . CMX_LOCATOR_FILENAME;
}

function cmx_locator_enqueue_config()
{
    $options = cmx_locator_options();
    wp_enqueue_script(
        'cmx-locator-feed',
        plugins_url('assets/locator-feed.js', __FILE__),
        array(),
        '1.0.0',
        true
    );
    wp_localize_script('cmx-locator-feed', 'CMX_LOCATOR', array(
        'url' => add_query_arg('v', rawurlencode((string) $options['last_sync_at']), cmx_locator_feed_url()),
        'updatedAt' => $options['last_sync_at'],
        'count' => (int) $options['last_count'],
    ));
}

function cmx_locator_admin_menu()
{
    add_options_page(
        'Casa Mexico Locator',
        'Casa Mexico Locator',
        'manage_options',
        'cmx-locator-sync',
        'cmx_locator_settings_page'
    );
}

function cmx_locator_register_settings()
{
    register_setting('cmx_locator_sync', CMX_LOCATOR_OPTION, array(
        'sanitize_callback' => 'cmx_locator_sanitize_options',
    ));
}

function cmx_locator_sanitize_options($input)
{
    $current = cmx_locator_options();
    $current['endpoint'] = isset($input['endpoint']) ? esc_url_raw(trim($input['endpoint'])) : '';
    $current['minimum_locations'] = isset($input['minimum_locations']) ? max(1, absint($input['minimum_locations'])) : 50;
    return $current;
}

function cmx_locator_sync_now()
{
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to sync the locator.');
    }
    check_admin_referer('cmx_locator_sync_now');
    $result = cmx_locator_sync();
    $status = is_wp_error($result) ? 'error' : 'success';
    wp_safe_redirect(add_query_arg('cmx_sync', $status, admin_url('options-general.php?page=cmx-locator-sync')));
    exit;
}

function cmx_locator_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $options = cmx_locator_options();
    ?>
    <div class="wrap">
        <h1>Casa Mexico Store Locator Sync</h1>
        <?php if (isset($_GET['cmx_sync'])) : ?>
            <div class="notice notice-<?php echo $_GET['cmx_sync'] === 'success' ? 'success' : 'error'; ?> is-dismissible"><p>
                <?php echo $_GET['cmx_sync'] === 'success' ? 'Locator sync completed.' : esc_html($options['last_error']); ?>
            </p></div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php settings_fields('cmx_locator_sync'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="cmx-endpoint">Apps Script endpoint</label></th>
                    <td><input id="cmx-endpoint" class="large-text" type="url" name="<?php echo esc_attr(CMX_LOCATOR_OPTION); ?>[endpoint]" value="<?php echo esc_attr($options['endpoint']); ?>" placeholder="https://script.google.com/macros/s/.../exec"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="cmx-minimum">Minimum location count</label></th>
                    <td><input id="cmx-minimum" type="number" min="1" name="<?php echo esc_attr(CMX_LOCATOR_OPTION); ?>[minimum_locations]" value="<?php echo esc_attr($options['minimum_locations']); ?>"><p class="description">A smaller response is rejected so a broken sheet cannot empty the map.</p></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        <h2>Status</h2>
        <p><strong>Last successful sync:</strong> <?php echo esc_html($options['last_sync_at'] ?: 'Never'); ?></p>
        <p><strong>Published locations:</strong> <?php echo esc_html((string) $options['last_count']); ?></p>
        <?php if ($options['last_error']) : ?><p><strong>Last error:</strong> <?php echo esc_html($options['last_error']); ?></p><?php endif; ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="cmx_locator_sync_now">
            <?php wp_nonce_field('cmx_locator_sync_now'); ?>
            <?php submit_button('Sync now', 'secondary', 'submit', false); ?>
        </form>
        <p><strong>Cached feed URL:</strong> <code><?php echo esc_html(cmx_locator_feed_url()); ?></code></p>
    </div>
    <?php
}
