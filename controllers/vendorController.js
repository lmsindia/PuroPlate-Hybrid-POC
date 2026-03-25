// controllers/vendorController.js

const db = require("../config/db");

async function getAuthenticatedUser(req) {
  const result = await db.query(`
    SELECT id, email
    FROM marketplace.users
    WHERE id = $1
  `,[req.user.id]);

  return result.rows[0] || null;
}

exports.createVendor = async (req, res) => {

  const log = req.log || console;
  const { name } = req.body || {};
  const normalizedName = typeof name === "string" ? name.trim() : "";

  log.info("vendor.create.started", {
    userId: req.user?.id,
    body: req.body || {}
  });

  if (!normalizedName) {
    log.warn("vendor.create.validation_failed", {
      userId: req.user?.id,
      reason: "Vendor name is required"
    });

    return res.status(400).json({
      error: "Vendor name is required"
    });
  }

  const user = await getAuthenticatedUser(req);

  if (!user) {
    log.warn("vendor.create.user_not_found", {
      userId: req.user?.id
    });

    return res.status(404).json({
      error: "User not found"
    });
  }

  log.info("vendor.create.inserting", {
    userId: user.id,
    email: user.email,
    name: normalizedName
  });

  try {
    const vendor = await db.query(`
      INSERT INTO marketplace.vendors
      (name,email,status)
      VALUES ($1,$2,'pending')
      RETURNING id
    `,[normalizedName, user.email]);

    log.info("vendor.create.completed", {
      userId: user.id,
      email: user.email,
      vendorId: vendor.rows[0].id
    });

    res.json({ vendorId: vendor.rows[0].id });
  } catch (err) {
    if (err.code === "23505") {
      log.warn("vendor.create.duplicate", {
        userId: user.id,
        email: user.email,
        detail: err.detail
      });

      return res.status(409).json({
        error: "Vendor already exists for this account"
      });
    }

    throw err;
  }

};


exports.getProfile = async (req, res) => {

  const user = await getAuthenticatedUser(req);

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  const result = await db.query(`
    SELECT * FROM marketplace.vendors
    WHERE email = $1
  `,[user.email]);

  if (!result.rows.length) {
    return res.status(404).json({
      error: "Vendor not found"
    });
  }

  res.json(result.rows[0]);

};
