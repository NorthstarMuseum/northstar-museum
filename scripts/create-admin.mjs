import { openDatabase } from '../server/db.mjs';
import { hashPassword } from '../server/auth.mjs';
import { validateRegistration } from '../server/validation.mjs';

const email = process.env.NORTHSTAR_ADMIN_EMAIL;
const password = process.env.NORTHSTAR_ADMIN_PASSWORD;
const name = process.env.NORTHSTAR_ADMIN_NAME || 'Museum Administrator';
const error = validateRegistration({ name,email,password });
if (error) {
  console.error('Set NORTHSTAR_ADMIN_EMAIL, NORTHSTAR_ADMIN_PASSWORD (10+ chars) and optionally NORTHSTAR_ADMIN_NAME before running this command.');
  process.exitCode = 1;
} else {
  const db = openDatabase();
  const found = db.prepare('SELECT id FROM users WHERE email=?').get(email.trim().toLowerCase());
  if (found) db.prepare('UPDATE users SET name=?,password_hash=?,role=? WHERE id=?').run(name,hashPassword(password),'admin',found.id);
  else db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(name,email.trim().toLowerCase(),hashPassword(password),'admin');
  db.close();
  console.log('Administrator account configured for:',email.trim().toLowerCase());
}
