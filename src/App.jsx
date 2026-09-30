import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import {
  Activity,
  Calendar as CalendarIcon,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Heart,
  HeartPulse,
  Home as HomeIcon,
  LogOut,
  Mail,
  Moon,
  Pill,
  Plus,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  Triangle,
  X,
} from 'lucide-react';
import {
  authApi,
  routinesApi,
  logsApi,
  medicationsApi,
  appointmentsApi,
  checkupsApi,
  vitalsApi,
} from './api';
import './App.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROUTINE_TYPES = ['Medication', 'Exercise', 'Hydration', 'Sleep', 'Nutrition', 'Appointment', 'Other'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad2 = (n) => String(n).padStart(2, '0');
const todayStr = () => new Date().toISOString().slice(0, 10);

function typeAbbrev(type) {
  const map = { Medication: 'Rx', Exercise: 'Ex', Hydration: 'H2O', Sleep: 'Zz', Nutrition: 'Nt', Appointment: 'Ap', Other: 'Ot' };
  return map[type] || type.slice(0, 2);
}
function calendarColor(type) {
  const map = { Medication: 'green', Exercise: 'orange', Hydration: 'blue', Appointment: 'violet', Sleep: 'violet', Nutrition: 'violet', Other: 'violet' };
  return map[type] || 'violet';
}
function vitalColor(type) {
  return { BP: 'red', HR: 'green', Weight: 'violet', Temperature: 'orange' }[type] || 'violet';
}
function vitalLabel(type) {
  return { BP: 'Blood Pressure', HR: 'Heart Rate', Weight: 'Weight', Temperature: 'Temperature' }[type] || type;
}
function vitalUnit(type) {
  return { BP: 'mmHg', HR: 'bpm', Weight: 'Kg', Temperature: '°C' }[type] || '';
}

function initials(name) {
  return (name || 'U').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}
function formatTime12(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${pad2(m)} ${period}`;
}
function formatDatePretty(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function monthYearLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function isScheduledOn(routine, dateStr) {
  if (!routine.active) return false;
  const date = new Date(`${dateStr}T00:00:00`);
  const start = new Date(`${routine.startDate}T00:00:00`);
  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime()) || date < start) return false;
  if (routine.frequency === 'Daily') return true;
  return routine.days?.includes(WEEKDAYS[date.getDay()]) ?? false;
}

function checkupStatus(nextDueYM) {
  if (!nextDueYM) return { label: 'Up to date', tone: 'green' };
  const [y, m] = nextDueYM.split('-').map(Number);
  const due = new Date(y, m - 1, 1);
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  const diffMonths = (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth());
  if (diffMonths < 0) return { label: 'Over due', tone: 'red' };
  if (diffMonths <= 1) return { label: 'Due soon', tone: 'orange' };
  return { label: 'Up to date', tone: 'green' };
}

function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstWeekday).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const ThemeContext = createContext(null);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('healthtrack.theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('healthtrack.theme', theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
const useTheme = () => useContext(ThemeContext);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    authApi.me().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u } = await authApi.login({ email, password });
    setUser(u);
    return u;
  }, []);
  const register = useCallback(async (name, email, password) => {
    const { user: u } = await authApi.register({ name, email, password });
    setUser(u);
    return u;
  }, []);
  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);
  const updateProfile = useCallback((patch) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      localStorage.setItem('healthtrack.user', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateProfile, resetEmail, setResetEmail }),
    [user, loading, login, register, logout, updateProfile, resetEmail],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
const useAuth = () => useContext(AuthContext);

// ---------------------------------------------------------------------------
// Data (routines/logs + medications/appointments/checkups/vitals)
// ---------------------------------------------------------------------------

const DataContext = createContext(null);

function useCrudState(apiObj) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => setItems(await apiObj.list()), [apiObj]);
  const add = useCallback(async (item) => {
    const created = await apiObj.create(item);
    setItems((prev) => [created, ...prev]);
    return created;
  }, [apiObj]);
  const update = useCallback(async (id, patch) => {
    const updated = await apiObj.update(id, patch);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  }, [apiObj]);
  const remove = useCallback(async (id) => {
    await apiObj.remove(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [apiObj]);
  return { items, load, add, update, remove };
}

function DataProvider({ children }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const routines = useCrudState(routinesApi);
  const medications = useCrudState(medicationsApi);
  const appointments = useCrudState(appointmentsApi);
  const checkups = useCrudState(checkupsApi);
  const vitals = useCrudState(vitalsApi);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      await routines.load();

      // Routine status logs are stored locally until the backend
      // exposes a dedicated logs endpoint.
      setLogs(await logsApi.list());
    } catch (error) {
      console.error('Failed to load routines:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const logStatus = useCallback(async (routineId, date, status) => {
    const entry = await logsApi.record({ routineId, date, status });
    setLogs((prev) => [entry, ...prev.filter((l) => !(l.routineId === routineId && l.date === date))]);
    return entry;
  }, []);
  const logFor = useCallback(
    (routineId, date) => logs.find((l) => l.routineId === routineId && l.date === date) || null,
    [logs],
  );

  const value = useMemo(() => ({
    loading,
    routines: routines.items, addRoutine: routines.add, updateRoutine: routines.update, removeRoutine: routines.remove,
    medications: medications.items, addMedication: medications.add, updateMedication: medications.update, removeMedication: medications.remove,
    appointments: appointments.items, addAppointment: appointments.add, updateAppointment: appointments.update, removeAppointment: appointments.remove,
    checkups: checkups.items, addCheckup: checkups.add, updateCheckup: checkups.update, removeCheckup: checkups.remove,
    vitals: vitals.items, addVital: vitals.add, updateVital: vitals.update, removeVital: vitals.remove,
    logs, logStatus, logFor,
  }), [loading, routines.items, medications.items, appointments.items, checkups.items, vitals.items, logs, logStatus, logFor]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
const useData = () => useContext(DataContext);

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

function Logo({ size = 30 }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <HeartPulse size={size * 0.58} strokeWidth={2.4} />
    </span>
  );
}

function Fab({ onClick, to }) {
  const content = <Plus size={24} />;
  if (to) return <Link to={to} className="fab">{content}</Link>;
  return <button type="button" className="fab" onClick={onClick}>{content}</button>;
}

function StatusPill({ status, onClick }) {
  const label = status === 'completed' ? 'Completed' : status === 'missed' ? 'Missed' : 'Pending';
  const tone = status === 'completed' ? 'green' : status === 'missed' ? 'red' : 'orange';
  return (
    <button type="button" className={`pill pill-${tone}`} onClick={onClick} disabled={!onClick}>
      {label}
    </button>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-knob" />
    </button>
  );
}

function Badge({ text, tint, shape = 'circle' }) {
  return <span className={`badge badge-${tint} badge-${shape}`}>{text}</span>;
}

function BackHeader({ title, to = -1 }) {
  const navigate = useNavigate();
  return (
    <div className="back-header">
      <button type="button" className="back-btn" onClick={() => (typeof to === 'number' ? navigate(to) : navigate(to))}>
        <ChevronLeft size={22} />
      </button>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className="stat-card">
      <span className="stat-card-label">{label}</span>
      <span className={`stat-card-value ${tone ? `tone-${tone}` : ''}`}>{value}</span>
    </div>
  );
}

function ModalSheet({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth pages
// ---------------------------------------------------------------------------

function AuthShell({ children }) {
  return <div className="auth-shell"><div className="auth-card">{children}</div></div>;
}

const ONBOARDING_SLIDES = [
  {
    icon: <Activity size={34} />,
    title: 'Create & Track Routines',
    body: 'Add medications, exercise, hydration and more — all managed from one simple dashboard.',
  },
  {
    icon: <span className="onboarding-bang">!</span>,
    title: 'Get Timely Reminders',
    body: 'Never miss a dose or appointment and see your progress build over time',
  },
];

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  if (user) return <Navigate to="/app" replace />;

  const total = ONBOARDING_SLIDES.length + 1;
  const isFinal = step === ONBOARDING_SLIDES.length;

  return (
    <div className="onboarding-shell">
      {isFinal ? (
        <>
          <div className="onboarding-icon final"><Heart size={30} /></div>
          <h1>Health Track</h1>
          <p>Create, schedule, get reminded, and track your health routines all in one place</p>
        </>
      ) : (
        <>
          <div className="onboarding-icon">{ONBOARDING_SLIDES[step].icon}</div>
          <h1>{ONBOARDING_SLIDES[step].title}</h1>
          <p>{ONBOARDING_SLIDES[step].body}</p>
        </>
      )}

      <div className="onboarding-dots">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />
        ))}
      </div>

      {isFinal ? (
        <div className="onboarding-actions">
          <button type="button" className="btn btn-accent btn-block" onClick={() => navigate('/register')}>Get Started</button>
          <button type="button" className="btn btn-outline btn-block" onClick={() => navigate('/login')}>I already have an account</button>
        </div>
      ) : (
        <button type="button" className="btn btn-accent btn-block" onClick={() => setStep((s) => s + 1)}>Next</button>
      )}
    </div>
  );
}

function WelcomePage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Enter your email and password to continue.'); return; }
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Could not sign in. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="brand-mark"><Logo size={28} />HealthTrack</div>
      <h1>Welcome back</h1>
      <p className="auth-subtitle">Sign in to continue your health journey.</p>
      <form onSubmit={onSubmit} className="auth-form">
        <label>EMAIL<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amaka@gmail.com" /></label>
        <label>
          PASSWORD
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        <Link to="/forgot-password" className="inline-link">Forgot password?</Link>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
      </form>
      <p className="auth-switch">Don&rsquo;t have an account? <Link to="/register">Sign up</Link></p>
    </AuthShell>
  );
}

function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) { setError('Fill in every field to create your account.'); return; }
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="brand-mark"><Logo size={28} />HealthTrack</div>
      <h1>Create your account</h1>
      <p className="auth-subtitle">Start building routines you&rsquo;ll actually keep.</p>
      <form onSubmit={onSubmit} className="auth-form">
        <label>FULL NAME<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amaka Chukwu" /></label>
        <label>EMAIL<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amaka@gmail.com" /></label>
        <label>PASSWORD<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}

function ForgotPasswordPage() {
  const { setResetEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Enter the email linked to your account.'); return; }
    setSubmitting(true);
    try {
      await authApi.requestPasswordReset(email);
      setResetEmail(email);
      navigate('/check-email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <BackHeader to="/login" />
      <h1>Forgot your password?</h1>
      <p className="auth-subtitle">Enter the email linked to your account and we&rsquo;ll send a link to reset it.</p>
      <form onSubmit={onSubmit} className="auth-form auth-form-spaced">
        <label>EMAIL<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amaka@gmail.com" /></label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
}

function CheckEmailPage() {
  const { resetEmail } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthShell>
      <div className="check-email-icon"><Mail size={28} /></div>
      <h1 className="center">Check your email</h1>
      <p className="auth-subtitle center">
        We&rsquo;ve sent a password reset link to<br /><strong>{resetEmail || 'your email'}</strong>
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/reset-password')}>
        Open email app
      </button>
      <p className="auth-switch center">
        Didn&rsquo;t get it? <button type="button" className="link-btn" onClick={() => authApi.requestPasswordReset(resetEmail)}>Resend link</button>
      </p>
    </AuthShell>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Contains a number', pass: /\d/.test(password) },
    { label: 'Contains a symbol', pass: /[^A-Za-z0-9]/.test(password) },
  ];

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!checks.every((c) => c.pass)) { setError('Your password doesn\u2019t meet all requirements yet.'); return; }
    if (password !== confirm) { setError('Passwords don\u2019t match.'); return; }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ password });
      navigate('/login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <BackHeader to="/check-email" />
      <h1>Set a new password?</h1>
      <p className="auth-subtitle">Your new password must be different from previously used passwords</p>
      <form onSubmit={onSubmit} className="auth-form auth-form-spaced">
        <label>NEW PASSWORD<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
        <label>CONFIRM PASSWORD<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" /></label>
        <ul className="checklist">
          {checks.map((c) => (
            <li key={c.label} className={c.pass ? 'pass' : ''}>
              <span className="checklist-dot">{c.pass && <Check size={13} />}</span>{c.label}
            </li>
          ))}
        </ul>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// Protected shell + bottom nav
// ---------------------------------------------------------------------------

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="full-loader">Loading your routines…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const TABS = [
  { to: '/app', icon: HomeIcon, end: true },
  { to: '/app/routines', icon: CheckSquare },
  { to: '/app/calendar', icon: CalendarIcon },
  { to: '/app/progress', icon: Triangle },
  { to: '/app/settings', icon: SettingsIcon },
];

const NAV_ITEMS = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/app/routines', label: 'My Routines', icon: CheckSquare },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/app/medications', label: 'Medications', icon: Pill },
  { to: '/app/appointments', label: 'Appointments', icon: CalendarClock },
  { to: '/app/checkups', label: 'Checkups', icon: ClipboardCheck },
  { to: '/app/vitals', label: 'Vitals', icon: HeartPulse },
  { to: '/app/progress', label: 'Progress', icon: Triangle },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" className="sidebar-theme-toggle" onClick={toggleTheme}>
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}

function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark sidebar-brand"><Logo size={28} />HealthTrack</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
        <button type="button" className="sidebar-user" onClick={onLogout}>
          <span className="avatar">{initials(user?.name)}</span>
          <span className="sidebar-user-info">
            <strong>{user?.name}</strong>
            <small>Log out</small>
          </span>
          <LogOut size={16} />
        </button>
      </aside>

      <div className="app-main">
        <main className="app-content">{children}</main>
        <nav className="bottom-nav">
          {TABS.map(({ to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
              <span className="tab-icon"><Icon size={20} /></span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function QuickAccessRow() {
  const items = [
    { to: '/app/medications', label: 'Medications', tint: 'violet' },
    { to: '/app/appointments', label: 'Appointments', tint: 'pink' },
    { to: '/app/checkups', label: 'Checkups', tint: 'orange' },
    { to: '/app/vitals', label: 'Vitals', tint: 'red' },
  ];
  return (
    <div className="quick-row">
      {items.map((it) => (
        <Link key={it.to} to={it.to} className="quick-item">
          <span className={`quick-icon tint-${it.tint}`}>{it.label.slice(0, 2)}</span>
          <span className="quick-label">{it.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function DashboardPage() {
  const { user } = useAuth();
  const { routines, logFor, logStatus, loading } = useData();
  const today = todayStr();

  const todays = useMemo(
    () => routines.filter((r) => isScheduledOn(r, today)).sort((a, b) => a.time.localeCompare(b.time)),
    [routines, today],
  );
  const completed = todays.filter((r) => logFor(r.id, today)?.status === 'completed').length;

  const cycleStatus = (routineId) => {
    const current = logFor(routineId, today)?.status;
    const next = current === undefined ? 'completed' : current === 'completed' ? 'missed' : current === 'missed' ? 'pending' : 'completed';
    if (next === 'pending') logStatus(routineId, today, 'pending');
    else logStatus(routineId, today, next);
  };

  if (loading) return <div className="full-loader">Loading dashboard…</div>;

  return (
    <div className="page">
      <div className="home-header">
        <div>
          <p className="greeting">{greeting()}</p>
          <h1 className="home-name">{user?.name?.split(' ')[0] || 'there'}</h1>
        </div>
        <Link to="/app/settings" className="avatar">{initials(user?.name)}</Link>
      </div>

      <div className="progress-card">
        <span>Today&rsquo;s Progress</span>
        <strong>{completed} of {todays.length} completed</strong>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: todays.length ? `${(completed / todays.length) * 100}%` : '0%' }} />
        </div>
      </div>

      <QuickAccessRow />

      <h2 className="section-title">Today&rsquo;s Routines</h2>
      {todays.length === 0 ? (
        <EmptyState title="Nothing scheduled today" body="Add a routine to see it here." />
      ) : (
        <div className="row-list">
          {todays.map((r) => {
            const status = logFor(r.id, today)?.status;
            return (
              <div className="item-row" key={r.id}>
                <div className="item-row-body">
                  <strong>{r.name}</strong>
                  <span>{formatTime12(r.time)}</span>
                </div>
                <StatusPill status={status} onClick={() => cycleStatus(r.id)} />
              </div>
            );
          })}
        </div>
      )}

      <Fab to="/app/routines/new" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// All Routines + Routine form (full page)
// ---------------------------------------------------------------------------

function RoutinesPage() {
  const { routines, logFor, logStatus, loading } = useData();
  const [filter, setFilter] = useState('All');
  const today = todayStr();

  const filtered = filter === 'All' ? routines : routines.filter((r) => r.type === filter);

  if (loading) return <div className="full-loader">Loading routines…</div>;

  return (
    <div className="page">
      <h1 className="page-title">All Routines</h1>
      <div className="chip-row">
        {['All', ...ROUTINE_TYPES].map((t) => (
          <button key={t} type="button" className={`chip ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No routines yet" body="Tap + to create your first routine." />
      ) : (
        <div className="row-list">
          {filtered.map((r) => {
            const status = logFor(r.id, today)?.status;
            const schedule =
              r.frequency === 'Daily'
                ? 'Daily'
                : `Weekly${r.days?.length ? `, ${r.days.join(', ')}` : ''}`;
            return (
              <Link to={`/app/routines/${r.id}/edit`} className="item-row" key={r.id}>
                <Badge text={typeAbbrev(r.type)} tint="violet" />
                <div className="item-row-body">
                  <strong>{r.name}</strong>
                  <span>{r.type} &middot; {schedule}, {formatTime12(r.time)}</span>
                </div>
                <StatusPill status={status} onClick={(e) => { e.preventDefault(); logStatus(r.id, today, status === 'completed' ? 'missed' : 'completed'); }} />
              </Link>
            );
          })}
        </div>
      )}
      <Fab to="/app/routines/new" />
    </div>
  );
}

function RoutineFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    routines,
    addRoutine,
    updateRoutine,
    removeRoutine,
  } = useData();

  const existing = id
    ? routines.find((r) => r.id === id)
    : null;

  const [form, setForm] = useState(() =>
    existing || {
      name: '',
      type: 'Medication',
      frequency: 'Daily',
      days: [],
      time: '08:00',
      startDate: todayStr(),
      endDate: todayStr(),
      active: true,
      reminder: true,
      description: '',
    }
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const update = (patch) => {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
  };

  useEffect(() => {
    if (existing) {
      setForm({
        ...existing,
        endDate: existing.endDate || existing.startDate || todayStr(),
        description: existing.description || '',
        days: existing.days || [],
      });
    }
  }, [existing]);

  const toggleDay = (day) => {
    const days = form.days.includes(day)
      ? form.days.filter((d) => d !== day)
      : [...form.days, day];

    update({ days });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Please enter a routine name.');
      return;
    }

    if (!form.startDate) {
      setError('Please select a start date.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description:
          form.description?.trim() ||
          `${form.name.trim()} routine`,
        endDate: form.endDate || form.startDate,
      };

      if (existing) {
        await updateRoutine(existing.id, payload);
      } else {
        await addRoutine(payload);
      }

      navigate('/app/routines');
    } catch (err) {
      console.error('Routine save failed:', err);
      setError(
        err?.message ||
        'Could not save the routine. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!existing) return;

    const confirmed = window.confirm(
      `Delete "${existing.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError('');
    setDeleting(true);

    try {
      await removeRoutine(existing.id);
      navigate('/app/routines');
    } catch (err) {
      console.error('Routine delete failed:', err);
      setError(
        err?.message ||
        'Could not delete the routine. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page form-page">
      <BackHeader to="/app/routines" />

      <h1 className="center">
        {existing ? 'Edit Routine' : 'New Routine'}
      </h1>

      <form onSubmit={onSubmit} className="stacked-form">
        <label>
          Routine Name
          <input
            value={form.name}
            onChange={(e) =>
              update({ name: e.target.value })
            }
            placeholder="e.g Take Vitamin D"
            required
          />
        </label>

        <label>
          Routine Type
          <select
            value={form.type}
            onChange={(e) =>
              update({ type: e.target.value })
            }
          >
            {ROUTINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          Description
          <textarea
            value={form.description || ''}
            onChange={(e) =>
              update({ description: e.target.value })
            }
            placeholder="Describe this routine"
            rows={4}
          />
        </label>

        <label>
          Frequency
          <select
            value={form.frequency}
            onChange={(e) =>
              update({
                frequency: e.target.value,
                days:
                  e.target.value === 'Daily'
                    ? []
                    : form.days,
              })
            }
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Specific days</option>
          </select>
        </label>

        {form.frequency !== 'Daily' && (
          <div className="day-picker">
            {WEEKDAYS.map((day) => (
              <button
                type="button"
                key={day}
                className={`day-chip ${
                  form.days.includes(day)
                    ? 'active'
                    : ''
                }`}
                onClick={() => toggleDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        )}

        <label>
          Time
          <input
            type="time"
            value={form.time}
            onChange={(e) =>
              update({ time: e.target.value })
            }
            required
          />
        </label>

        <label>
          Start Date
          <input
            type="date"
            value={form.startDate}
            onChange={(e) =>
              update({ startDate: e.target.value })
            }
            required
          />
        </label>

        <label>
          End Date
          <input
            type="date"
            value={form.endDate || form.startDate}
            min={form.startDate}
            onChange={(e) =>
              update({ endDate: e.target.value })
            }
            required
          />
        </label>

        <div className="switch-row">
          <span>Enable Reminder</span>
          <Toggle
            checked={form.reminder}
            onChange={(value) =>
              update({ reminder: value })
            }
          />
        </div>

        <div className="switch-row">
          <span>Active</span>
          <Toggle
            checked={form.active}
            onChange={(value) =>
              update({ active: value })
            }
          />
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={saving || deleting}
        >
          {saving
            ? existing
              ? 'Updating…'
              : 'Creating…'
            : 'Save Routine'}
        </button>

        {existing && (
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={onDelete}
            disabled={saving || deleting}
          >
            {deleting
              ? 'Deleting…'
              : 'Delete Routine'}
          </button>
        )}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

function CalendarPage() {
  const { routines, appointments, logFor, loading } = useData();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(todayStr());

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const eventsFor = useCallback((dateStr) => {
    const items = [];
    routines.forEach((r) => { if (isScheduledOn(r, dateStr)) items.push({ kind: 'routine', id: r.id, name: r.name, time: r.time, type: r.type }); });
    appointments.forEach((a) => { if (a.date === dateStr) items.push({ kind: 'appointment', id: a.id, name: a.doctorName, time: a.time, type: 'Appointment' }); });
    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [routines, appointments]);

  if (loading) return <div className="full-loader">Loading calendar…</div>;

  const selectedItems = eventsFor(selected);

  return (
    <div className="page">
      <h1 className="page-title">Calendar</h1>
      <div className="calendar-card">
        <div className="calendar-card-header">
          <button type="button" className="icon-btn" onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))}><ChevronLeft size={16} /></button>
          <strong>{MONTHS[cursor.month]}</strong>
          <strong>{cursor.year}</strong>
          <button type="button" className="icon-btn" onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))}><ChevronRight size={16} /></button>
        </div>
        <div className="calendar-weekdays">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="calendar-cells">
          {cells.map((day, i) => {
            if (!day) return <span key={i} className="cal-cell empty" />;
            const dateStr = `${cursor.year}-${pad2(cursor.month + 1)}-${pad2(day)}`;
            const events = eventsFor(dateStr);
            const isSelected = dateStr === selected;
            return (
              <button key={i} type="button" className={`cal-cell ${isSelected ? 'selected' : ''}`} onClick={() => setSelected(dateStr)}>
                <span>{day}</span>
                <span className="cal-dots">
                  {events.slice(0, 3).map((ev, idx) => <i key={idx} className={`dot tint-${calendarColor(ev.type)}`} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="legend-row">
        <span><i className="dot tint-green" /> Med</span>
        <span><i className="dot tint-orange" /> Exercise</span>
        <span><i className="dot tint-violet" /> Appointment</span>
      </div>

      <h2 className="section-title">{formatDatePretty(selected)}</h2>
      {selectedItems.length === 0 ? (
        <EmptyState title="Nothing on this day" />
      ) : (
        <div className="row-list">
          {selectedItems.map((ev) => (
            <div key={`${ev.kind}-${ev.id}`} className={`item-row border-${calendarColor(ev.type)}`}>
              <div className="item-row-body">
                <strong>{ev.name}</strong>
                <span>{formatTime12(ev.time)}</span>
              </div>
              {ev.kind === 'routine' && <StatusPill status={logFor(ev.id, selected)?.status} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

function MedicationsPage() {
  const { medications, addMedication, updateMedication, removeMedication, routines, logs, loading } = useData();
  const [modal, setModal] = useState(null);
  const today = todayStr();

  const medRoutineIds = new Set(routines.filter((r) => r.type === 'Medication').map((r) => r.id));
  const takenToday = logs.filter((l) => l.date === today && l.status === 'completed' && medRoutineIds.has(l.routineId)).length;
  const refillSoon = medications.filter((m) => m.pillsLeft <= m.refillThreshold).length;

  if (loading) return <div className="full-loader">Loading medications…</div>;

  return (
    <div className="page">
      <h1 className="page-title">Medications</h1>
      <div className="stat-grid-3">
        <StatCard label="Active" value={medications.length} />
        <StatCard label="Taken Today" value={`${takenToday}/${medRoutineIds.size}`} />
        <StatCard label="Refill Soon" value={refillSoon} tone={refillSoon ? 'orange' : undefined} />
      </div>

      <h2 className="section-title">Medication List</h2>
      {medications.length === 0 ? (
        <EmptyState title="No medications yet" />
      ) : (
        <div className="row-list">
          {medications.map((m) => {
            const low = m.pillsLeft <= m.refillThreshold;
            return (
              <button type="button" key={m.id} className="item-row as-button" onClick={() => setModal({ ...m })}>
                <Badge text="Rx" tint="violet" />
                <div className="item-row-body">
                  <strong>{m.name}</strong>
                  <span>{m.category} &middot; {m.frequency}</span>
                </div>
                <span className={`pill pill-${low ? 'orange' : 'green'}`}>{low ? 'Refill soon' : `${m.pillsLeft} left`}</span>
              </button>
            );
          })}
        </div>
      )}

      <Fab onClick={() => setModal({ name: '', category: '', frequency: '', pillsLeft: 30, refillThreshold: 5 })} />

      {modal && (
        <ModalSheet title={modal.id ? 'Edit Medication' : 'New Medication'} onClose={() => setModal(null)}>
          <MedicationForm
            value={modal}
            onCancel={() => setModal(null)}
            onDelete={modal.id ? async () => { await removeMedication(modal.id); setModal(null); } : null}
            onSave={async (data) => {
              if (modal.id) await updateMedication(modal.id, data);
              else await addMedication(data);
              setModal(null);
            }}
          />
        </ModalSheet>
      )}
    </div>
  );
}

function MedicationForm({ value, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="modal-form">
      <label>Name<input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Lisinopril 10mg" required /></label>
      <label>Category<input value={form.category} onChange={(e) => update({ category: e.target.value })} placeholder="e.g. Blood pressure" /></label>
      <label>Frequency<input value={form.frequency} onChange={(e) => update({ frequency: e.target.value })} placeholder="e.g. 2x daily" /></label>
      <div className="field-row">
        <label>Pills left<input type="number" min="0" value={form.pillsLeft} onChange={(e) => update({ pillsLeft: Number(e.target.value) })} /></label>
        <label>Refill at<input type="number" min="0" value={form.refillThreshold} onChange={(e) => update({ refillThreshold: Number(e.target.value) })} /></label>
      </div>
      <div className="modal-actions">
        {onDelete && <button type="button" className="btn btn-danger" onClick={onDelete}><Trash2 size={15} /></button>}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

function AppointmentsPage() {
  const { appointments, addAppointment, updateAppointment, removeAppointment, loading } = useData();
  const [modal, setModal] = useState(null);
  const now = new Date();

  const upcomingThisMonth = appointments.filter((a) => {
    const d = new Date(`${a.date}T00:00:00`);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && d >= new Date(now.toDateString());
  }).length;

  const sorted = [...appointments].sort((a, b) => a.date.localeCompare(b.date));

  if (loading) return <div className="full-loader">Loading appointments…</div>;

  return (
    <div className="page">
      <h1 className="page-title">Appointments</h1>
      <div className="banner-card">{upcomingThisMonth} upcoming this month</div>

      {sorted.length === 0 ? (
        <EmptyState title="No appointments yet" />
      ) : (
        <div className="row-list">
          {sorted.map((a, i) => (
            <button type="button" key={a.id} className={`item-row as-button border-${i % 2 === 0 ? 'violet' : 'green'}`} onClick={() => setModal({ ...a })}>
              <div className="item-row-body">
                <strong>{a.doctorName}{a.specialty ? ` \u2022 ${a.specialty}` : ''}</strong>
                <span>{formatDatePretty(a.date)}, {a.time}</span>
                <span>{a.location}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Fab onClick={() => setModal({ doctorName: '', specialty: '', date: todayStr(), time: '10:00 AM', location: '' })} />

      {modal && (
        <ModalSheet title={modal.id ? 'Edit Appointment' : 'New Appointment'} onClose={() => setModal(null)}>
          <AppointmentForm
            value={modal}
            onCancel={() => setModal(null)}
            onDelete={modal.id ? async () => { await removeAppointment(modal.id); setModal(null); } : null}
            onSave={async (data) => {
              if (modal.id) await updateAppointment(modal.id, data);
              else await addAppointment(data);
              setModal(null);
            }}
          />
        </ModalSheet>
      )}
    </div>
  );
}

function AppointmentForm({ value, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="modal-form">
      <label>Doctor / Title<input value={form.doctorName} onChange={(e) => update({ doctorName: e.target.value })} placeholder="e.g. Dr. Adeyemi" required /></label>
      <label>Specialty (optional)<input value={form.specialty} onChange={(e) => update({ specialty: e.target.value })} placeholder="e.g. Cardiology" /></label>
      <div className="field-row">
        <label>Date<input type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} required /></label>
        <label>Time<input value={form.time} onChange={(e) => update({ time: e.target.value })} placeholder="10:00 AM" required /></label>
      </div>
      <label>Location<input value={form.location} onChange={(e) => update({ location: e.target.value })} placeholder="e.g. City Clinic, Lagos" /></label>
      <div className="modal-actions">
        {onDelete && <button type="button" className="btn btn-danger" onClick={onDelete}><Trash2 size={15} /></button>}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Checkups
// ---------------------------------------------------------------------------

function CheckupsPage() {
  const { checkups, addCheckup, updateCheckup, removeCheckup, loading } = useData();
  const [modal, setModal] = useState(null);

  if (loading) return <div className="full-loader">Loading checkups…</div>;

  return (
    <div className="page">
      <h1 className="page-title">Checkups</h1>
      {checkups.length === 0 ? (
        <EmptyState title="No checkups yet" />
      ) : (
        <div className="row-list">
          {checkups.map((c) => {
            const status = checkupStatus(c.nextDue);
            return (
              <button type="button" key={c.id} className="item-row as-button" onClick={() => setModal({ ...c })}>
                <Badge text="Ck" tint="orange" shape="square" />
                <div className="item-row-body">
                  <strong>{c.name}</strong>
                  <span>Next due: {monthYearLabel(c.nextDue)}</span>
                </div>
                <span className={`pill pill-${status.tone}`}>{status.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <Fab onClick={() => setModal({ name: '', nextDue: todayStr().slice(0, 7) })} />

      {modal && (
        <ModalSheet title={modal.id ? 'Edit Checkup' : 'New Checkup'} onClose={() => setModal(null)}>
          <form
            className="modal-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (modal.id) await updateCheckup(modal.id, modal);
              else await addCheckup(modal);
              setModal(null);
            }}
          >
            <label>Name<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="e.g. Eye Exam" required /></label>
            <label>Next due<input type="month" value={modal.nextDue} onChange={(e) => setModal({ ...modal, nextDue: e.target.value })} required /></label>
            <div className="modal-actions">
              {modal.id && <button type="button" className="btn btn-danger" onClick={async () => { await removeCheckup(modal.id); setModal(null); }}><Trash2 size={15} /></button>}
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        </ModalSheet>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------

function VitalsPage() {
  const { vitals, addVital, removeVital, loading } = useData();
  const [modal, setModal] = useState(null);
  const types = ['BP', 'HR', 'Weight', 'Temperature'];

  const latestFor = (type) => [...vitals].filter((v) => v.type === type).sort((a, b) => b.date.localeCompare(a.date))[0];
  const recent = [...vitals].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  if (loading) return <div className="full-loader">Loading vitals…</div>;

  return (
    <div className="page">
      <h1 className="page-title">Vitals</h1>
      <div className="vitals-grid">
        {types.map((t) => {
          const latest = latestFor(t);
          return (
            <div className="vital-card" key={t}>
              <Badge text={t === 'Weight' ? 'Wt' : t === 'Temperature' ? 'Tp' : t} tint={vitalColor(t)} />
              <span className="vital-label">{vitalLabel(t)}</span>
              <strong className="vital-value">{latest ? `${latest.value} ${vitalUnit(t)}` : '—'}</strong>
            </div>
          );
        })}
      </div>

      <h2 className="section-title">Recent Readings</h2>
      {recent.length === 0 ? (
        <EmptyState title="No readings yet" />
      ) : (
        <div className="row-list">
          {recent.map((v) => (
            <button type="button" key={v.id} className="item-row as-button" onClick={() => setModal({ id: v.id })}>
              <Badge text={v.type === 'Weight' ? 'Wt' : v.type === 'Temperature' ? 'Tp' : v.type} tint={vitalColor(v.type)} />
              <div className="item-row-body">
                <strong>{vitalLabel(v.type)}</strong>
                <span>{formatDatePretty(v.date)}</span>
              </div>
              <strong>{v.value} {v.unit}</strong>
            </button>
          ))}
        </div>
      )}

      <Fab onClick={() => setModal({ type: 'BP', value: '', date: todayStr() })} />

      {modal && (
        <ModalSheet title="Reading" onClose={() => setModal(null)}>
          {modal.id ? (
            <div className="modal-form">
              <p>Delete this reading?</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={async () => { await removeVital(modal.id); setModal(null); }}>Delete</button>
              </div>
            </div>
          ) : (
            <form
              className="modal-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await addVital({ ...modal, unit: vitalUnit(modal.type) });
                setModal(null);
              }}
            >
              <label>
                Type
                <select value={modal.type} onChange={(e) => setModal({ ...modal, type: e.target.value })}>
                  {types.map((t) => <option key={t} value={t}>{vitalLabel(t)}</option>)}
                </select>
              </label>
              <label>Value<input value={modal.value} onChange={(e) => setModal({ ...modal, value: e.target.value })} placeholder="e.g. 120/80" required /></label>
              <label>Date<input type="date" value={modal.date} onChange={(e) => setModal({ ...modal, date: e.target.value })} required /></label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          )}
        </ModalSheet>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

function ProgressPage() {
  const { routines, logs, loading } = useData();

  const completed = logs.filter((l) => l.status === 'completed').length;
  const missed = logs.filter((l) => l.status === 'missed').length;
  const total = completed + missed;
  const adherence = total ? Math.round((completed / total) * 100) : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const weekRates = weekDays.map((d) => {
    const dayLogs = logs.filter((l) => l.date === d);
    if (dayLogs.length === 0) return 0;
    return dayLogs.filter((l) => l.status === 'completed').length / dayLogs.length;
  });

  const byType = ROUTINE_TYPES.map((type) => {
    const ids = new Set(routines.filter((r) => r.type === type).map((r) => r.id));
    const typeLogs = logs.filter((l) => ids.has(l.routineId));
    const c = typeLogs.filter((l) => l.status === 'completed').length;
    return { type, rate: typeLogs.length ? Math.round((c / typeLogs.length) * 100) : null };
  }).filter((t) => t.rate !== null);

  if (loading) return <div className="full-loader">Loading progress…</div>;

  const r = 52, circumference = 2 * Math.PI * r;

  return (
    <div className="page">
      <h1 className="page-title">Progress</h1>
      <div className="adherence-card">
        <span>Adherence (30 days)</span>
        <div className="donut-wrap">
          <svg viewBox="0 0 120 120" className="donut">
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="14" />
            <circle
              cx="60" cy="60" r={r} fill="none" stroke="#34D399" strokeWidth="14"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - adherence / 100)}
              strokeLinecap="round" transform="rotate(-90 60 60)"
            />
          </svg>
          <strong className="donut-label">{adherence}%</strong>
        </div>
      </div>

      <h2 className="section-title">Weekly Trends</h2>
      <div className="bar-card">
        {weekRates.map((rate, i) => (
          <div className="bar-col" key={i}>
            <div className={`bar ${rate >= 0.7 ? 'tint-green' : 'tint-violet'}`} style={{ height: `${Math.max(rate * 100, 6)}%` }} />
            <span>{WEEKDAY_FULL[(i + 1) % 7].slice(0, 1)}</span>
          </div>
        ))}
      </div>

      <h2 className="section-title">By Routine Type</h2>
      {byType.length === 0 ? (
        <EmptyState title="No history yet" />
      ) : (
        <div className="row-list">
          {byType.map((t) => (
            <div className="type-bar-row" key={t.type}>
              <span>{t.type}</span>
              <div className="type-bar-track"><div className={`type-bar-fill tint-${calendarColor(t.type)}`} style={{ width: `${t.rate}%` }} /></div>
              <span>{t.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsPage() {
  const { user, logout, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [reminderPref, setReminderPref] = useState(() => localStorage.getItem('healthtrack.reminderPref') !== 'off');
  const [emailPref, setEmailPref] = useState(() => localStorage.getItem('healthtrack.emailPref') !== 'off');

  const setPref = (key, setter) => (val) => {
    setter(val);
    localStorage.setItem(key, val ? 'on' : 'off');
  };

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <button type="button" className="profile-card as-button" onClick={() => setEditOpen(true)}>
        <span className="avatar">{initials(user?.name)}</span>
        <div>
          <strong>{user?.name}</strong>
          <p>{user?.email}</p>
        </div>
      </button>

      <h3 className="settings-heading">Account</h3>
      <button type="button" className="settings-row-btn" onClick={() => setEditOpen(true)}>Edit Profile</button>
      <button type="button" className="settings-row-btn" onClick={() => navigate('/reset-password')}>Change password</button>

      <h3 className="settings-heading">Notifications</h3>
      <div className="settings-row-btn switch-row">
        <span>Reminder Preference</span>
        <Toggle checked={reminderPref} onChange={setPref('healthtrack.reminderPref', setReminderPref)} />
      </div>
      <div className="settings-row-btn switch-row">
        <span>Email Notifications</span>
        <Toggle checked={emailPref} onChange={setPref('healthtrack.emailPref', setEmailPref)} />
      </div>

      <h3 className="settings-heading">Preferences</h3>
      <div className="settings-row-btn switch-row">
        <span>Dark mode</span>
        <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
      </div>

      <button type="button" className="btn btn-danger btn-block settings-logout" onClick={() => { logout(); navigate('/login'); }}>
        Log Out
      </button>

      {editOpen && (
        <ModalSheet title="Edit Profile" onClose={() => setEditOpen(false)}>
          <EditProfileForm user={user} onCancel={() => setEditOpen(false)} onSave={(patch) => { updateProfile(patch); setEditOpen(false); }} />
        </ModalSheet>
      )}
    </div>
  );
}

function EditProfileForm({ user, onSave, onCancel }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  return (
    <form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSave({ name, email }); }}>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <Routes>
              <Route path="/" element={<OnboardingPage />} />
              <Route path="/login" element={<WelcomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/check-email" element={<CheckEmailPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route path="/app" element={<ProtectedRoute><AppShell><DashboardPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/routines" element={<ProtectedRoute><AppShell><RoutinesPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/routines/new" element={<ProtectedRoute><RoutineFormPage /></ProtectedRoute>} />
              <Route path="/app/routines/:id/edit" element={<ProtectedRoute><RoutineFormPage /></ProtectedRoute>} />
              <Route path="/app/calendar" element={<ProtectedRoute><AppShell><CalendarPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/medications" element={<ProtectedRoute><AppShell><MedicationsPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/appointments" element={<ProtectedRoute><AppShell><AppointmentsPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/checkups" element={<ProtectedRoute><AppShell><CheckupsPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/vitals" element={<ProtectedRoute><AppShell><VitalsPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/progress" element={<ProtectedRoute><AppShell><ProgressPage /></AppShell></ProtectedRoute>} />
              <Route path="/app/settings" element={<ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}