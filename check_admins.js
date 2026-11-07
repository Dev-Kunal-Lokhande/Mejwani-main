const { pool } = require('./backend/src/config/db');

async function check() {
  try {
    const hotels = await pool.query('SELECT id, name, slug FROM hotels');
    console.log('--- HOTELS ---');
    console.table(hotels.rows);

    const admins = await pool.query('SELECT id, username, role, email, hotel_id FROM admins');
    console.log('--- ADMINS ---');
    console.table(admins.rows);

    const staff = await pool.query('SELECT id, "fullName", role, email, password IS NOT NULL as has_password, hotel_id FROM staff');
    console.log('--- STAFF ---');
    console.table(staff.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
