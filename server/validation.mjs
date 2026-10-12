export const MAX = Object.freeze({ name: 80, title: 110, email: 254, description: 280, body: 2500 });

export function cleanText(value, max = 250) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max + 1);
}

export function validEmail(value) {
  return typeof value === 'string' && value.length <= MAX.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateRegistration(input = {}) {
  const name = cleanText(input.name, MAX.name);
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = input.password;
  if (name.length < 2 || name.length > MAX.name) return 'Name must be between 2 and 80 characters.';
  if (!validEmail(email)) return 'Enter a valid email address.';
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return 'Password must contain between 10 and 128 characters.';
  return null;
}

export function validateMessage(input = {}) {
  const name = cleanText(input.name, MAX.name);
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (name.length < 2 || name.length > MAX.name) return 'Enter your name (2–80 characters).';
  if (!validEmail(email)) return 'Enter a valid email address.';
  if (message.length < 10 || message.length > MAX.body) return 'Message must be between 10 and 2500 characters.';
  return null;
}

export const IMAGE_KEYS = Object.freeze(['stone', 'water', 'light', 'paper', 'shape', 'memory']);

export function validateExhibition(input = {}) {
  if (!input || typeof input !== 'object') return 'Invalid exhibition.';
  const title = cleanText(input.title, MAX.title);
  const category = cleanText(input.category, 45);
  const description = cleanText(input.description, MAX.description);
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (title.length < 3 || title.length > MAX.title) return 'Title must be 3–110 characters.';
  if (category.length < 2 || category.length > 45) return 'Category must be 2–45 characters.';
  if (description.length < 12 || description.length > MAX.description) return 'Description must be 12–280 characters.';
  if (body.length < 30 || body.length > 4000) return 'Story must be 30–4000 characters.';
  if (!IMAGE_KEYS.includes(input.imageKey)) return 'Choose a valid collection image.';
  if (typeof input.published !== 'boolean' || typeof input.featured !== 'boolean') return 'Invalid publication setting.';
  return null;
}

export function validateEvent(input = {}) {
  const title = cleanText(input?.title, MAX.title);
  const description = cleanText(input?.description, MAX.description);
  if (title.length < 3 || title.length > MAX.title) return 'Title must be 3–110 characters.';
  if (description.length < 12 || description.length > MAX.description) return 'Description must be 12–280 characters.';
  if (typeof input?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date + 'T12:00:00Z')) || new Date(input.date + 'T12:00:00Z').toISOString().slice(0,10) !== input.date) return 'Enter a valid event date (YYYY-MM-DD).';
  if (typeof input?.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return 'Enter an event time (HH:MM).';
  if (typeof input?.published !== 'boolean') return 'Invalid publication setting.';
  return null;
}

export function slugify(text) {
  return cleanText(text, 120).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
}
