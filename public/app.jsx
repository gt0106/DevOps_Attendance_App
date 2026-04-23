const { useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEYS = {
  session: "student-dashboard-session",
  theme: "student-dashboard-theme"
};

const api = {
  async request(path, options = {}) {
    const session = loadSession();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong");
    }

    return data;
  },

  login(credentials) {
    return this.request("/api/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
  },

  register(payload) {
    return this.request("/api/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  logout() {
    return this.request("/api/logout", { method: "POST" });
  },

  getDashboard() {
    return this.request("/api/dashboard");
  },

  updateGoals(payload) {
    return this.request("/api/goals", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },

  markAttendance(status) {
    return this.request("/api/attendance/mark", {
      method: "POST",
      body: JSON.stringify({ status })
    });
  },

  uploadAssignment(id, payload) {
    return this.request(`/api/assignments/${id}/upload`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  askAssistant(question) {
    return this.request("/api/assistant/query", {
      method: "POST",
      body: JSON.stringify({ question })
    });
  }
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function loadTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || "light";
}

function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function progressValue(current, target) {
  if (!target) {
    return 0;
  }
  return Math.min(100, Math.round((current / target) * 100));
}

function getCalendarMatrix(events) {
  const reference = events[0]?.date ? new Date(events[0].date) : new Date();
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      iso,
      day: date.getDate(),
      currentMonth: date.getMonth() === month,
      events: events.filter((event) => event.date === iso)
    };
  });
}

function useChart(canvasRef, type, data, options) {
  useEffect(() => {
    if (!canvasRef.current || !data) {
      return undefined;
    }

    const chart = new Chart(canvasRef.current, {
      type,
      data,
      options
    });

    return () => chart.destroy();
  }, [canvasRef, type, data, options]);
}

function NotificationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function LoginScreen({ onLogin, onRegister, loading, error }) {
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "admin@devops.local", password: "admin123" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "", enrollmentNo: "" });
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    setMessage("");
    const result = await onRegister(registerForm);
    if (result?.message) {
      setMessage(result.message);
      setMode("login");
      setLoginForm({ email: registerForm.email, password: registerForm.password });
      setRegisterForm({ email: "", password: "", enrollmentNo: "" });
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass">
        <span className="brand-tag">DevOps Attendance Tracker</span>
        <h1 className="login-title">Track attendance, deadlines, and assessment progress with a cleaner DevOps-focused dashboard.</h1>
        <p className="login-copy">
          Sign in with your email to view alerts, progress, important notes, and upcoming DevOps sessions.
        </p>

        <div className="btn-row">
          <button className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("login")}>Login</button>
          <button className={`btn ${mode === "register" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("register")}>Register</button>
        </div>

        {mode === "login" ? (
          <div className="form-grid">
            <label className="field-label">
              Email ID
              <input className="field-input" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
            </label>
            <label className="field-label">
              Password
              <input className="field-input" type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
            </label>
            <button className="btn btn-primary" onClick={() => onLogin(loginForm)} disabled={loading}>
              {loading ? "Signing in..." : "Open Tracker"}
            </button>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field-label">
              Enrollment No
              <input className="field-input" value={registerForm.enrollmentNo} onChange={(event) => setRegisterForm({ ...registerForm, enrollmentNo: event.target.value })} />
            </label>
            <label className="field-label">
              Email ID
              <input className="field-input" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} />
            </label>
            <label className="field-label">
              Password
              <input className="field-input" type="password" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} />
            </label>
            <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </div>
        )}

        {error ? <div className="inline-alert error">{error}</div> : null}
        {message ? <div className="inline-alert">{message}</div> : null}
        <p className="subtle">Demo login: `admin@devops.local` / `admin123`</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, tone = "default" }) {
  return (
    <div className={`summary-card glass ${tone}`}>
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
      <div className="subtle">{detail}</div>
      <div className="summary-accent" />
    </div>
  );
}

function ProgressBar({ label, current, target, suffix = "%" }) {
  const percent = progressValue(current, target);

  return (
    <div className="goal-item">
      <div className="goal-meta">
        <strong>{label}</strong>
        <span>{current}{suffix} / {target}{suffix}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function NotificationBell({ items, open, onToggle }) {
  return (
    <div className="notification-wrap">
      <button className="btn btn-secondary bell-btn" onClick={onToggle} aria-label="Open notifications">
        <span className="bell-icon-shell">
          <NotificationIcon />
        </span>
        <span className="bell-copy">
          <strong>Alerts</strong>
          <small>{items.length ? `${items.length} new updates` : "All clear"}</small>
        </span>
        <span className="notification-count">{items.length}</span>
      </button>
      {open ? (
        <div className="notification-dropdown glass">
          <div className="section-header compact">
            <h3 className="section-title">Notifications</h3>
            <span className="subtle">{items.length} active</span>
          </div>
          {items.length ? items.map((item) => (
            <div key={item.id} className={`notification-item ${item.severity}`}>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
            </div>
          )) : <p className="empty-state">No alerts right now.</p>}
        </div>
      ) : null}
    </div>
  );
}

function InsightPanel({ predictions, attendance, marks }) {
  return (
    <div className="section-card glass insight-panel">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Smart Insights</span>
          <h2 className="section-title">Predictions and early signals</h2>
        </div>
      </div>
      <div className="insight-list">
        <div className={`insight-pill ${predictions.attendanceRisk}`}>
          <strong>Attendance risk</strong>
          <span>{predictions.attendanceMessage}</span>
        </div>
        <div className="insight-pill neutral">
          <strong>Assessment forecast</strong>
          <span>{predictions.marksMessage}</span>
        </div>
        <div className="metrics-grid two-up">
          <div className="metric-tile">
            <span className="metric-label">Safe to skip</span>
            <strong>{attendance.safeToMiss} sessions</strong>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Predicted score</span>
            <strong>{marks.overallPredicted}%</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goals, overview, onSave }) {
  const [attendanceTarget, setAttendanceTarget] = useState(goals.attendanceTarget);
  const [marksTarget, setMarksTarget] = useState(goals.marksTarget);

  useEffect(() => {
    setAttendanceTarget(goals.attendanceTarget);
    setMarksTarget(goals.marksTarget);
  }, [goals]);

  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Goals</span>
          <h2 className="section-title">Target tracking</h2>
        </div>
      </div>
      <div className="form-grid compact-grid">
        <label className="field-label">
          Attendance goal
          <input className="field-input" type="number" min="60" max="100" value={attendanceTarget} onChange={(event) => setAttendanceTarget(event.target.value)} />
        </label>
        <label className="field-label">
          Assessment goal
          <input className="field-input" type="number" min="35" max="100" value={marksTarget} onChange={(event) => setMarksTarget(event.target.value)} />
        </label>
      </div>
      <div className="goal-stack">
        <ProgressBar label="Attendance" current={overview.attendancePercentage} target={goals.attendanceTarget} />
        <ProgressBar label="Predicted assessment" current={overview.predictedMarks} target={goals.marksTarget} />
      </div>
      <button className="btn btn-primary" onClick={() => onSave({ attendanceTarget, marksTarget })}>Save Goals</button>
    </div>
  );
}

function AttendanceChart({ trends }) {
  const attendanceRef = useRef(null);

  const sharedOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: "rgba(148, 163, 184, 0.18)" }
      },
      x: {
        grid: { display: false }
      }
    }
  }), []);

  const attendanceData = useMemo(() => ({
    labels: trends.weeklyAttendance.map((item) => item.label),
    datasets: [
      {
        label: "Attendance",
        data: trends.weeklyAttendance.map((item) => item.attendance),
        borderColor: "#14b8a6",
        backgroundColor: "rgba(20, 184, 166, 0.18)",
        tension: 0.35,
        fill: true
      }
    ]
  }), [trends]);

  useChart(attendanceRef, "line", attendanceData, sharedOptions);

  return (
    <div className="chart-card glass">
      <div className="section-header compact">
        <h2 className="section-title">Weekly attendance trend</h2>
        <span className="subtle">Rolling session consistency</span>
      </div>
      <div className="chart-box"><canvas ref={attendanceRef} /></div>
    </div>
  );
}

function AssignmentBoard({ assignments, subjects, onUpload }) {
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])), [subjects]);

  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Tasks</span>
          <h2 className="section-title">Submission tracker</h2>
        </div>
      </div>
      <div className="assignment-list">
        {assignments.length ? assignments.map((assignment) => (
          <div key={assignment.id} className="assignment-card">
            <div className="assignment-top">
              <div>
                <strong>{assignment.title}</strong>
                <div className="subtle">{subjectMap[assignment.subjectId] || "DevOps Task"}</div>
              </div>
              <span className={`status-pill ${assignment.status === "submitted" ? "good" : "warn"}`}>{assignment.status}</span>
            </div>
            <div className="assignment-meta">
              <span>Due {formatDateTime(assignment.dueDate)}</span>
              <span>{assignment.late ? "Late submission" : "On time"}</span>
              <span>{assignment.fileName || "No file uploaded yet"}</span>
            </div>
            <p className="subtle">Reviewer: {assignment.instructorComment}</p>
            <p className="subtle">Feedback: {assignment.feedback}</p>
            {assignment.status === "pending" ? <button className="btn btn-secondary" onClick={() => onUpload(assignment.id, assignment.title)}>Upload Submission</button> : null}
          </div>
        )) : <p className="empty-state">No tasks available yet for this learner.</p>}
      </div>
    </div>
  );
}

function CalendarPanel({ events }) {
  const days = useMemo(() => getCalendarMatrix(events), [events]);
  const monthTitle = events[0]?.date ? new Date(events[0].date).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Current Schedule";

  return (
    <div className="section-card glass">
      <div className="calendar-toolbar">
        <div>
          <span className="mini-chip">Schedule</span>
          <h2 className="section-title">{monthTitle}</h2>
        </div>
      </div>
      <div className="weekday-row">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="weekday">{day}</div>)}
      </div>
      <div className="calendar-days">
        {days.map((day) => (
          <div key={day.iso} className={`calendar-day ${day.currentMonth ? "" : "other-month"}`}>
            <div className="day-number">{day.day}</div>
            {day.events.map((event) => <div key={event.id} className={`event-pill ${event.type}`}>{event.title}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesCard({ notes }) {
  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Notes</span>
          <h2 className="section-title">Important notes</h2>
        </div>
      </div>
      <div className="feedback-list">
        {notes.length ? notes.map((item) => (
          <div key={item.id} className="feedback-item">
            <strong>{formatDateTime(item.createdAt)}</strong>
            <p>{item.message}</p>
          </div>
        )) : <p className="empty-state">No important notes available yet.</p>}
      </div>
    </div>
  );
}

function AssistantCard({ onAsk, answerState }) {
  const [question, setQuestion] = useState("Can I skip sessions and still maintain 75%?");

  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">AI Assistant</span>
          <h2 className="section-title">DevOps helper</h2>
        </div>
      </div>
      <div className="assistant-panel">
        <input className="field-input" value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button className="btn btn-primary" onClick={() => onAsk(question)}>Ask</button>
        <div className="assistant-answer">
          <strong>Answer</strong>
          <p>{answerState.answer || "Ask about attendance, assessments, or task priorities."}</p>
        </div>
        <div className="prompt-row">
          {answerState.suggestedPrompts?.map((prompt) => (
            <button key={prompt} className="btn btn-secondary prompt-btn" onClick={() => { setQuestion(prompt); onAsk(prompt); }}>{prompt}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ dashboard, theme, setTheme, onLogout, onGoalSave, onAssignmentUpload, onAskAssistant, onMarkAttendance, assistantState }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className="topbar glass">
        <div className="brand-block">
          <h1 className="page-title">Welcome back</h1>
          <p className="subtle">Fundamentals of DevOps</p>
        </div>
        <div className="toolbar-actions">
          <NotificationBell items={dashboard.notifications} open={notificationsOpen} onToggle={() => setNotificationsOpen((value) => !value)} />
          <button className="btn btn-secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light Mode" : "Dark Mode"}</button>
          <button className="btn btn-danger" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="hero glass">
        <div className="hero-copy">
          <span className="mini-chip">Today at a glance</span>
          <h2 className="section-title">Stay ahead with alerts, predictions, attendance goals, and task tracking.</h2>
          <p className="subtle">This tracker combines attendance health, DevOps task progress, assessment forecasts, schedule planning, and important notes in one clean workspace.</p>
          <div className="quick-actions">
            <button className="btn btn-success" onClick={() => onMarkAttendance("present")}>Mark Present</button>
            <button className="btn btn-danger" onClick={() => onMarkAttendance("absent")}>Mark Absent</button>
            <button className="btn btn-primary">View training plan</button>
            <button className="btn btn-secondary">Check upcoming tasks</button>
          </div>
        </div>
        <InsightPanel predictions={dashboard.predictions} attendance={dashboard.attendance} marks={dashboard.marks} />
      </div>

      <div className="summary-grid">
        <StatCard label="Attendance progress" value={`${dashboard.overview.attendancePercentage}%`} detail={`${dashboard.overview.attendedDays} of ${dashboard.overview.totalDays} DevOps sessions attended`} />
        <StatCard label="Task submissions" value={`${dashboard.overview.assignmentsSubmitted}/${dashboard.overview.assignmentsSubmitted + dashboard.overview.pendingAssignments}`} detail={`${dashboard.overview.pendingAssignments} pending right now`} tone="accent" />
        <StatCard label="Predicted assessment score" value={`${dashboard.overview.predictedMarks}%`} detail="Based on current scores and trend signals" tone="success" />
      </div>

      <div className="page-grid">
        <div className="stack-grid">
          <GoalCard goals={dashboard.goals} overview={dashboard.overview} onSave={onGoalSave} />
          <AssignmentBoard assignments={dashboard.assignments} subjects={dashboard.subjects} onUpload={onAssignmentUpload} />
          <NotesCard notes={dashboard.suggestions} />
        </div>
        <div className="stack-grid">
          <AttendanceChart trends={dashboard.trends} />
          <CalendarPanel events={dashboard.calendar} />
          <AssistantCard onAsk={onAskAssistant} answerState={assistantState} />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(loadSession());
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setThemeState] = useState(loadTheme());
  const [assistantState, setAssistantState] = useState({ answer: "", suggestedPrompts: [] });

  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
    saveTheme(theme);
  }, [theme]);

  const setTheme = (nextTheme) => {
    setThemeState(nextTheme);
  };

  const loadDashboard = async () => {
    const data = await api.getDashboard();
    setDashboard(data);
  };

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    loadDashboard().catch((err) => {
      setError(err.message);
      clearSession();
      setSession(null);
    });
  }, [session]);

  const handleLogin = async (credentials) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.login(credentials);
      const nextSession = { token: result.token, user: result.user };
      saveSession(nextSession);
      setSession(nextSession);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (payload) => {
    setLoading(true);
    setError("");
    try {
      return await api.register(payload);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const syncDashboardState = (nextDashboard) => {
    setDashboard(nextDashboard);
  };

  const handleGoalSave = async (payload) => {
    const result = await api.updateGoals(payload);
    syncDashboardState(result.dashboard);
  };

  const handleAssignmentUpload = async (assignmentId, title) => {
    const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    const result = await api.uploadAssignment(assignmentId, { fileName, fileSizeKb: Math.floor(Math.random() * 800) + 200 });
    syncDashboardState(result.dashboard);
  };

  const handleAssistantAsk = async (question) => {
    const result = await api.askAssistant(question);
    setAssistantState(result);
  };

  const handleMarkAttendance = async (status) => {
    const result = await api.markAttendance(status);
    syncDashboardState(result.dashboard);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout failures for local demo flow.
    }
    clearSession();
    setSession(null);
    setDashboard(null);
  };

  if (!session?.token) {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} loading={loading} error={error} />;
  }

  if (!dashboard) {
    return (
      <div className="login-page">
        <div className="login-card glass">
          <h1 className="login-title">Loading tracker...</h1>
          <p className="subtle">We are preparing your analytics, notifications, and schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      dashboard={dashboard}
      theme={theme}
      setTheme={setTheme}
      onLogout={handleLogout}
      onGoalSave={handleGoalSave}
      onAssignmentUpload={handleAssignmentUpload}
      onAskAssistant={handleAssistantAsk}
      onMarkAttendance={handleMarkAttendance}
      assistantState={assistantState}
    />
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
