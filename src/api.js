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
// User-specific local storage helpers
// ---------------------------------------------------------------------------

function currentUserScope() {
  const user = readStore(USER_KEY, null);

  if (!user) return 'guest';

  return String(
    user.id ||
      user._id ||
      user.email ||
      'guest'
  )
    .trim()
    .toLowerCase();
}

function userStoreKey(key) {
  return `${key}.${currentUserScope()}`;
}

function readUserStore(key, fallback = []) {
  return readStore(userStoreKey(key), fallback);
}

function writeUserStore(key, value) {
  return writeStore(userStoreKey(key), value);
}

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

  if (
    typeof value === 'string' &&
    value.includes('T')
  ) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(11, 16);
    }
  }

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
  Checkup: 'health_check',
  Other: 'other',
};

const routineTypeFromBackend = {
  medication: 'Medication',
  exercise: 'Exercise',
  hydration: 'Hydration',
  sleep: 'Sleep',
  nutrition: 'Nutrition',
  health_check: 'Checkup',
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

  const ownerId =
    typeof routine.user === 'object' &&
    routine.user
      ? (
          routine.user._id ||
          routine.user.id ||
          routine.user.email ||
          ''
        )
      : (
          routine.user ||
          routine.userId ||
          routine.ownerId ||
          ''
        );

  return {
    id: routine._id || routine.id,

    ownerId: String(ownerId || ''),

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
      routineFrequencyFromBackend[
        routine.frequency
      ] ||
      routine.frequency ||
      'Daily',

    days: Array.isArray(routine.days)
      ? routine.days
      : [],

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

    time: toBackendDate(
      startDate,
      time
    ),

    startDate: toBackendDate(
      startDate,
      '00:00'
    ),

    endDate: toBackendDate(
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

      writeStore(USER_KEY, user);

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

    const loginResult =
      await request('/users/login', {
        method: 'POST',
        body: {
          email,
          password,
        },
      });

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

    // Create the two default routines
    // for a newly registered account.
    const startDate =
      new Date()
        .toISOString()
        .slice(0, 10);

    const endDate = '2099-12-31';

    await Promise.allSettled([
      request('/routine/createRoutine', {
        method: 'POST',
        body: {
          title: 'Morning Run',
          type: 'exercise',
          description:
            'A short morning run to support daily physical activity.',
          frequency: 'daily',
          time:
            `${startDate}T07:00:00.000Z`,
          startDate:
            `${startDate}T00:00:00.000Z`,
          endDate:
            `${endDate}T23:59:00.000Z`,
          routineStatus: true,
        },
      }),

      request('/routine/createRoutine', {
        method: 'POST',
        body: {
          title: 'Drink Water',
          type: 'hydration',
          description:
            'Drink water in the morning to support healthy hydration.',
          frequency: 'daily',
          time:
            `${startDate}T08:00:00.000Z`,
          startDate:
            `${startDate}T00:00:00.000Z`,
          endDate:
            `${endDate}T23:59:00.000Z`,
          routineStatus: true,
        },
      }),
    ]);

    return loginResult;
  },

  async login({
    email,
    password,
  }) {
    if (USE_MOCK) {
      const existing =
        readStore(USER_KEY, null);

      const user =
        existing &&
        existing.email === email
          ? existing
          : {
              id: uid(),
              name: email.split('@')[0],
              email,
            };

      writeStore(USER_KEY, user);

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
      await request('/users/login', {
        method: 'POST',
        body: {
          email,
          password,
        },
      });

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
        readStore(USER_KEY, null)
      );
    }

    return readStore(
      USER_KEY,
      null
    );
  },

  async updateProfile(patch) {
    const currentUser =
      readStore(USER_KEY, {});

    const updatedUser = {
      ...currentUser,
      ...patch,
    };

    writeStore(
      USER_KEY,
      updatedUser
    );

    return updatedUser;
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

  async resetPassword({ password }) {
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
      const routines =
        readUserStore(
          KEYS.routines,
          []
        );

      return delay(
        Array.isArray(routines)
          ? routines
          : []
      );
    }

    const result =
      await request(
        '/routine/getAllRoutines'
      );

    const currentUser =
      readStore(
        USER_KEY,
        null
      );

    const currentUserId =
      String(
        currentUser?.id ||
        currentUser?._id ||
        currentUser?.email ||
        ''
      );

    const routines =
      Array.isArray(result?.data)
        ? result.data
            .map(normalizeRoutine)
            .filter(Boolean)
        : [];

    if (!currentUserId) {
      return [];
    }

    return routines.filter(
      (routine) =>
        String(
          routine.ownerId || ''
        ) === currentUserId
    );
  },

  async create(item) {
    if (USE_MOCK) {
      const routines =
        readUserStore(
          KEYS.routines,
          []
        );

      const currentUser =
        readStore(
          USER_KEY,
          null
        );

      const created = {
        ...item,
        id: uid(),
        ownerId:
          currentUser?.id ||
          currentUser?._id ||
          currentUser?.email ||
          '',
      };

      writeUserStore(
        KEYS.routines,
        [
          created,
          ...routines,
        ]
      );

      return delay(created);
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

    const createdRoutine =
      normalizeRoutine(
        getRoutineFromResponse(
          result
        )
      );

    const currentUser =
      readStore(
        USER_KEY,
        null
      );

    if (
      createdRoutine &&
      !createdRoutine.ownerId
    ) {
      createdRoutine.ownerId =
        String(
          currentUser?.id ||
          currentUser?._id ||
          currentUser?.email ||
          ''
        );
    }

    return createdRoutine;
  },

  async getById(id) {
    if (USE_MOCK) {
      const routines =
        readUserStore(
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

    const routine =
      normalizeRoutine(
        getRoutineFromResponse(
          result
        )
      );

    const currentUser =
      readStore(
        USER_KEY,
        null
      );

    const currentUserId =
      String(
        currentUser?.id ||
        currentUser?._id ||
        currentUser?.email ||
        ''
      );

    if (
      routine &&
      routine.ownerId &&
      String(routine.ownerId) !==
        currentUserId
    ) {
      return null;
    }

    return routine;
  },

  async update(id, item) {
    if (USE_MOCK) {
      const routines =
        readUserStore(
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

      writeUserStore(
        KEYS.routines,
        next
      );

      return delay(
        next.find(
          (routine) =>
            routine.id === id
        ) || null
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

    const updatedRoutine =
      normalizeRoutine(
        getRoutineFromResponse(
          result
        )
      );

    const currentUser =
      readStore(
        USER_KEY,
        null
      );

    if (
      updatedRoutine &&
      !updatedRoutine.ownerId
    ) {
      updatedRoutine.ownerId =
        String(
          currentUser?.id ||
          currentUser?._id ||
          currentUser?.email ||
          ''
        );
    }

    return updatedRoutine;
  },

  async remove(id) {
    if (USE_MOCK) {
      const routines =
        readUserStore(
          KEYS.routines,
          []
        );

      writeUserStore(
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
// Routine Logs
// ---------------------------------------------------------------------------

export const logsApi = {
  async list() {
    const stored =
      readUserStore(
        KEYS.logs,
        []
      );

    return Array.isArray(stored)
      ? stored
      : [];
  },

  async record({
    routineId,
    date,
    status,
  }) {
    const logs =
      readUserStore(
        KEYS.logs,
        []
      );

    const entry = {
      id: uid(),
      routineId,
      date,
      status,
      loggedAt:
        new Date().toISOString(),
    };

    const nextLogs =
      logs.filter(
        (log) =>
          !(
            log.routineId ===
              routineId &&
            log.date === date
          )
      );

    writeUserStore(
      KEYS.logs,
      [
        entry,
        ...nextLogs,
      ]
    );

    return entry;
  },
};

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

export const medicationsApi = {
  async list() {
    const stored =
      readUserStore(
        KEYS.medications,
        []
      );

    return Array.isArray(stored)
      ? stored
      : [];
  },

  async create(item) {
    const medications =
      readUserStore(
        KEYS.medications,
        []
      );

    const created = {
      id: uid(),

      name:
        item.name?.trim() ||
        'Medication',

      category:
        item.category?.trim() ||
        '',

      frequency:
        item.frequency?.trim() ||
        'Daily',

      startDate:
        item.startDate ||
        new Date()
          .toISOString()
          .slice(0, 10),

      endDate:
        item.endDate ||
        '',
    };

    writeUserStore(
      KEYS.medications,
      [
        created,
        ...medications,
      ]
    );

    return created;
  },

  async update(id, item) {
    const medications =
      readUserStore(
        KEYS.medications,
        []
      );

    const next =
      medications.map(
        (medication) =>
          medication.id === id
            ? {
                ...medication,
                ...item,
              }
            : medication
      );

    writeUserStore(
      KEYS.medications,
      next
    );

    return (
      next.find(
        (medication) =>
          medication.id === id
      ) || null
    );
  },

  async remove(id) {
    const medications =
      readUserStore(
        KEYS.medications,
        []
      );

    writeUserStore(
      KEYS.medications,
      medications.filter(
        (medication) =>
          medication.id !== id
      )
    );

    return true;
  },
};

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export const appointmentsApi = {
  async list() {
    const stored =
      readUserStore(
        KEYS.appointments,
        []
      );

    return Array.isArray(stored)
      ? stored
      : [];
  },

  async create(item) {
    const appointments =
      readUserStore(
        KEYS.appointments,
        []
      );

    const created = {
      id: uid(),

      doctorName:
        item.doctorName?.trim() ||
        'Appointment',

      specialty:
        item.specialty?.trim() ||
        '',

      date:
        item.date ||
        new Date()
          .toISOString()
          .slice(0, 10),

      time:
        item.time ||
        '10:00 AM',

      location:
        item.location?.trim() ||
        '',
    };

    writeUserStore(
      KEYS.appointments,
      [
        created,
        ...appointments,
      ]
    );

    return created;
  },

  async update(id, item) {
    const appointments =
      readUserStore(
        KEYS.appointments,
        []
      );

    const next =
      appointments.map(
        (appointment) =>
          appointment.id === id
            ? {
                ...appointment,
                ...item,
              }
            : appointment
      );

    writeUserStore(
      KEYS.appointments,
      next
    );

    return (
      next.find(
        (appointment) =>
          appointment.id === id
      ) || null
    );
  },

  async remove(id) {
    const appointments =
      readUserStore(
        KEYS.appointments,
        []
      );

    writeUserStore(
      KEYS.appointments,
      appointments.filter(
        (appointment) =>
          appointment.id !== id
      )
    );

    return true;
  },
};

// ---------------------------------------------------------------------------
// Checkups
// ---------------------------------------------------------------------------

export const checkupsApi = {
  async list() {
    const stored =
      readUserStore(
        KEYS.checkups,
        []
      );

    return Array.isArray(stored)
      ? stored
      : [];
  },

  async create(item) {
    const checkups =
      readUserStore(
        KEYS.checkups,
        []
      );

    const created = {
      id: uid(),

      name:
        item.name?.trim() ||
        'Checkup',

      nextDue:
        item.nextDue ||
        new Date()
          .toISOString()
          .slice(0, 10),
    };

    writeUserStore(
      KEYS.checkups,
      [
        created,
        ...checkups,
      ]
    );

    return created;
  },

  async update(id, item) {
    const checkups =
      readUserStore(
        KEYS.checkups,
        []
      );

    const next =
      checkups.map(
        (checkup) =>
          checkup.id === id
            ? {
                ...checkup,
                ...item,
              }
            : checkup
      );

    writeUserStore(
      KEYS.checkups,
      next
    );

    return (
      next.find(
        (checkup) =>
          checkup.id === id
      ) || null
    );
  },

  async remove(id) {
    const checkups =
      readUserStore(
        KEYS.checkups,
        []
      );

    writeUserStore(
      KEYS.checkups,
      checkups.filter(
        (checkup) =>
          checkup.id !== id
      )
    );

    return true;
  },
};

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------

function vitalUnitForType(type) {
  return {
    BP: 'mmHg',
    HR: 'bpm',
    Weight: 'Kg',
    Temperature: '°C',
  }[type] || '';
}

export const vitalsApi = {
  async list() {
    const stored =
      readUserStore(
        KEYS.vitals,
        []
      );

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.map((vital) => ({
      id: vital.id,

      type:
        vital.type ||
        'BP',

      value:
        vital.value ??
        vital.reading ??
        '',

      date:
        vital.date ||
        vital.dateRecorded ||
        new Date()
          .toISOString()
          .slice(0, 10),

      unit:
        vital.unit ||
        vitalUnitForType(
          vital.type
        ),
    }));
  },

  async create(item) {
    const stored =
      readUserStore(
        KEYS.vitals,
        []
      );

    const vitals =
      Array.isArray(stored)
        ? stored
        : [];

    const created = {
      id: uid(),

      type:
        item.type ||
        'BP',

      value:
        item.value ??
        item.reading ??
        '',

      date:
        item.date ||
        item.dateRecorded ||
        new Date()
          .toISOString()
          .slice(0, 10),

      unit:
        item.unit ||
        vitalUnitForType(
          item.type
        ),
    };

    writeUserStore(
      KEYS.vitals,
      [
        created,
        ...vitals,
      ]
    );

    return created;
  },

  async update(id, item) {
    const stored =
      readUserStore(
        KEYS.vitals,
        []
      );

    const vitals =
      Array.isArray(stored)
        ? stored
        : [];

    const next =
      vitals.map(
        (vital) =>
          vital.id === id
            ? {
                ...vital,
                ...item,

                value:
                  item.value ??
                  item.reading ??
                  vital.value ??
                  '',

                date:
                  item.date ??
                  item.dateRecorded ??
                  vital.date ??
                  '',

                unit:
                  item.unit ||
                  vital.unit ||
                  vitalUnitForType(
                    item.type ||
                    vital.type
                  ),
              }
            : vital
      );

    writeUserStore(
      KEYS.vitals,
      next
    );

    return (
      next.find(
        (vital) =>
          vital.id === id
      ) || null
    );
  },

  async remove(id) {
    const stored =
      readUserStore(
        KEYS.vitals,
        []
      );

    const vitals =
      Array.isArray(stored)
        ? stored
        : [];

    writeUserStore(
      KEYS.vitals,
      vitals.filter(
        (vital) =>
          vital.id !== id
      )
    );

    return true;
  },
};