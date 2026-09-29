// ---------------------------------------------------------------------------
// api.js
//
// Single place that knows where the backend lives. Once the backend team
// hands you real endpoints: set VITE_API_URL (in a .env file), flip
// USE_MOCK to false, and nothing in App.jsx needs to change — every page
// calls the exported *Api objects below, never fetch() directly.
// ---------------------------------------------------------------------------

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Flip to false once real endpoints exist at API_BASE_URL. While true, every
// function below reads/writes localStorage so the app works with no backend.
const USE_MOCK = false;

const MOCK_DELAY_MS = 200;

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Mock store (localStorage-backed)
// ---------------------------------------------------------------------------

const delay = (v) => new Promise((resolve) => setTimeout(() => resolve(v), MOCK_DELAY_MS));

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}
const uid = () => Math.random().toString(36).slice(2, 10);

const KEYS = {
  user: 'healthtrack.user',
  routines: 'healthtrack.routines',
  logs: 'healthtrack.logs',
  medications: 'healthtrack.medications',
  appointments: 'healthtrack.appointments',
  checkups: 'healthtrack.checkups',
  vitals: 'healthtrack.vitals',
};

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function monthYear(d) {
  return d.toISOString().slice(0, 7);
}

function seedIfEmpty() {
  if (readStore(KEYS.routines, null)) return;

  const today = isoDate(new Date());

  writeStore(KEYS.routines, [
    { id: uid(), name: 'Take Medication', type: 'Medication', frequency: 'Daily', days: [], time: '08:00', startDate: today, active: true, reminder: true },
    { id: uid(), name: 'Morning Walk', type: 'Exercise', frequency: 'Daily', days: [], time: '07:00', startDate: today, active: true, reminder: true },
    { id: uid(), name: 'Drink Water', type: 'Hydration', frequency: 'Daily', days: [], time: '08:00', startDate: today, active: true, reminder: false },
    { id: uid(), name: 'Medication', type: 'Medication', frequency: 'Daily', days: [], time: '21:00', startDate: today, active: true, reminder: true },
    { id: uid(), name: 'Evening Meditation', type: 'Sleep', frequency: 'Daily', days: [], time: '21:00', startDate: today, active: true, reminder: false },
    { id: uid(), name: 'Vitamin D', type: 'Medication', frequency: 'Daily', days: [], time: '08:00', startDate: today, active: true, reminder: true },
  ]);

  const r = readStore(KEYS.routines, []);
  writeStore(KEYS.logs, [
    { id: uid(), routineId: r[1].id, date: today, status: 'completed', loggedAt: new Date().toISOString() },
    { id: uid(), routineId: r[3].id, date: today, status: 'missed', loggedAt: new Date().toISOString() },
  ]);

  writeStore(KEYS.medications, [
    { id: uid(), name: 'Lisinopril 10mg', category: 'Blood pressure', frequency: '2x daily', pillsLeft: 12, refillThreshold: 5 },
    { id: uid(), name: 'Vitamin D3', category: 'Supplement', frequency: '8:00 AM', pillsLeft: 4, refillThreshold: 5 },
    { id: uid(), name: 'Loratadine 10mg', category: 'Allergy', frequency: 'As needed', pillsLeft: 28, refillThreshold: 5 },
  ]);

  writeStore(KEYS.appointments, [
    { id: uid(), doctorName: 'Dr. Adeyemi', specialty: 'Cardiology', date: isoDate(addDays(1)), time: '10:00 AM', location: 'City Clinic, Lagos' },
    { id: uid(), doctorName: 'Annual Health Check', specialty: '', date: isoDate(addDays(6)), time: '9:00 AM', location: 'Grace Hospital' },
    { id: uid(), doctorName: 'Dentist Follow Up', specialty: '', date: isoDate(addDays(17)), time: '2:00 PM', location: 'Smile Dental' },
  ]);

  writeStore(KEYS.checkups, [
    { id: uid(), name: 'Annual Physical Exam', nextDue: monthYear(addDays(120)) },
    { id: uid(), name: 'Dental Cleaning', nextDue: monthYear(addDays(20)) },
    { id: uid(), name: 'Eye Exam', nextDue: monthYear(addDays(-90)) },
    { id: uid(), name: 'Skin Screening', nextDue: monthYear(addDays(330)) },
  ]);

  writeStore(KEYS.vitals, [
    { id: uid(), type: 'BP', value: '120/80', unit: 'mmHg', date: isoDate(addDays(-5)) },
    { id: uid(), type: 'HR', value: '72', unit: 'bpm', date: isoDate(addDays(-5)) },
    { id: uid(), type: 'Weight', value: '68.5', unit: 'Kg', date: isoDate(addDays(-7)) },
    { id: uid(), type: 'Temperature', value: '36.7', unit: '°C', date: isoDate(addDays(-5)) },
  ]);
}
seedIfEmpty();

function makeCrud(key, extra = {}) {
  return {
    async list() {
      if (USE_MOCK) return delay(readStore(key, []));
      return request(`/${key}`);
    },
    async create(item) {
      if (USE_MOCK) {
        const items = readStore(key, []);
        const created = { ...item, id: uid() };
        writeStore(key, [created, ...items]);
        return delay(created);
      }
      return request(`/${key}`, { method: 'POST', body: item });
    },
    async update(id, patch) {
      if (USE_MOCK) {
        const items = readStore(key, []);
        const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
        writeStore(key, next);
        return delay(next.find((i) => i.id === id));
      }
      return request(`/${key}/${id}`, { method: 'PATCH', body: patch });
    },
    async remove(id) {
      if (USE_MOCK) {
        const items = readStore(key, []);
        writeStore(key, items.filter((i) => i.id !== id));
        return delay(null);
      }
      return request(`/${key}/${id}`, { method: 'DELETE' });
    },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  async register({ name, email, password }) {
    if (USE_MOCK) {
      const user = { id: uid(), name, email };
      writeStore(KEYS.user, user);
      return delay({ user, token: 'mock-token' });
    }
    return request('/auth/register', { method: 'POST', body: { name, email, password } });
  },
  async login({ email, password }) {
    if (USE_MOCK) {
      const existing = readStore(KEYS.user, null);
      const user = existing && existing.email === email ? existing : { id: uid(), name: email.split('@')[0], email };
      writeStore(KEYS.user, user);
      return delay({ user, token: 'mock-token' });
    }
    return request('/auth/login', { method: 'POST', body: { email, password } });
  },
  async me() {
    if (USE_MOCK) return delay(readStore(KEYS.user, null));
    return request('/auth/me');
  },
  async requestPasswordReset(email) {
    if (USE_MOCK) return delay({ ok: true, email });
    return request('/auth/forgot-password', { method: 'POST', body: { email } });
  },
  async resetPassword({ password }) {
    if (USE_MOCK) return delay({ ok: true });
    return request('/auth/reset-password', { method: 'POST', body: { password } });
  },
  logout() {
    if (USE_MOCK) localStorage.removeItem(KEYS.user);
  },
};

// ---------------------------------------------------------------------------
// Routines + logs
// ---------------------------------------------------------------------------

export const routinesApi = makeCrud(KEYS.routines);

export const logsApi = {
  async list() {
    if (USE_MOCK) return delay(readStore(KEYS.logs, []));
    return request('/logs');
  },
  async record({ routineId, date, status }) {
    if (USE_MOCK) {
      const logs = readStore(KEYS.logs, []);
      const rest = logs.filter((l) => !(l.routineId === routineId && l.date === date));
      const entry = { id: uid(), routineId, date, status, loggedAt: new Date().toISOString() };
      const next = [entry, ...rest];
      writeStore(KEYS.logs, next);
      return delay(entry);
    }
    return request('/logs', { method: 'POST', body: { routineId, date, status } });
  },
};

// ---------------------------------------------------------------------------
// Medications, appointments, checkups, vitals
// ---------------------------------------------------------------------------

export const medicationsApi = makeCrud(KEYS.medications);
export const appointmentsApi = makeCrud(KEYS.appointments);
export const checkupsApi = makeCrud(KEYS.checkups);
export const vitalsApi = makeCrud(KEYS.vitals);