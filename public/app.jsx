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

  submitFeedback(message) {
    return this.request("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message })
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

function LoginScreen({ onLogin, loading, error }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");

  return (
    <div className="login-page">
      <div className="login-card glass">
        <span className="brand-tag">DevOps Attendance Tracker</span>
        <h1 className="login-title">A smarter dashboard for attendance, assessments, and delivery momentum.</h1>
        <p className="login-copy">
          Sign in to view attendance predictions, task deadlines, performance analytics, and DevOps progress guidance.
        </p>

        <div className="form-grid">
          <label className="field-label">
            Username
            <input className="field-input" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="field-label">
            Password
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="btn btn-primary" onClick={() => onLogin({ username, password })} disabled={loading}>
            {loading ? "Signing in..." : "Open Tracker"}
          </button>
          {error ? <div className="inline-alert error">{error}</div> : null}
          <p className="subtle">Demo credentials are prefilled so you can explore quickly.</p>
        </div>
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
      <button className="btn btn-secondary bell-btn" onClick={onToggle}>
        <span>Bell</span>
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
          <input
            className="field-input"
            type="number"
            min="60"
            max="100"
            value={attendanceTarget}
            onChange={(event) => setAttendanceTarget(event.target.value)}
          />
        </label>
        <label className="field-label">
          Assessment goal
          <input
            className="field-input"
            type="number"
            min="35"
            max="100"
            value={marksTarget}
            onChange={(event) => setMarksTarget(event.target.value)}
          />
        </label>
      </div>
      <div className="goal-stack">
        <ProgressBar label="Attendance" current={overview.attendancePercentage} target={goals.attendanceTarget} />
        <ProgressBar label="Predicted assessment" current={overview.predictedMarks} target={goals.marksTarget} />
      </div>
      <button
        className="btn btn-primary"
        onClick={() => onSave({ attendanceTarget, marksTarget })}
      >
        Save Goals
      </button>
    </div>
  );
}

function TrendCharts({ trends }) {
  const attendanceRef = useRef(null);
  const marksRef = useRef(null);

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

  const marksData = useMemo(() => ({
    labels: trends.monthlyMarks.map((item) => item.label),
    datasets: [
      {
        label: "Assessment",
        data: trends.monthlyMarks.map((item) => item.marks),
        backgroundColor: ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444"]
      }
    ]
  }), [trends]);

  useChart(attendanceRef, "line", attendanceData, sharedOptions);
  useChart(marksRef, "bar", marksData, sharedOptions);

  return (
    <div className="chart-grid">
      <div className="chart-card glass">
        <div className="section-header compact">
          <h2 className="section-title">Weekly attendance trend</h2>
          <span className="subtle">Rolling session consistency</span>
        </div>
        <div className="chart-box"><canvas ref={attendanceRef} /></div>
      </div>
      <div className="chart-card glass">
        <div className="section-header compact">
          <h2 className="section-title">Monthly assessment trend</h2>
          <span className="subtle">Performance movement over time</span>
        </div>
        <div className="chart-box"><canvas ref={marksRef} /></div>
      </div>
    </div>
  );
}

function SubjectAnalytics({ subjects, analytics }) {
  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Performance Analytics</span>
          <h2 className="section-title">Module-wise breakdown</h2>
        </div>
      </div>
      <div className="subject-grid">
        {subjects.map((subject) => {
          const attendancePct = Math.round((subject.attendance.attended / subject.attendance.total) * 100);
          return (
            <div key={subject.id} className="subject-card">
              <div className="subject-head">
                <div>
                  <strong>{subject.name}</strong>
                  <div className="subtle">Mentor: {subject.faculty}</div>
                </div>
                <span className={`status-pill ${attendancePct < 75 ? "danger" : "good"}`}>{attendancePct}%</span>
              </div>
              <div className="subject-metrics">
                <span>Mid: {subject.marks.mid}%</span>
                <span>Lab: {subject.marks.internal}%</span>
                <span>Tasks: {subject.marks.assignmentAverage}%</span>
                <span>Batch avg: {subject.marks.classAverage}%</span>
              </div>
              <p className="subtle">{subject.feedback}</p>
            </div>
          );
        })}
      </div>
      <div className="compare-grid">
        <div>
          <strong>Strengths</strong>
          {analytics.subjectInsights.strengths.map((item) => <p key={item.subjectId} className="subtle">{item.name}: {item.reason}</p>)}
        </div>
        <div>
          <strong>Focus areas</strong>
          {analytics.subjectInsights.weaknesses.map((item) => <p key={item.subjectId} className="subtle">{item.name}: {item.reason}</p>)}
        </div>
      </div>
    </div>
  );
}

function AssignmentBoard({ assignments, subjects, onUpload }) {
  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  );

  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Tasks</span>
          <h2 className="section-title">Submission tracker</h2>
        </div>
      </div>
      <div className="assignment-list">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="assignment-card">
            <div className="assignment-top">
              <div>
                <strong>{assignment.title}</strong>
                <div className="subtle">{subjectMap[assignment.subjectId]}</div>
              </div>
              <span className={`status-pill ${assignment.status === "submitted" ? "good" : "warn"}`}>
                {assignment.status}
              </span>
            </div>
            <div className="assignment-meta">
              <span>Due {formatDateTime(assignment.dueDate)}</span>
              <span>{assignment.late ? "Late submission" : "On time"}</span>
              <span>{assignment.fileName || "No file uploaded yet"}</span>
            </div>
            <p className="subtle">Reviewer: {assignment.instructorComment}</p>
            <p className="subtle">Feedback: {assignment.feedback}</p>
            {assignment.status === "pending" ? (
              <button
                className="btn btn-secondary"
                onClick={() => onUpload(assignment.id, assignment.title)}
              >
                Upload Submission
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarPanel({ events }) {
  const days = useMemo(() => getCalendarMatrix(events), [events]);
  const monthTitle = events[0]?.date
    ? new Date(events[0].date).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "Calendar";

  return (
    <div className="section-card glass">
      <div className="calendar-toolbar">
        <div>
          <span className="mini-chip">Schedule</span>
          <h2 className="section-title">{monthTitle}</h2>
        </div>
        <div className="subtle">Google Calendar sync: design ready</div>
      </div>
      <div className="weekday-row">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="weekday">{day}</div>)}
      </div>
      <div className="calendar-days">
        {days.map((day) => (
          <div key={day.iso} className={`calendar-day ${day.currentMonth ? "" : "other-month"}`}>
            <div className="day-number">{day.day}</div>
            {day.events.map((event) => (
              <div key={event.id} className={`event-pill ${event.type}`}>
                {event.title}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackCard({ suggestions, onSubmit }) {
  const [message, setMessage] = useState("");

  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Feedback</span>
          <h2 className="section-title">Suggestion box</h2>
        </div>
      </div>
      <textarea
        className="field-input textarea"
        rows="4"
        placeholder="Share a suggestion for the bootcamp or tracker..."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <button
        className="btn btn-primary"
        onClick={() => {
          if (!message.trim()) {
            return;
          }
          onSubmit(message);
          setMessage("");
        }}
      >
        Send Suggestion
      </button>
      <div className="feedback-list">
        {suggestions.map((item) => (
          <div key={item.id} className="feedback-item">
            <strong>{formatDateTime(item.createdAt)}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamificationCard({ analytics }) {
  return (
    <div className="section-card glass">
      <div className="section-header compact">
        <div>
          <span className="mini-chip">Gamification</span>
          <h2 className="section-title">Badges and streaks</h2>
        </div>
      </div>
      <div className="badge-grid">
        {analytics.badges.map((badge) => (
          <div key={badge.id} className="badge-card">
            <strong>{badge.label}</strong>
            <p>{badge.detail}</p>
          </div>
        ))}
      </div>
      <div className="streak-card">
        <span className="metric-label">Current attendance streak</span>
        <strong>{analytics.streak} days</strong>
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
            <button key={prompt} className="btn btn-secondary prompt-btn" onClick={() => { setQuestion(prompt); onAsk(prompt); }}>
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ dashboard, theme, setTheme, onLogout, onGoalSave, onFeedbackSubmit, onAssignmentUpload, onAskAssistant, assistantState }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className="topbar glass">
        <div className="brand-block">
          <div className="brand-line">
            <span className="brand-tag">DevOps Attendance Tracker</span>
            <span className="version-chip">Responsive | Predictive | Minimal</span>
          </div>
          <h1 className="page-title">Welcome back, {dashboard.profile.name.split(" ")[0]}</h1>
          <p className="subtle">
            {dashboard.profile.track} | {dashboard.profile.cohort} | Mentor {dashboard.profile.mentor}
          </p>
        </div>
        <div className="toolbar-actions">
          <NotificationBell items={dashboard.notifications} open={notificationsOpen} onToggle={() => setNotificationsOpen((value) => !value)} />
          <button className="btn btn-secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="hero glass">
        <div className="hero-copy">
          <span className="mini-chip">Today at a glance</span>
          <h2 className="section-title">Stay ahead with alerts, predictions, goals, and delivery guidance.</h2>
          <p className="subtle">
            This tracker combines attendance health, DevOps task progress, assessment forecasts, schedule planning, and mentor signals in one clean workspace.
          </p>
          <div className="quick-actions">
            <button className="btn btn-primary">View training plan</button>
            <button className="btn btn-secondary">Sync calendar design</button>
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
          <SubjectAnalytics subjects={dashboard.subjects} analytics={dashboard.analytics} />
          <AssignmentBoard assignments={dashboard.assignments} subjects={dashboard.subjects} onUpload={onAssignmentUpload} />
          <FeedbackCard suggestions={dashboard.suggestions} onSubmit={onFeedbackSubmit} />
        </div>
        <div className="stack-grid">
          <TrendCharts trends={dashboard.trends} />
          <CalendarPanel events={dashboard.calendar} />
          <GamificationCard analytics={dashboard.analytics} />
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

  const syncDashboardState = (nextDashboard) => {
    setDashboard(nextDashboard);
  };

  const handleGoalSave = async (payload) => {
    const result = await api.updateGoals(payload);
    syncDashboardState(result.dashboard);
  };

  const handleFeedbackSubmit = async (message) => {
    const result = await api.submitFeedback(message);
    syncDashboardState(result.dashboard);
  };

  const handleAssignmentUpload = async (assignmentId, title) => {
    const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    const result = await api.uploadAssignment(assignmentId, {
      fileName,
      fileSizeKb: Math.floor(Math.random() * 800) + 200
    });
    syncDashboardState(result.dashboard);
  };

  const handleAssistantAsk = async (question) => {
    const result = await api.askAssistant(question);
    setAssistantState(result);
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
    return <LoginScreen onLogin={handleLogin} loading={loading} error={error} />;
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
      onFeedbackSubmit={handleFeedbackSubmit}
      onAssignmentUpload={handleAssignmentUpload}
      onAskAssistant={handleAssistantAsk}
      assistantState={assistantState}
    />
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
