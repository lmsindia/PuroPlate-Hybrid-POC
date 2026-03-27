const router = require("express").Router();
const controller = require("../controllers/shopifyWebhook.controller");

router.post("/", controller.handleWebhook);
router.post("/:event", controller.handleWebhook);

module.exports = router;
