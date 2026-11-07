const { pool } = require('./backend/src/config/db');
const bcrypt = require('./backend/node_modules/bcryptjs');

async function updatePasswords() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Update all admins
    await pool.query(
      "UPDATE admins SET password = $1",
      [hashedPassword]
    );
    console.log('Updated all admin passwords to admin123');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

updatePasswords();
