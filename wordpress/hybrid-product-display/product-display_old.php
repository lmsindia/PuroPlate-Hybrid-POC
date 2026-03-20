<?php
/*
Plugin Name: Hybrid Product Display
*/


if (!session_id()) {
    session_start();
}

add_shortcode("hybrid_products_1", "hybrid_products_shortcode");

function hybrid_products_shortcode() {

    $response = wp_remote_get("http://localhost:5000/api/products");

    if (is_wp_error($response)) {
        return "API error";
    }

    $products = json_decode(
        wp_remote_retrieve_body($response)
    );

    $html = "<ul>";

    foreach ($products as $p) {

        $html .= "<li>";
        $html .= $p->name . " - " . $p->price;

        $html .= "
	<form method="post">
	  <input type="hidden" name="variant"
		 value="<?php echo $p->shopify_variant_id; ?>">
	  <button name="add_to_cart">Add to Cart</button>
	</form>


        $html .= "</li>";
    }

    $html .= "</ul>";

    return $html;
}

add_action('template_redirect', 'hybrid_handle_checkout_redirect');

function hybrid_handle_checkout_redirect() {

    if (!isset($_POST['variant'])) {
        return;
    }

    $variant = sanitize_text_field($_POST['variant']);

    $response = wp_remote_post(
        "http://localhost:5000/api/checkout",
        array(
            "body" => json_encode(array(
                "variantId" => $variant,
                "quantity" => 1
            )),
            "headers" => array(
                "Content-Type" => "application/json"
            )
        )
    );

    if (is_wp_error($response)) {
        wp_die("Checkout API error");
    }

    $data = json_decode(
        wp_remote_retrieve_body($response)
    );

    if (!isset($data->checkoutUrl)) {
        wp_die("Invalid checkout response");
    }

    wp_redirect($data->checkoutUrl);
    exit;
}

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

