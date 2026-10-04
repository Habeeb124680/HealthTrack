// ---------------------------------------------------------------------------
// api.js - HealthTrack frontend API layer
// ---------------------------------------------------------------------------

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'healthtrack.token';
const USER_KEY = 'healthtrack.user';
const PROFILE_PREFIX = 'healthtrack.profile.';
const USE_MOCK = false;

async function request(path, { method = 'GET', body, token } = {}) {
  const authToken = token || localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json' };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data
        ? data.message || data.error || JSON.stringify(data)
        : data;

    throw new Error(message || `Request failed: ${response.status}`);
  }

  return data;
}

const delay = (value, ms = 150) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const uid = () => Math.random().toString(36).slice(2, 10);

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

function getUserId(user) {
  return String(user?.id || user?._id || user?.email || '');
}

function profileStorageKey(user) {
  const id = getUserId(user);
  return id ? `${PROFILE_PREFIX}${encodeURIComponent(id)}` : null;
}

function mergeProfileOverride(user) {
  if (!user) return null;

  const key = profileStorageKey(user);
  const override = key ? readStore(key, null) : null;

  const merged = override
    ? {
        ...user,
        ...(override.name !== undefined ? { name: override.name } : {}),
        ...(override.email !== undefined ? { email: override.email } : {}),
      }
    : user;

  writeStore(USER_KEY, merged);
  return merged;
}

function toBackendDate(date, time = '00:00') {
  if (!date) return '';
  const safeTime = time || '00:00';
  return `${date}T${safeTime}:00.000Z`;
}

function fromBackendDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
}

function fromBackendTime(value) {
  if (!value) return '';

  if (typeof value === 'string' && value.includes('T')) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(11, 16);
    }
  }

  return String(value).slice(0, 5);
}

const routineTypeToBackend = {
  Medication: 'medication',
  Exercise: 'exercise',
  Hydration: 'hydration',
  Sleep: 'sleep',
  Nutrition: 'nutrition',
  Appointment: 'appointment',
  Checkup: 'health_check',
  Vitals: 'other',
  Other: 'other',
};

const routineTypeFromBackend = {
  medication: 'Medication',
  exercise: 'Exercise',
  hydration: 'Hydration',
  sleep: 'Sleep',
  nutrition: 'Nutrition',
  appointment: 'Appointment',
  health_check: 'Checkup',
  checkup: 'Checkup',
  vitals: 'Vitals',
  vital: 'Vitals',
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

function normalizeRoutine(routine) {
  if (!routine) return null;

  const owner =
    typeof routine.user === 'object' && routine.user
      ? routine.user._id || routine.user.id || routine.user.email || ''
      : routine.user || routine.userId || '';

  const rawDescription = routine.description || '';

  const isVitalsRoutine =
    routine.type === 'other' &&
    rawDescription.trim().toLowerCase().startsWith('[vitals]');

  return {
    id: routine._id || routine.id,
    ownerId: String(owner || ''),
    name: routine.title || routine.name || '',
    type: isVitalsRoutine
      ? 'Vitals'
      : routineTypeFromBackend[routine.type] ||
        routine.type ||
        'Other',
    description: isVitalsRoutine
      ? rawDescription.replace(/^\[vitals\]\s*/i, '')
      : rawDescription,
    frequency:
      routineFrequencyFromBackend[routine.frequency] ||
      routine.frequency ||
      'Daily',
    days: routine.days || [],
    time: fromBackendTime(routine.time),
    startDate: fromBackendDate(routine.startDate),
    endDate: fromBackendDate(routine.endDate),
    active:
      routine.routineStatus !== undefined
        ? routine.routineStatus
        : routine.active ?? true,
    reminder: routine.reminder ?? true,
  };
}

function prepareRoutineForBackend(item) {
  const startDate =
    item.startDate || new Date().toISOString().slice(0, 10);

  const endDate = item.endDate || startDate;
  const time = item.time || '08:00';

  return {
    title: item.name?.trim() || 'Health routine',

    type:
      routineTypeToBackend[item.type] ||
      item.type?.toLowerCase() ||
      'other',

    description:
      item.type === 'Vitals'
        ? `[Vitals] ${item.description?.trim() || ''}`.trim()
        : item.description?.trim() || '',

    frequency:
      routineFrequencyToBackend[item.frequency] ||
      item.frequency?.toLowerCase() ||
      'daily',

    time: toBackendDate(startDate, time),

    startDate: toBackendDate(startDate, '00:00'),

    endDate: toBackendDate(endDate, '23:59'),

    routineStatus:
      item.active !== undefined ? item.active : true,
  };
}
// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

async function ensureDefaultRoutines() {
  try {
    const existing = await routinesApi.list();

    const names = new Set(
      existing.map((routine) =>
        routine.name.trim().toLowerCase(),
      ),
    );

    const startDate = new Date().toISOString().slice(0, 10);

    const defaults = [
      {
        name: 'Morning Run',
        type: 'Exercise',
        description:
          'A short morning run to support daily physical activity.',
        frequency: 'Daily',
        time: '07:00',
        startDate,
        endDate: '2099-12-31',
        active: true,
      },
      {
        name: 'Drink Water',
        type: 'Hydration',
        description:
          'Drink water in the morning to support healthy hydration.',
        frequency: 'Daily',
        time: '08:00',
        startDate,
        endDate: '2099-12-31',
        active: true,
      },
    ];

    for (const routine of defaults) {
      if (!names.has(routine.name.toLowerCase())) {
        await routinesApi.create(routine);
      }
    }
  } catch (error) {
    console.warn(
      'Default routine setup skipped:',
      error,
    );
  }
}

export const authApi = {
  async register({ name, email, password }) {
    if (USE_MOCK) {
      const user = {
        id: uid(),
        name,
        email,
      };

      writeStore(USER_KEY, user);
      localStorage.setItem(TOKEN_KEY, 'mock-token');

      return delay({
        user,
        token: 'mock-token',
      });
    }

    await request('/users/register', {
      method: 'POST',
      body: {
        name,
        email,
        password,
      },
    });

    const loginResult = await request('/users/login', {
      method: 'POST',
      body: {
        email,
        password,
      },
    });

    if (loginResult?.token) {
      localStorage.setItem(
        TOKEN_KEY,
        loginResult.token,
      );
    }

    if (loginResult?.user) {
      mergeProfileOverride(loginResult.user);
    }

    await ensureDefaultRoutines();

    return {
      ...loginResult,
      user: readStore(
        USER_KEY,
        loginResult?.user || null,
      ),
    };
  },

  async login({ email, password }) {
    if (USE_MOCK) {
      const user = {
        id: uid(),
        name: email.split('@')[0],
        email,
      };

      writeStore(USER_KEY, user);

      localStorage.setItem(
        TOKEN_KEY,
        'mock-token',
      );

      return delay({
        user,
        token: 'mock-token',
      });
    }

    const result = await request('/users/login', {
      method: 'POST',
      body: {
        email,
        password,
      },
    });

    if (result?.token) {
      localStorage.setItem(
        TOKEN_KEY,
        result.token,
      );
    }

    const user = result?.user
      ? mergeProfileOverride(result.user)
      : null;

    return {
      ...result,
      user: user || result?.user,
    };
  },

  async updateProfile(patch = {}) {
    const current = readStore(
      USER_KEY,
      null,
    );

    if (!current) {
      throw new Error(
        'No signed-in user found.',
      );
    }

    const next = {
      ...current,

      ...(patch.name !== undefined
        ? {
            name: String(
              patch.name,
            ).trim(),
          }
        : {}),

      ...(patch.email !== undefined
        ? {
            email: String(
              patch.email,
            ).trim(),
          }
        : {}),
    };

    const key = profileStorageKey(current);

    if (key) {
      writeStore(key, {
        ...(readStore(key, {}) || {}),

        ...(patch.name !== undefined
          ? {
              name: next.name,
            }
          : {}),

        ...(patch.email !== undefined
          ? {
              email: next.email,
            }
          : {}),
      });
    }

    writeStore(
      USER_KEY,
      next,
    );

    return next;
  },

  async me() {
    const current = readStore(
      USER_KEY,
      null,
    );

    return current
      ? mergeProfileOverride(current)
      : null;
  },

  async requestPasswordReset(email) {
    if (USE_MOCK) {
      return delay({
        ok: true,
        email,
      });
    }

    throw new Error(
      'Password reset is not connected to the current backend yet.',
    );
  },

  async resetPassword() {
    if (USE_MOCK) {
      return delay({
        ok: true,
      });
    }

    throw new Error(
      'Password reset is not connected to the current backend yet.',
    );
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
          'healthtrack.routines',
          [],
        ),
      );
    }

    const result = await request(
      '/routine/getAllRoutines',
    );

    const raw = Array.isArray(result)
      ? result
      : result?.data ||
        result?.routines ||
        [];

    const normalized = raw
      .map(normalizeRoutine)
      .filter(Boolean);

    const currentUser = readStore(
      USER_KEY,
      null,
    );

    const currentUserId =
      getUserId(currentUser);

    const ownerDataExists =
      normalized.some(
        (routine) =>
          routine.ownerId,
      );

    if (
      ownerDataExists &&
      currentUserId
    ) {
      return normalized.filter(
        (routine) =>
          String(
            routine.ownerId,
          ) === currentUserId,
      );
    }

    return normalized;
  },

  async create(item) {
    if (USE_MOCK) {
      const routines = readStore(
        'healthtrack.routines',
        [],
      );

      const created = {
        ...item,
        id: uid(),
      };

      writeStore(
        'healthtrack.routines',
        [
          created,
          ...routines,
        ],
      );

      return delay(created);
    }

    const result = await request(
      '/routine/createRoutine',
      {
        method: 'POST',
        body:
          prepareRoutineForBackend(
            item,
          ),
      },
    );

    const created =
      normalizeRoutine(
        getRoutineFromResponse(
          result,
        ),
      );

    return created;
  },

  async getById(id) {
    const result = await request(
      `/routine/getRoutineById/${id}`,
    );

    return normalizeRoutine(
      getRoutineFromResponse(
        result,
      ),
    );
  },

  async update(id, item) {
    if (USE_MOCK) {
      const routines = readStore(
        'healthtrack.routines',
        [],
      );

      const next = routines.map(
        (routine) =>
          routine.id === id
            ? {
                ...routine,
                ...item,
              }
            : routine,
      );

      writeStore(
        'healthtrack.routines',
        next,
      );

      return next.find(
        (routine) =>
          routine.id === id,
      );
    }

    const result = await request(
      `/routine/editRoutine/${id}`,
      {
        method: 'PUT',
        body:
          prepareRoutineForBackend(
            item,
          ),
      },
    );

    return normalizeRoutine(
      getRoutineFromResponse(
        result,
      ),
    );
  },

  async remove(id) {
    if (USE_MOCK) {
      const routines = readStore(
        'healthtrack.routines',
        [],
      );

      writeStore(
        'healthtrack.routines',
        routines.filter(
          (routine) =>
            routine.id !== id,
        ),
      );

      return true;
    }

    await request(
      `/routine/deleteRoutine/${id}`,
      {
        method: 'DELETE',
      },
    );

    return true;
  },
};
// ---------------------------------------------------------------------------
// Local routine logs
// ---------------------------------------------------------------------------

export const logsApi = {
  async list() {
    const user = readStore(
      USER_KEY,
      null,
    );

    const scope =
      getUserId(user) || 'guest';

    return readStore(
      `healthtrack.logs.${encodeURIComponent(
        scope,
      )}`,
      [],
    );
  },

  async record({
    routineId,
    date,
    status,
  }) {
    const user = readStore(
      USER_KEY,
      null,
    );

    const scope =
      getUserId(user) || 'guest';

    const key =
      `healthtrack.logs.${encodeURIComponent(
        scope,
      )}`;

    const logs = readStore(
      key,
      [],
    );

    const entry = {
      id: uid(),
      routineId,
      date,
      status,
      loggedAt:
        new Date().toISOString(),
    };

    const next = logs.filter(
      (log) =>
        !(
          log.routineId === routineId &&
          log.date === date
        ),
    );

    writeStore(
      key,
      [
        entry,
        ...next,
      ],
    );

    return entry;
  },
};

// ---------------------------------------------------------------------------
// Compatibility exports
// ---------------------------------------------------------------------------

export const medicationsApi = {
  list: async () =>
    (await routinesApi.list()).filter(
      (r) => r.type === 'Medication',
    ),

  create: async (item) =>
    routinesApi.create({
      ...item,
      type: 'Medication',
      name: item.name,
    }),

  update: async (id, item) =>
    routinesApi.update(id, {
      ...item,
      type: 'Medication',
      name: item.name,
    }),

  remove: async (id) =>
    routinesApi.remove(id),
};

export const appointmentsApi = {
  list: async () =>
    (await routinesApi.list()).filter(
      (r) => r.type === 'Appointment',
    ),

  create: async (item) =>
    routinesApi.create({
      ...item,
      type: 'Appointment',
      name:
        item.name ||
        item.doctorName,
    }),

  update: async (id, item) =>
    routinesApi.update(id, {
      ...item,
      type: 'Appointment',
      name:
        item.name ||
        item.doctorName,
    }),

  remove: async (id) =>
    routinesApi.remove(id),
};

export const checkupsApi = {
  list: async () =>
    (await routinesApi.list()).filter(
      (r) => r.type === 'Checkup',
    ),

  create: async (item) =>
    routinesApi.create({
      ...item,
      type: 'Checkup',
      name: item.name,
    }),

  update: async (id, item) =>
    routinesApi.update(id, {
      ...item,
      type: 'Checkup',
      name: item.name,
    }),

  remove: async (id) =>
    routinesApi.remove(id),
};

export const vitalsApi = {
  list: async () =>
    (await routinesApi.list()).filter(
      (r) => r.type === 'Vitals',
    ),

  create: async (item) =>
    routinesApi.create({
      ...item,
      type: 'Vitals',
      name:
        item.name ||
        item.type,
    }),

  update: async (id, item) =>
    routinesApi.update(id, {
      ...item,
      type: 'Vitals',
      name:
        item.name ||
        item.type,
    }),

  remove: async (id) =>
    routinesApi.remove(id),
};