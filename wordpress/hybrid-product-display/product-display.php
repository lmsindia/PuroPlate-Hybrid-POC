<?php
/*
Plugin Name: Hybrid Product Display
*/

if (!session_id()) {
    session_start();
}


/* ---------------------------------------
   SHORTCODE TO DISPLAY PRODUCTS
--------------------------------------- */
add_shortcode("hybrid_products_1", "hybrid_products_shortcode");

function hybrid_products_shortcode() {

    $response = wp_remote_get("http://localhost:5000/api/products");

    if (is_wp_error($response)) {
        return "API error";
    }

    $products = json_decode(
        wp_remote_retrieve_body($response)
    );

    $html = "<h3>Products</h3>";

    foreach ($products as $product) {

        $html .= "<div style='border:1px solid #ccc;padding:10px;margin-bottom:10px'>";
        $html .= "<strong>".esc_html($product->name)."</strong><br>";

        // ---------------------------
        // VARIANT SELECTOR
        // ---------------------------
        $html .= '<form method="post">';

        $html .= '<select name="variant">';

        foreach ($product->variants as $variant) {

            $html .= '<option value="'.esc_attr($variant->shopify_variant_id).'">';
            $html .= esc_html($variant->title)." - ?".esc_html($variant->price);

            if ($variant->stock <= 0) {
                $html .= " (Out of stock)";
            }

            $html .= '</option>';
        }

        $html .= '</select>';

        $html .= '
            <button type="submit" name="add_to_cart">
                Add to Cart
            </button>
        </form>';

        // ---------------------------
        // SHOW ATTRIBUTES (optional)
        // ---------------------------
        if (!empty($product->attributes)) {

            $html .= "<p><strong>Attributes:</strong><br>";

            foreach ($product->attributes as $attr) {
                $html .= esc_html($attr->category)
                       . ": "
                       . esc_html($attr->value)
                       . "<br>";
            }

            $html .= "</p>";
        }

        $html .= "</div>";
    }


    /* ---------------------------------------
       CART DISPLAY
    --------------------------------------- */
    $html .= "<h3>Your Cart</h3>";

    if (empty($_SESSION['cart'])) {
        $html .= "Cart is empty";
    } else {

        $html .= "<ul>";
        foreach ($_SESSION['cart'] as $variant => $qty) {
            $html .= "<li>Variant ".$variant." × ".$qty."</li>";
        }
        $html .= "</ul>";

        $html .= '
        <form method="post">
            <button type="submit" name="checkout">
                Checkout
            </button>
        </form>';
    }

    return $html;
}


/* ---------------------------------------
   ADD TO CART HANDLER
--------------------------------------- */
add_action('init', function() {

    if (!isset($_POST['add_to_cart'])) return;

    $variant = sanitize_text_field($_POST['variant']);

    if (!isset($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
    }

    if (isset($_SESSION['cart'][$variant])) {
        $_SESSION['cart'][$variant]++;
    } else {
        $_SESSION['cart'][$variant] = 1;
    }
});


/* ---------------------------------------
   CHECKOUT HANDLER
--------------------------------------- */
add_action('template_redirect', function(){

    if (!isset($_POST['checkout'])) return;

    if (empty($_SESSION['cart'])) {
        wp_die("Cart is empty");
    }

    $items = [];

    foreach ($_SESSION['cart'] as $variant => $qty) {
        $items[] = [
            "variantId" => $variant,
            "quantity" => $qty
        ];
    }

    $response = wp_remote_post(
        "http://localhost:5000/api/checkout",
        [
            "body" => json_encode(["items"=>$items]),
            "headers" => ["Content-Type"=>"application/json"]
        ]
    );

    if (is_wp_error($response)) {
        wp_die("Checkout API error");
    }

    $data = json_decode(wp_remote_retrieve_body($response));

    $_SESSION['cart'] = [];

    wp_redirect($data->checkoutUrl);
    exit;
});
