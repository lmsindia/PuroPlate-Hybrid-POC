<?php
/*
Plugin Name: Hybrid Product Display
Description: Displays products from NodeJS backend (PostgreSQL master).
Version: 1.0
Author: Hybrid Commerce
*/

if (!defined('ABSPATH')) exit;


/* ================================
   Fetch Products From Node API
================================= */

function hybrid_fetch_products() {

    $api_url = 'http://localhost:5000/products';

    $response = wp_remote_get($api_url, array(
        'timeout' => 20
    ));

    if (is_wp_error($response)) {
        return "<p>Unable to fetch products.</p>";
    }

    $body = wp_remote_retrieve_body($response);
    $products = json_decode($body);

    if (!$products) {
        return "<p>No products available.</p>";
    }

    return $products;
}


/* ================================
   Render Product Grid
================================= */

function hybrid_render_products() {

    $products = hybrid_fetch_products();

    if (!is_array($products)) {
        return $products;
    }

    ob_start();

    echo '<div class="hybrid-product-grid">';

    foreach ($products as $p) {

        echo '<div class="hybrid-product-card">';

        echo '<h3>' . esc_html($p->name) . '</h3>';

        if (!empty($p->description)) {
            echo '<p>' . esc_html($p->description) . '</p>';
        }

        echo '<p class="price">?' . esc_html($p->price) . '</p>';

        if (!empty($p->quantity)) {
            echo '<p class="stock">In Stock: ' . esc_html($p->quantity) . '</p>';
        }

        /* Shopify Buy Link */
        if (!empty($p->shopify_product_id)) {

            $buy_url = "https://puroplate-development.myshopify.com/products/" . $p->shopify_product_id;

            echo '<a class="buy-btn" target="_blank" href="' . esc_url($buy_url) . '">Buy Now</a>';
        }

        echo '</div>';
    }

    echo '</div>';

    return ob_get_clean();
}


/* ================================
   Shortcode
================================= */

add_shortcode('hybrid_products', 'hybrid_render_products');


/* ================================
   Basic Styling
================================= */

function hybrid_product_styles() {
?>
<style>

.hybrid-product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.hybrid-product-card {
    border: 1px solid #ddd;
    padding: 15px;
    border-radius: 8px;
    background: #fff;
}

.hybrid-product-card h3 {
    margin-top: 0;
}

.price {
    font-size: 18px;
    font-weight: bold;
}

.stock {
    color: green;
}

.buy-btn {
    display: inline-block;
    padding: 8px 14px;
    background: #000;
    color: #fff;
    text-decoration: none;
    border-radius: 4px;
}

.buy-btn:hover {
    background: #444;
}

</style>
<?php
}

add_action('wp_head', 'hybrid_product_styles');
