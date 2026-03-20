<?php
/*
Plugin Name: Hybrid Products
*/

function hybrid_products_shortcode() {

    $response = wp_remote_get("http://localhost:5000/api/products");

    if(is_wp_error($response)) return "API error";

    $products = json_decode(
        wp_remote_retrieve_body($response)
    );

    $html = "<ul>";

    foreach($products as $p) {

        $html .= "<li>";
        $html .= $p->name." - ".$p->price;
        $html .= "<form method='post'>
                  <input type='hidden' name='variant'
                  value='".$p->shopify_variant_id."'>
                  <button type='submit'>Buy</button>
                  </form>";
        $html .= "</li>";
    }

    $html .= "</ul>";

    return $html;
}

add_shortcode("hybrid_products","hybrid_products_shortcode");

