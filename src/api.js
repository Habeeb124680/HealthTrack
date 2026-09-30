// ---------------------------------------------------------------------------
// api.js
// ---------------------------------------------------------------------------

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'healthtrack.token';
const USER_KEY = 'healthtrack.user';

const USE_MOCK = false;

// ---------------------------------------------------------------------------
// HTTP request helper
// ---------------------------------------------------------------------------

async function request(path, { method = 'GET', body, token } = {}) {
  const authToken =
    token || localStorage.getItem(TOKEN_KEY);

  const headers = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType =
    res.headers.get('content-type') || '';

  let data = null;

  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' && data
        ? data.message ||
          data.error ||
          JSON.stringify(data)
        : data;

    throw new Error(
      message || `Request failed: ${res.status}`
    );
  }

  return data;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const delay = (value, ms = 200) =>
  new Promise((resolve) =>
    setTimeout(() => resolve(value), ms)
  );

const uid = () =>
  Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------------------
// Local storage helpers
// ---------------------------------------------------------------------------

function readStore(key, fallback = null) {
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

const KEYS = {
  user: USER_KEY,
  routines: 'healthtrack.routines',
  logs: 'healthtrack.logs',
  medications: 'healthtrack.medications',
  appointments: 'healthtrack.appointments',
  checkups: 'healthtrack.checkups',
  vitals: 'healthtrack.vitals',
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toBackendDate(date, time = '00:00') {
  if (!date) return '';

  const safeTime = time || '00:00';

  return `${date}T${safeTime}:00.000Z`;
}

function fromBackendDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function fromBackendTime(value) {
  if (!value) return '';

  // Backend may return an ISO date/time
  if (
    typeof value === 'string' &&
    value.includes('T')
  ) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(11, 16);
    }
  }

  // Already HH:mm
  return String(value).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Routine mappings
// ---------------------------------------------------------------------------

const routineTypeToBackend = {
  Medication: 'medication',
  Exercise: 'exercise',
  Hydration: 'hydration',
  Sleep: 'sleep',
  Nutrition: 'nutrition',
  Appointment: 'appointment',
  Other: 'other',
};

const routineTypeFromBackend = {
  medication: 'Medication',
  exercise: 'Exercise',
  hydration: 'Hydration',
  sleep: 'Sleep',
  nutrition: 'Nutrition',
  health_check: 'Other',
  appointment: 'Appointment',
  other: 'Other',
};

const routineFrequencyToBackend = {
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
  Forthnightly: 'forthnightly',
  'Every hour': 'every hour',
  'Every two hours': 'every two hours',
  'Every six hours': 'every six hours',
  'Every eight hours': 'every eight hours',
};

const routineFrequencyFromBackend = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  forthnightly: 'Forthnightly',
  'every hour': 'Every hour',
  'every two hours': 'Every two hours',
  'every six hours': 'Every six hours',
  'every eight hours': 'Every eight hours',
};

// ---------------------------------------------------------------------------
// Normalize backend routine -> frontend routine
// ---------------------------------------------------------------------------

function normalizeRoutine(routine) {
  if (!routine) return null;

  return {
    id: routine._id || routine.id,

    name:
      routine.title ||
      routine.name ||
      '',

    type:
      routineTypeFromBackend[routine.type] ||
      routine.type ||
      'Other',

    description:
      routine.description ||
      '',

    frequency:
      routineFrequencyFromBackend[routine.frequency] ||
      routine.frequency ||
      'Daily',

    days: routine.days || [],

    time: fromBackendTime(routine.time),

    startDate:
      fromBackendDate(routine.startDate),

    endDate:
      fromBackendDate(routine.endDate),

    active:
      routine.routineStatus !== undefined
        ? routine.routineStatus
        : routine.active ?? true,

    reminder:
      routine.reminder ?? true,
  };
}

// ---------------------------------------------------------------------------
// Prepare frontend routine -> backend routine
// ---------------------------------------------------------------------------

function prepareRoutineForBackend(item) {
  const startDate =
    item.startDate ||
    new Date().toISOString().slice(0, 10);

  const time =
    item.time ||
    '08:00';

  return {
    title:
      item.name?.trim() ||
      'Health routine',

    type:
      routineTypeToBackend[item.type] ||
      item.type?.toLowerCase() ||
      'other',

    description:
      item.description?.trim() ||
      `${item.name || 'Health'} routine`,

    frequency:
      routineFrequencyToBackend[item.frequency] ||
      item.frequency?.toLowerCase() ||
      'daily',

    time:
      toBackendDate(
        startDate,
        time
      ),

    startDate:
      toBackendDate(
        startDate,
        '00:00'
      ),

    endDate:
      toBackendDate(
        item.endDate || startDate,
        '23:59'
      ),

    routineStatus:
      item.active !== undefined
        ? item.active
        : true,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  async register({
    name,
    email,
    password,
  }) {
    if (USE_MOCK) {
      const user = {
        id: uid(),
        name,
        email,
      };

      writeStore(
        KEYS.user,
        user
      );

      return delay({
        user,
        token: 'mock-token',
      });
    }

    // Registration endpoint does NOT return a token.
    await request(
      '/users/register',
      {
        method: 'POST',
        body: {
          name,
          email,
          password,
        },
      }
    );

    // Login immediately after registration
    // to obtain the JWT token.
    const loginResult =
      await request(
        '/users/login',
        {
          method: 'POST',
          body: {
            email,
            password,
          },
        }
      );

    if (loginResult?.token) {
      localStorage.setItem(
        TOKEN_KEY,
        loginResult.token
      );
    }

    if (loginResult?.user) {
      writeStore(
        USER_KEY,
        loginResult.user
      );
    }

    return loginResult;
  },

  async login({
    email,
    password,
  }) {
    if (USE_MOCK) {
      const existing =
        readStore(
          KEYS.user,
          null
        );

      const user =
        existing &&
        existing.email === email
          ? existing
          : {
              id: uid(),
              name:
                email.split('@')[0],
              email,
            };

      writeStore(
        KEYS.user,
        user
      );

      localStorage.setItem(
        TOKEN_KEY,
        'mock-token'
      );

      return delay({
        user,
        token: 'mock-token',
      });
    }

    const result =
      await request(
        '/users/login',
        {
          method: 'POST',
          body: {
            email,
            password,
          },
        }
      );

    if (result?.token) {
      localStorage.setItem(
        TOKEN_KEY,
        result.token
      );
    }

    if (result?.user) {
      writeStore(
        USER_KEY,
        result.user
      );
    }

    return result;
  },

  async me() {
    if (USE_MOCK) {
      return delay(
        readStore(
          USER_KEY,
          null
        )
      );
    }

    // Your backend does not currently expose
    // a /users/me route.
    //
    // The logged-in user is therefore recovered
    // from localStorage.
    return readStore(
      USER_KEY,
      null
    );
  },

  async requestPasswordReset(email) {
    if (USE_MOCK) {
      return delay({
        ok: true,
        email,
      });
    }

    throw new Error(
      'Password reset is not connected to the current backend yet.'
    );
  },

  async resetPassword({
    password,
  }) {
    if (USE_MOCK) {
      return delay({
        ok: true,
      });
    }

    throw new Error(
      'Password reset is not connected to the current backend yet.'
    );
  },

  logout() {
    localStorage.removeItem(
      TOKEN_KEY
    );

    localStorage.removeItem(
      USER_KEY
    );
  },
};

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

function getRoutineFromResponse(result) {
  return (
    result?.data ||
    result?.routine ||
    result?.result ||
    result
  );
}

export const routinesApi = {
  async list() {
    if (USE_MOCK) {
      return delay(
        readStore(
          KEYS.routines,
          []
        )
      );
    }

    const result =
      await request(
        '/routine/getAllRoutines'
      );

    return (
      result?.data || []
    ).map(normalizeRoutine);
  },

  async create(item) {
    if (USE_MOCK) {
      const items =
        readStore(
          KEYS.routines,
          []
        );

      const created = {
        ...item,
        id: uid(),
      };

      writeStore(
        KEYS.routines,
        [
          created,
          ...items,
        ]
      );

      return delay(
        created
      );
    }

    const result =
      await request(
        '/routine/createRoutine',
        {
          method: 'POST',
          body:
            prepareRoutineForBackend(
              item
            ),
        }
      );

    return normalizeRoutine(
      result?.data
    );
  },

  async getById(id) {
    if (USE_MOCK) {
      const routines =
        readStore(
          KEYS.routines,
          []
        );

      return delay(
        routines.find(
          (routine) =>
            routine.id === id
        ) || null
      );
    }

    const result =
      await request(
        `/routine/getRoutineById/${id}`
      );

    return normalizeRoutine(
      result?.data
    );
  },

  async update(id, item) {
    if (USE_MOCK) {
      const routines =
        readStore(
          KEYS.routines,
          []
        );

      const next =
        routines.map(
          (routine) =>
            routine.id === id
              ? {
                  ...routine,
                  ...item,
                }
              : routine
        );

      writeStore(
        KEYS.routines,
        next
      );

      return delay(
        next.find(
          (routine) =>
            routine.id === id
        )
      );
    }

    const result =
      await request(
        `/routine/editRoutine/${id}`,
        {
          method: 'PUT',
          body:
            prepareRoutineForBackend(
              item
            ),
        }
      );

    return normalizeRoutine(
      result?.data
    );
  },

  async remove(id) {
    if (USE_MOCK) {
      const routines =
        readStore(
          KEYS.routines,
          []
        );

      writeStore(
        KEYS.routines,
        routines.filter(
          (routine) =>
            routine.id !== id
        )
      );

      return delay(true);
    }

    await request(
      `/routine/deleteRoutine/${id}`,
      {
        method: 'DELETE',
      }
    );

    return true;
  },
};

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export const logsApi = {
  async list() {
    return readStore(
      KEYS.logs,
      []
    );
  },

  async record({
    routineId,
    date,
    status,
  }) {
    const logs =
      readStore(
        KEYS.logs,
        []
      );

    const rest =
      logs.filter(
        (log) =>
          !(
            log.routineId ===
              routineId &&
            log.date === date
          )
      );

    const entry = {
      id: uid(),
      routineId,
      date,
      status,
      loggedAt:
        new Date().toISOString(),
    };

    writeStore(
      KEYS.logs,
      [
        entry,
        ...rest,
      ]
    );

    return entry;
  },
};

// ---------------------------------------------------------------------------
// Other API exports
//
// These are kept because App.jsx imports them.
// Their backend endpoints have not been verified yet.
// ---------------------------------------------------------------------------

export const medicationsApi = {
  async list() {
    return [];
  },

  async create() {
    throw new Error(
      'Medications are not connected to the current backend yet.'
    );
  },

  async update() {
    throw new Error(
      'Medications are not connected to the current backend yet.'
    );
  },

  async remove() {
    throw new Error(
      'Medications are not connected to the current backend yet.'
    );
  },
};

export const appointmentsApi = {
  async list() {
    return [];
  },

  async create() {
    throw new Error(
      'Appointments are not connected to the current backend yet.'
    );
  },

  async update() {
    throw new Error(
      'Appointments are not connected to the current backend yet.'
    );
  },

  async remove() {
    throw new Error(
      'Appointments are not connected to the current backend yet.'
    );
  },
};

export const checkupsApi = {
  async list() {
    return [];
  },

  async create() {
    throw new Error(
      'Checkups are not connected to the current backend yet.'
    );
  },

  async update() {
    throw new Error(
      'Checkups are not connected to the current backend yet.'
    );
  },

  async remove() {
    throw new Error(
      'Checkups are not connected to the current backend yet.'
    );
  },
};

export const vitalsApi = {
  async list() {
    return [];
  },

  async create() {
    throw new Error(
      'Vitals are not connected to the current backend yet.'
    );
  },

  async update() {
    throw new Error(
      'Vitals are not connected to the current backend yet.'
    );
  },

  async remove() {
    throw new Error(
      'Vitals are not connected to the current backend yet.'
    );
  },
};