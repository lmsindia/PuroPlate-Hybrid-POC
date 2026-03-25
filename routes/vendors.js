const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/vendorController");
const auth = require("../middleware/authMiddleware");

router.post("/", auth, ctrl.createVendor);
router.get("/me", auth, ctrl.getProfile);

module.exports = router;