// controllers/authController.js

const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {

  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedPassword =
    typeof password === "string" ? password.trim() : "";

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  const hash = await bcrypt.hash(normalizedPassword, 10);

  try {
    const user = await db.query(`
      INSERT INTO marketplace.users (email,password_hash,role)
      VALUES ($1,$2,'vendor')
      RETURNING id
    `,[normalizedEmail, hash]);

    res.json({ userId: user.rows[0].id });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Email already registered"
      });
    }

    throw err;
  }

};


exports.login = async (req, res) => {

  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedPassword =
    typeof password === "string" ? password.trim() : "";

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  const user = await db.query(`
    SELECT * FROM marketplace.users WHERE email=$1
  `,[normalizedEmail]);

  if (!user.rows.length) {
    return res.status(401).json({ error: "Invalid" });
  }

  const valid = await bcrypt.compare(
    normalizedPassword,
    user.rows[0].password_hash
  );

  if (!valid) return res.status(401).json({ error: "Invalid" });

  const token = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_SECRET
  );

  res.json({ token });

};
