import { featureSchema } from './features.mjs';
import { museumSchema } from './museum.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { slugify } from './validation.mjs';

const examples = [
  { title: 'Echoes in Stone', category: 'ART & SCULPTURE', description: 'The quiet language of form, memory, and the objects we leave behind.', body: 'From the earliest carved forms to contemporary sculpture, people have shaped materials to carry their stories. This exhibition considers how texture, scale, and craftsmanship give objects lasting meaning. Explore the relationship between the hand of the maker and the imagination of the viewer.', imageKey: 'stone', featured: 1 },
  { title: 'Across the Blue', category: 'HISTORY & EXPLORATION', description: 'Tracing the routes, vessels, and exchanges that connected distant shores.', body: 'For centuries, waterways have brought people, ideas, and objects together. Maps, trade objects, and reconstructed narratives invite visitors to consider the movement of knowledge and the lives behind each voyage. The stories are presented as a fictional teaching collection.', imageKey: 'water', featured: 1 },
  { title: 'Light in Motion', category: 'NATURE & SCIENCE', description: 'An atmospheric encounter with colour, the night sky, and natural wonder.', body: 'Light transforms our understanding of space and time. Inspired by the northern sky, this exhibition connects simple scientific ideas with expressive artwork. Visitors are encouraged to look more closely at reflections, contrast, and the colours of a changing atmosphere.', imageKey: 'light', featured: 1 },
  { title: 'Pages of Time', category: 'LANGUAGE & CULTURE', description: 'Stories of writing, illustration, and the evolution of shared knowledge.', body: 'Books and written records preserve traces of communities across generations. This exhibition uses fictional examples of manuscripts, printing, and design to explore how ideas travel. See how the form of a page can be as meaningful as the words upon it.', imageKey: 'paper', featured: 0 },
  { title: 'New Forms', category: 'DESIGN & INNOVATION', description: 'A study of objects where utility meets imagination.', body: 'Design changes when everyday needs meet new materials and unexpected ideas. New Forms brings together speculative objects and visual studies that demonstrate the tension between function and expression. Visitors are invited to think about the small decisions behind familiar things.', imageKey: 'shape', featured: 0 },
  { title: 'Landmarks of Memory', category: 'PEOPLE & PLACE', description: 'How the places around us become part of the stories we tell.', body: 'Architecture and shared spaces hold personal and collective meaning. Through interpretive illustrations and short fictional accounts, this exhibition explores the ways that buildings, streets, and landmarks influence memory. Every place has more than one story.', imageKey: 'memory', featured: 0 }
];

const eventExamples = [
  ['Curator’s Corner: Reading Objects', 'A relaxed conversation about how museums interpret everyday objects.', 21, '14:00'],
  ['Saturday Studio: Shape & Colour', 'An approachable creative workshop for visitors of all ages.', 40, '11:00'],
  ['After Hours at Northstar', 'Explore highlights from the collection during an early evening visit.', 58, '18:30'],
  ['Stories Behind the Gallery', 'A guided discussion of exhibition design and storytelling.', 79, '13:00']
];

export function openDatabase(filePath = process.env.DATABASE_PATH || './data/northstar.sqlite') {
  if (filePath !== ':memory:') mkdirSync(dirname(resolve(filePath)), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'visitor' CHECK (role IN ('visitor','admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS exhibitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT NOT NULL, body TEXT NOT NULL, image_key TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, description TEXT NOT NULL, event_date TEXT NOT NULL,
      event_time TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_event_date ON events(event_date);
    CREATE TABLE IF NOT EXISTS saved_exhibitions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exhibition_id INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, exhibition_id)
    );
    CREATE TABLE IF NOT EXISTS saved_events (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS liked_exhibitions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exhibition_id INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
      liked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, exhibition_id)
    );
    CREATE INDEX IF NOT EXISTS idx_exhibition_likes ON liked_exhibitions(exhibition_id);
    CREATE TABLE IF NOT EXISTS liked_events (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      liked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_event_likes ON liked_events(event_id);
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  if (db.prepare('SELECT COUNT(*) AS count FROM exhibitions').get().count === 0) {
    const insert = db.prepare('INSERT INTO exhibitions (slug,title,category,description,body,image_key,featured,published) VALUES (?,?,?,?,?,?,?,1)');
    for (const e of examples) insert.run(slugify(e.title), e.title, e.category, e.description, e.body, e.imageKey, e.featured);
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM events').get().count === 0) {
    const insert = db.prepare('INSERT INTO events (title,description,event_date,event_time,published) VALUES (?,?,?,?,1)');
    for (const [title, description, days, time] of eventExamples) {
      const date = new Date(); date.setUTCHours(12,0,0,0); date.setUTCDate(date.getUTCDate() + days);
      insert.run(title, description, date.toISOString().slice(0,10), time);
    }
  }
  museumSchema(db);
  featureSchema(db);
  return db;
}

export const asExhibition = row => row && ({ id: row.id, slug: row.slug, title: row.title, category: row.category, description: row.description, body: row.body, imageKey: row.image_key, featured: Boolean(row.featured), published: Boolean(row.published), likeCount: Number(row.like_count ?? 0) });
export const asEvent = row => row && ({ id: row.id, title: row.title, description: row.description, date: row.event_date, time: row.event_time, published: Boolean(row.published), likeCount: Number(row.like_count ?? 0) });
