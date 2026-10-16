import { handleStudentApi } from './student.mjs';
import { handleFeatureApi, logAdmin } from './features.mjs';
import { handleMuseumApi } from './museum.mjs';
import { createServer as makeHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, asExhibition, asEvent } from './db.mjs';
import { cleanText, validateRegistration, validateMessage, validateExhibition, validateEvent, slugify } from './validation.mjs';
import { createSession, readSession, revokeSession, sessionCookie, clearSessionCookie, hashPassword, verifyPassword } from './auth.mjs';

const publicDir = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.webp':'image/webp', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers });
  res.end(status === 204 ? undefined : JSON.stringify(data));
}
function sessionToken(req) {
  const cookie = req.headers.cookie || '';
  const found = cookie.match(/(?:^|;\s*)northstar_session=([a-f0-9]{64})(?:;|$)/);
  return found?.[1] || '';
}
function requireLogin(db, req) {
  const user = readSession(db, sessionToken(req));
  if (!user) throw new HttpError(401,'Please log in to continue.');
  return user;
}
function requireAdmin(db, req) {
  const user = requireLogin(db, req);
  if (user.role !== 'admin') throw new HttpError(403,'Administrator access is required.');
  return user;
}
function isSecure(req) {
  return Boolean(req.socket.encrypted || (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https'));
}
async function parseJson(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new HttpError(415,'Use Content-Type: application/json.');
  const parts = []; let total = 0;
  for await (const part of req) {
    total += part.length;
    if (total > 48000) throw new HttpError(413,'Request is too large.');
    parts.push(part);
  }
  try {
    const result = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Object expected');
    return result;
  } catch { throw new HttpError(400,'Invalid JSON request.'); }
}
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return; // CLI clients do not include Origin; browsers do.
  let originUrl;
  try { originUrl = new URL(origin); } catch { throw new HttpError(403,'Request origin is not allowed.'); }
  const expected = (process.env.PUBLIC_ORIGIN || `${isSecure(req) ? 'https' : 'http'}://${req.headers.host}`).toLowerCase();
  if (originUrl.origin.toLowerCase() !== expected) throw new HttpError(403,'Request origin is not allowed.');
}
function limiter(max, windowMs) {
  const records = new Map();
  return (req) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (records.size > 10000) for (const [key, value] of records) if (value.reset < now) records.delete(key);
    const record = records.get(ip) || { count: 0, reset: now + windowMs };
    if (record.reset < now) { record.count = 0; record.reset = now + windowMs; }
    record.count++;
    records.set(ip, record);
    if (record.count > max) throw new HttpError(429,'Too many requests. Please try again later.');
  };
}
const limitAuth = limiter(20, 15 * 60000);
const limitContact = limiter(6, 15 * 60000);
const limitAccountAction = limiter(12, 15 * 60000);
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role });

function uniqueSlug(db, title) {
  const base = slugify(title) || 'exhibition';
  let slug = base; let n = 2;
  while (db.prepare('SELECT id FROM exhibitions WHERE slug=?').get(slug)) slug = `${base}-${n++}`;
  return slug;
}

async function handleApi(req, res, url, db) {
  const path = url.pathname;
  const method = req.method;
  if (await handleStudentApi({db,req,res,url,method,parseJson,requireLogin,sendJson,HttpError})) return;
  if (await handleFeatureApi({db,req,res,url,method,parseJson,requireLogin,requireAdmin,sendJson,clearSessionCookie,isSecure,HttpError,limitAccountAction})) return;
  if (await handleMuseumApi({db,req,res,url,method,parseJson,requireLogin,requireAdmin,sendJson,HttpError,logAdmin})) return;
  if (method === 'GET' && path === '/api/health') return sendJson(res, 200, { status:'ok' });
  if (method === 'GET' && path === '/api/exhibitions') {
    const rows = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM liked_exhibitions l WHERE l.exhibition_id=e.id) AS like_count FROM exhibitions e WHERE published=1 ORDER BY featured DESC,id ASC`).all();
    return sendJson(res, 200, { exhibitions: rows.map(asExhibition) });
  }
  if (method === 'GET' && /^\/api\/exhibitions\/[a-z0-9-]+$/.test(path)) {
    const row = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM liked_exhibitions l WHERE l.exhibition_id=e.id) AS like_count FROM exhibitions e WHERE slug=? AND published=1`).get(path.split('/')[3]);
    if (!row) throw new HttpError(404,'Exhibition not found.');
    return sendJson(res, 200, { exhibition: asExhibition(row) });
  }
  if (method === 'GET' && path === '/api/events') {
    const today = new Date().toISOString().slice(0,10);
    const rows = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM liked_events l WHERE l.event_id=e.id) AS like_count FROM events e WHERE published=1 AND event_date>=? ORDER BY event_date,event_time`).all(today);
    return sendJson(res, 200, { events: rows.map(asEvent) });
  }
  if (method === 'GET' && path === '/api/auth/me') return sendJson(res, 200, { user: publicUser(requireLogin(db,req)) });
  if (path === '/api/account/saved' && method === 'GET') {
    const user = requireLogin(db,req);
    const exhibitions = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM liked_exhibitions l WHERE l.exhibition_id=e.id) AS like_count FROM saved_exhibitions AS saved
      JOIN exhibitions AS e ON e.id=saved.exhibition_id
      WHERE saved.user_id=? AND e.published=1 ORDER BY saved.saved_at DESC, e.id DESC`).all(user.id).map(asExhibition);
    const events = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM liked_events l WHERE l.event_id=e.id) AS like_count FROM saved_events AS saved
      JOIN events AS e ON e.id=saved.event_id
      WHERE saved.user_id=? AND e.published=1 ORDER BY e.event_date, e.event_time`).all(user.id).map(asEvent);
    return sendJson(res,200,{ exhibitions, events });
  }
  if (path === '/api/account/likes' && method === 'GET') {
    const user = requireLogin(db,req);
    const exhibitions = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM liked_exhibitions l WHERE l.exhibition_id=e.id) AS like_count
      FROM liked_exhibitions mine JOIN exhibitions e ON e.id=mine.exhibition_id
      WHERE mine.user_id=? AND e.published=1 ORDER BY mine.liked_at DESC, e.id DESC`).all(user.id).map(asExhibition);
    const events = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM liked_events l WHERE l.event_id=e.id) AS like_count
      FROM liked_events mine JOIN events e ON e.id=mine.event_id
      WHERE mine.user_id=? AND e.published=1 ORDER BY mine.liked_at DESC, e.id DESC`).all(user.id).map(asEvent);
    return sendJson(res,200,{exhibitions,events});
  }
  const likeRoute = path.match(/^\/api\/account\/likes\/(exhibitions|events)\/(\d+)$/);
  if (likeRoute && ['POST','DELETE'].includes(method)) {
    const user = requireLogin(db,req);
    const type = likeRoute[1];
    const isExhibition = type === 'exhibitions';
    const table = isExhibition ? 'liked_exhibitions' : 'liked_events';
    const column = isExhibition ? 'exhibition_id' : 'event_id';
    const contentTable = type;
    const id = Number(likeRoute[2]);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400,'Invalid content ID.');
    if (method === 'POST') {
      if (!db.prepare(`SELECT id FROM ${contentTable} WHERE id=? AND published=1`).get(id)) throw new HttpError(404,'Content not found.');
      const result = db.prepare(`INSERT OR IGNORE INTO ${table} (user_id,${column}) VALUES (?,?)`).run(user.id,id);
      const likeCount = db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column}=?`).get(id).total;
      return sendJson(res,result.changes ? 201 : 200,{liked:true,likeCount});
    }
    const result = db.prepare(`DELETE FROM ${table} WHERE user_id=? AND ${column}=?`).run(user.id,id);
    const likeCount = db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column}=?`).get(id).total;
    return sendJson(res,200,{liked:false,removed:Boolean(result.changes),likeCount});
  }
  if (path === '/api/account/profile' && method === 'PUT') {
    const user = requireLogin(db,req);
    const data = await parseJson(req);
    const name = cleanText(data.name,80);
    if (name.length < 2 || name.length > 80) throw new HttpError(400,'Name must be between 2 and 80 characters.');
    db.prepare('UPDATE users SET name=? WHERE id=?').run(name,user.id);
    return sendJson(res,200,{user:publicUser(db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(user.id))});
  }
  const saveRoute = path.match(/^\/api\/account\/saved\/(exhibitions|events)\/(\d+)$/);
  if (saveRoute && ['POST','DELETE'].includes(method)) {
    const user = requireLogin(db,req);
    const isExhibition = saveRoute[1] === 'exhibitions';
    const table = isExhibition ? 'saved_exhibitions' : 'saved_events';
    const column = isExhibition ? 'exhibition_id' : 'event_id';
    const contentTable = isExhibition ? 'exhibitions' : 'events';
    const id = Number(saveRoute[2]);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400,'Invalid content ID.');
    if (method === 'POST') {
      const visible = db.prepare(`SELECT id FROM ${contentTable} WHERE id=? AND published=1`).get(id);
      if (!visible) throw new HttpError(404,'Content not found.');
      const result = db.prepare(`INSERT OR IGNORE INTO ${table}(user_id,${column}) VALUES (?,?)`).run(user.id,id);
      return sendJson(res,result.changes ? 201 : 200,{ saved:true });
    }
    const result = db.prepare(`DELETE FROM ${table} WHERE user_id=? AND ${column}=?`).run(user.id,id);
    return sendJson(res,200,{ saved:false, removed:Boolean(result.changes) });
  }
  if (method === 'POST' && path === '/api/auth/register') {
    limitAuth(req);
    const data = await parseJson(req);
    const validation = validateRegistration(data);
    if (validation) throw new HttpError(400,validation);
    const email = data.email.trim().toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new HttpError(409,'An account with this email already exists.');
    const info = db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)').run(cleanText(data.name,80),email,hashPassword(data.password));
    const user = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(info.lastInsertRowid);
    return sendJson(res,201,{user:publicUser(user)}, {'Set-Cookie': sessionCookie(createSession(db,user.id),isSecure(req))});
  }
  if (method === 'POST' && path === '/api/auth/login') {
    limitAuth(req);
    const data = await parseJson(req);
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = data.password;
    if (email.length > 254 || typeof password !== 'string' || password.length > 128) throw new HttpError(401,'Invalid email or password.');
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!user || !verifyPassword(password,user.password_hash)) throw new HttpError(401,'Invalid email or password.');
    revokeSession(db,sessionToken(req));
    return sendJson(res,200,{user:publicUser(user)}, {'Set-Cookie':sessionCookie(createSession(db,user.id),isSecure(req))});
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    requireLogin(db,req);
    revokeSession(db,sessionToken(req));
    res.writeHead(204,{'Set-Cookie':clearSessionCookie(isSecure(req)),'Cache-Control':'no-store'}); res.end(); return;
  }
  if (method === 'POST' && path === '/api/messages') {
    limitContact(req);
    const data = await parseJson(req);
    const validation = validateMessage(data);
    if (validation) throw new HttpError(400,validation);
    db.prepare('INSERT INTO messages(name,email,message) VALUES(?,?,?)').run(cleanText(data.name,80),data.email.trim(),data.message.trim());
    return sendJson(res,201,{message:'Thanks for getting in touch. Your message has been received.'});
  }
  if (path.startsWith('/api/admin/')) {
    requireAdmin(db,req);
    if (method === 'GET' && path === '/api/admin/exhibitions') {
      return sendJson(res,200,{exhibitions:db.prepare('SELECT * FROM exhibitions ORDER BY id DESC').all().map(asExhibition)});
    }
    if (method === 'GET' && path === '/api/admin/events') {
      return sendJson(res,200,{events:db.prepare('SELECT * FROM events ORDER BY event_date DESC').all().map(asEvent)});
    }
    if (method === 'GET' && path === '/api/admin/messages') {
      return sendJson(res,200,{messages:db.prepare('SELECT id,name,email,message,created_at AS createdAt FROM messages ORDER BY id DESC LIMIT 200').all()});
    }
    if ((method === 'POST' || method === 'PUT') && (path === '/api/admin/exhibitions' || /^\/api\/admin\/exhibitions\/\d+$/.test(path))) {
      const data = await parseJson(req);
      const validation = validateExhibition(data);
      if (validation) throw new HttpError(400,validation);
      const fields = [cleanText(data.title,110), cleanText(data.category,45), cleanText(data.description,280), data.body.trim(), data.imageKey, Number(data.featured),Number(data.published)];
      if (method === 'POST' && path === '/api/admin/exhibitions') {
        const slug = uniqueSlug(db,data.title);
        const info = db.prepare('INSERT INTO exhibitions(title,category,description,body,image_key,featured,published,slug) VALUES(?,?,?,?,?,?,?,?)').run(...fields,slug);
        logAdmin(db,requireAdmin(db,req).id,'create_exhibition','exhibition',Number(info.lastInsertRowid));
        return sendJson(res,201,{exhibition:asExhibition(db.prepare('SELECT * FROM exhibitions WHERE id=?').get(info.lastInsertRowid))});
      }
      if (method === 'PUT') {
        const id = Number(path.split('/')[4]);
        const info = db.prepare('UPDATE exhibitions SET title=?,category=?,description=?,body=?,image_key=?,featured=?,published=? WHERE id=?').run(...fields,id);
        if (!info.changes) throw new HttpError(404,'Exhibition not found.');
        logAdmin(db,requireAdmin(db,req).id,'update_exhibition','exhibition',id);
        return sendJson(res,200,{exhibition:asExhibition(db.prepare('SELECT * FROM exhibitions WHERE id=?').get(id))});
      }
    }
    if ((method === 'POST' || method === 'PUT') && (path === '/api/admin/events' || /^\/api\/admin\/events\/\d+$/.test(path))) {
      const data = await parseJson(req);
      const validation = validateEvent(data);
      if (validation) throw new HttpError(400,validation);
      const fields = [cleanText(data.title,110),cleanText(data.description,280),data.date,data.time,Number(data.published)];
      if (method === 'POST' && path === '/api/admin/events') {
        const info = db.prepare('INSERT INTO events(title,description,event_date,event_time,published) VALUES (?,?,?,?,?)').run(...fields);
        logAdmin(db,requireAdmin(db,req).id,'create_event','event',Number(info.lastInsertRowid));
        return sendJson(res,201,{event:asEvent(db.prepare('SELECT * FROM events WHERE id=?').get(info.lastInsertRowid))});
      }
      if (method === 'PUT') {
        const id = Number(path.split('/')[4]);
        const info = db.prepare('UPDATE events SET title=?,description=?,event_date=?,event_time=?,published=? WHERE id=?').run(...fields,id);
        if (!info.changes) throw new HttpError(404,'Event not found.');
        logAdmin(db,requireAdmin(db,req).id,'update_event','event',id);
        return sendJson(res,200,{event:asEvent(db.prepare('SELECT * FROM events WHERE id=?').get(id))});
      }
    }
    if (method === 'DELETE' && /^\/api\/admin\/(exhibitions|events)\/\d+$/.test(path)) {
      const [, , , table, strId] = path.split('/');
      const id = Number(strId);
      const info = db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id); // table restricted by route regex
      if (!info.changes) throw new HttpError(404,'Record not found.');
      logAdmin(db,requireAdmin(db,req).id,'delete_'+table,table,id);
      res.writeHead(204,{'Cache-Control':'no-store'}); res.end(); return;
    }
  }
  throw new HttpError(404,'API endpoint not found.');
}

async function handleStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405,'Method not allowed.');
  const path = decodeURIComponent(url.pathname);
  const staticPath = path === '/favicon.svg' || path.startsWith('/assets/') || path === '/styles.css' || path === '/editorial.css' || path === '/app.js' || path === '/museum-ui.js' || path === '/features-ui.js' || path === '/student-ui.js' || path === '/startup.js';
  // A missing script should return 404, not the HTML shell (browsers reject its MIME type).
  if (!staticPath && /\.(?:js|css)$/.test(path)) throw new HttpError(404,'Static asset not found.');
  const relative = staticPath ? path.replace(/^\//,'') : 'index.html';
  const target = resolve(join(publicDir, relative));
  if (!target.startsWith(publicDir + sep)) throw new HttpError(403,'Forbidden.');
  if (staticPath && !Object.hasOwn(mime,extname(target))) throw new HttpError(404,'Not found.');
  let body;
  try { body = await readFile(target); }
  catch { throw new HttpError(404,'File not found.'); }
  res.writeHead(200, {'Content-Type':mime[extname(target)] || 'text/html; charset=utf-8', 'Cache-Control': staticPath && !/\.(js|css)$/.test(target) ? 'public, max-age=3600' : 'no-store'});
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function createRequestHandler({ db = openDatabase() } = {}) {
  return async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!['GET','HEAD','POST','PUT','DELETE'].includes(req.method)) throw new HttpError(405,'Method not allowed.');
      if (['POST','PUT','DELETE'].includes(req.method)) checkOrigin(req);
      if (url.pathname.startsWith('/api/')) await handleApi(req,res,url,db);
      else await handleStatic(req,res,url);
    } catch(error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error('Request failed:',error);
      sendJson(res,status,{ error:status === 500 ? 'Unexpected server error.' : error.message });
    }
  };
}

export function createServer({ db = openDatabase() } = {}) {
  return makeHttpServer(createRequestHandler({db}));
}
