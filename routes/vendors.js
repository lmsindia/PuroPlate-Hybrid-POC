const express = require("express");
const router = express.Router();
const db = require("../config/db");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/vendors", async (req, res, next) => {
  let client;

  try {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const phone = req.body?.phone?.trim();
    const commission = Number(req.body?.commission);

    if (!name || !email || !phone || req.body?.commission === undefined) {
      return res.status(400).json({
        error: "name, email, phone, and commission are required"
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email address"
      });
    }

    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      return res.status(400).json({
        error: "Commission must be a number between 0 and 100"
      });
    }

    client = await db.connect();
    await client.query("BEGIN");

    const duplicateVendor = await client.query(`
      SELECT id, email, phone
      FROM marketplace.vendors
      WHERE LOWER(email) = $1 OR phone = $2
      LIMIT 1
    `, [email, phone]);

    if (duplicateVendor.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Vendor with the same email or phone already exists"
      });
    }

    const vendor = await client.query(`
      INSERT INTO marketplace.vendors
      (name,email,phone)
      VALUES($1,$2,$3)
      RETURNING id
    `, [name, email, phone]);

    const vendorId = vendor.rows[0].id;

    const existingWallet = await client.query(`
      SELECT vendor_id
      FROM marketplace.vendor_wallets
      WHERE vendor_id = $1
      LIMIT 1
    `, [vendorId]);

    if (existingWallet.rows.length) {
      throw new Error(`Vendor wallet already exists for vendor ${vendorId}`);
    }

    await client.query(`
      INSERT INTO marketplace.vendor_commissions
      (vendor_id,commission_value)
      VALUES($1,$2)
    `, [vendorId, commission]);

    await client.query(`
      INSERT INTO marketplace.vendor_wallets
      (vendor_id)
      VALUES($1)
    `, [vendorId]);

    await client.query("COMMIT");

    res.json({
      success: true,
      vendorId
    });

  }
  catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        next(rollbackErr);
        return;
      }
    }

    next(err);
  }
  finally {
    if (client) {
      client.release();
    }
  }

});

module.exports = router;
