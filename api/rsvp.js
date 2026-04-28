import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { name, phone, email, guests, events, side, diet, message } =
      req.body;

    if (!name || !phone || !email || !guests || !events || !side) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const query = `
      INSERT INTO rsvps 
      (full_name, phone, email, guests, events, side, diet, message)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const values = [
      name,
      phone,
      email,
      guests,
      events,
      side,
      diet || "",
      message || "",
    ];

    const result = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
}
