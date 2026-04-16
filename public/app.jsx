const { useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEYS = {
  session: "attendance-session",
  theme: "attendance-theme"
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
  getSession() {
    return this.request("/api/session");
  },
  getAttendance() {
    return this.request("/api/attendance");
  },
  createAttendance(status) {
    return this.request("/api/attendance", {
      method: "POST",
      body: JSON.stringify({ status })
    });
  },
  updateAttendance(id, payload) {
    return this.request(`/api/attendance/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteAttendance(id) {
    return this.request(`/api/attendance/${id}`, {
      method: "DELETE"
    });
  },
  getMeta() {
    return this.request("/api/meta");
  }
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toInputDateTime(dateString) {
  const date = new Date(dateString);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function getStats(records) {
  const present = records.filter((record) => record.status === "present").length;
  const absent = records.filter((record) => record.status === "absent").length;
  const total = present + absent;
  const percentage = total ? Math.round((present / total) * 100) : 0;
  return { present, absent, total, percentage };
}

function exportCsv(records) {
  const lines = [
    ["Date", "Status", "Time"].join(","),
    ...records.map((record) =>
      [
        `"${formatDate(record.dateTime)}"`,
        record.status,
        `"${new Date(record.dateTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit"
        })}"`
      ].join(",")
    )
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(STORAGE_KEYS.theme) || "dark"
  );

  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

  return { theme, setTheme };
}

function NotificationStack({ notifications }) {
  return (
    <div className="toast-stack">
      {notifications.map((item) => (
        <div key={item.id} className={`toast ${item.type}`}>
          <div className="strong">{item.title}</div>
          <div>{item.message}</div>
        </div>
      ))}
    </div>
  );
}

function LoginPage({ onLogin, loading, error, theme, onToggleTheme }) {
  const [form, setForm] = useState({ username: "admin", password: "admin123" });

  return (
    <div className="login-page">
      <div className="login-card glass">
        <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="brand-tag">DevOps Attendance v1.0</span>
          <button className="btn btn-secondary" onClick={onToggleTheme}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
        <h1 className="login-title">Attendance Tracking Built Like a Product.</h1>
        <p className="login-copy">
          Sign in to manage attendance, track team consistency, and review reports with a
          modern DevOps dashboard.
        </p>
        <div className="form-grid">
          <label className="field-label">
            Username
            <input
              className="field-input"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="Enter username"
            />
          </label>
          <label className="field-label">
            Password
            <input
              className="field-input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Enter password"
            />
          </label>
          {error ? <div className="subtle" style={{ color: "var(--absent)" }}>{error}</div> : null}
          <button className="btn btn-primary" onClick={() => onLogin(form)} disabled={loading}>
            {loading ? "Signing In..." : "Login"}
          </button>
        </div>
        <p className="subtle">Demo credentials: admin / admin123 or engineer / devops123</p>
      </div>
    </div>
  );
}

function Navbar({ page, onNavigate, onLogout, theme, onToggleTheme, meta }) {
  const items = [
    { key: "home", label: "Home" },
    { key: "attendance", label: "Attendance" },
    { key: "reports", label: "Reports" }
  ];

  return (
    <div className="topbar glass">
      <div className="brand-block">
        <div className="brand-line">
          <span className="brand-name">DevOps Attendance Tracker</span>
          <span className="version-chip">{meta?.version || "v1.0"}</span>
        </div>
        <div className="subtle">
          Last updated: {meta?.lastUpdated ? formatDateTime(meta.lastUpdated) : "Loading..."}
        </div>
      </div>
      <div className="nav-links">
        {items.map((item) => (
          <button
            key={item.key}
            className={`btn nav-btn ${page === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
        <button className="btn btn-secondary" onClick={onToggleTheme}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button className="btn btn-secondary" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ stats }) {
  const cards = [
    { label: "Total Present Days", value: stats.present },
    { label: "Total Absent Days", value: stats.absent },
    { label: "Attendance Percentage", value: `${stats.percentage}%` }
  ];

  return (
    <div className="summary-grid">
      {cards.map((card) => (
        <div key={card.label} className="summary-card glass">
          <div className="summary-label">{card.label}</div>
          <div className="summary-value">{card.value}</div>
          <div className="summary-accent" />
        </div>
      ))}
    </div>
  );
}

function AttendanceActions({ onMark, busy }) {
  return (
    <div className="section-card glass">
      <div className="section-header">
        <div>
          <h2 className="section-title">Attendance Actions</h2>
          <div className="subtle">Mark your status for today. Duplicate entries are blocked.</div>
        </div>
      </div>
      <div className="quick-actions">
        <button className="btn btn-success" onClick={() => onMark("present")} disabled={busy}>
          Mark Present
        </button>
        <button className="btn btn-danger" onClick={() => onMark("absent")} disabled={busy}>
          Mark Absent
        </button>
      </div>
    </div>
  );
}

function Filters({ filters, onChange, onReset, onExport, resultCount }) {
  return (
    <div className="section-card glass filters-panel">
      <div className="section-header">
        <div>
          <h2 className="section-title">Search & Filter</h2>
          <div className="subtle">Search by exact date or narrow records by a date range.</div>
        </div>
        <span className="mini-chip">{resultCount} records</span>
      </div>
      <div className="filter-grid">
        <label className="field-label">
          Search Date
          <input
            className="field-input"
            type="date"
            value={filters.searchDate}
            onChange={(event) => onChange("searchDate", event.target.value)}
          />
        </label>
        <label className="field-label">
          From
          <input
            className="field-input"
            type="date"
            value={filters.from}
            onChange={(event) => onChange("from", event.target.value)}
          />
        </label>
        <label className="field-label">
          To
          <input
            className="field-input"
            type="date"
            value={filters.to}
            onChange={(event) => onChange("to", event.target.value)}
          />
        </label>
      </div>
      <div className="history-actions">
        <button className="btn btn-secondary" onClick={onReset}>
          Reset Filters
        </button>
        <button className="btn btn-primary" onClick={onExport}>
          Export CSV
        </button>
      </div>
    </div>
  );
}

function CalendarView({ records }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const recordMap = useMemo(() => {
    return records.reduce((acc, record) => {
      acc[record.date] = record;
      return acc;
    }, {});
  }, [records]);

  const monthMeta = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const leading = firstDay.getDay();
    const totalCells = Math.ceil((leading + lastDay.getDate()) / 7) * 7;
    const days = [];

    for (let index = 0; index < totalCells; index += 1) {
      const date = new Date(year, month, index - leading + 1);
      const iso = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
      )
        .toISOString()
        .split("T")[0];
      const record = recordMap[iso];
      days.push({
        iso,
        isCurrentMonth: date.getMonth() === month,
        dayNumber: date.getDate(),
        status: record?.status || ""
      });
    }

    return {
      label: firstDay.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      days
    };
  }, [monthCursor, recordMap]);

  return (
    <div className="section-card glass">
      <div className="calendar-toolbar">
        <div>
          <h2 className="section-title">Calendar View</h2>
          <div className="subtle">Green for present, red for absent.</div>
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-secondary"
            onClick={() =>
              setMonthCursor(
                new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1)
              )
            }
          >
            Prev
          </button>
          <span className="status-pill">{monthMeta.label}</span>
          <button
            className="btn btn-secondary"
            onClick={() =>
              setMonthCursor(
                new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)
              )
            }
          >
            Next
          </button>
        </div>
      </div>
      <div className="calendar-days">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
        {monthMeta.days.map((day) => (
          <div
            key={day.iso}
            className={`calendar-day ${day.isCurrentMonth ? "" : "other-month"} ${day.status}`}
          >
            <div className="day-number">{day.dayNumber}</div>
            <div className="day-status">{day.status ? day.status.toUpperCase() : "No entry"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Charts({ records, theme }) {
  const pieRef = useRef(null);
  const barRef = useRef(null);
  const chartsRef = useRef([]);

  useEffect(() => {
    const stats = getStats(records);
    const monthly = records.reduce((acc, record) => {
      const label = new Date(record.dateTime).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric"
      });
      if (!acc[label]) {
        acc[label] = { present: 0, absent: 0 };
      }
      acc[label][record.status] += 1;
      return acc;
    }, {});

    chartsRef.current.forEach((chart) => chart.destroy());
    chartsRef.current = [];

    if (pieRef.current) {
      chartsRef.current.push(
        new Chart(pieRef.current, {
          type: "pie",
          data: {
            labels: ["Present", "Absent"],
            datasets: [
              {
                data: [stats.present, stats.absent],
                backgroundColor: ["#16a34a", "#dc2626"],
                borderWidth: 0
              }
            ]
          },
          options: {
            plugins: {
              legend: {
                labels: { color: getComputedStyle(document.body).getPropertyValue("--text") }
              }
            }
          }
        })
      );
    }

    if (barRef.current) {
      const labels = Object.keys(monthly);
      chartsRef.current.push(
        new Chart(barRef.current, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Present",
                data: labels.map((label) => monthly[label].present),
                backgroundColor: "#16a34a"
              },
              {
                label: "Absent",
                data: labels.map((label) => monthly[label].absent),
                backgroundColor: "#dc2626"
              }
            ]
          },
          options: {
            responsive: true,
            scales: {
              x: {
                ticks: { color: getComputedStyle(document.body).getPropertyValue("--text") },
                grid: { color: "rgba(148, 163, 184, 0.12)" }
              },
              y: {
                ticks: { color: getComputedStyle(document.body).getPropertyValue("--text") },
                grid: { color: "rgba(148, 163, 184, 0.12)" }
              }
            },
            plugins: {
              legend: {
                labels: { color: getComputedStyle(document.body).getPropertyValue("--text") }
              }
            }
          }
        })
      );
    }

    return () => {
      chartsRef.current.forEach((chart) => chart.destroy());
      chartsRef.current = [];
    };
  }, [records, theme]);

  return (
    <div className="chart-grid">
      <div className="chart-card glass">
        <h2 className="section-title">Attendance Distribution</h2>
        <div className="subtle">Pie chart summary of all recorded days.</div>
        <div className="chart-wrap">
          <canvas ref={pieRef} height="240" />
        </div>
      </div>
      <div className="chart-card glass">
        <h2 className="section-title">Monthly Trend</h2>
        <div className="subtle">Bar chart view for present and absent counts by month.</div>
        <div className="chart-wrap">
          <canvas ref={barRef} height="240" />
        </div>
      </div>
    </div>
  );
}

function EditModal({ record, onClose, onSave, busy }) {
  const [form, setForm] = useState({
    status: record.status,
    dateTime: toInputDateTime(record.dateTime)
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-card glass">
        <h2 className="section-title">Edit Attendance</h2>
        <div className="form-grid">
          <label className="field-label">
            Status
            <select
              className="field-select"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </label>
          <label className="field-label">
            Date & Time
            <input
              className="field-input"
              type="datetime-local"
              value={form.dateTime}
              onChange={(event) => setForm({ ...form, dateTime: event.target.value })}
            />
          </label>
        </div>
        <div className="modal-actions" style={{ marginTop: "18px" }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ ...form, dateTime: new Date(form.dateTime).toISOString() })}
            disabled={busy}
          >
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceTable({ records, onEdit, onDelete }) {
  return (
    <div className="section-card glass history-table-wrap">
      <div className="section-header">
        <div>
          <h2 className="section-title">Attendance History</h2>
          <div className="subtle">Latest entries appear first.</div>
        </div>
      </div>
      {records.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.dateTime)}</td>
                <td>
                  <span className={`status-badge ${record.status}`}>{record.status}</span>
                </td>
                <td>
                  {new Date(record.dateTime).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </td>
                <td>
                  <div className="btn-row">
                    <button className="btn btn-secondary" onClick={() => onEdit(record)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => onDelete(record)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">No attendance records match the current filters.</div>
      )}
    </div>
  );
}

function Hero({ user, stats }) {
  return (
    <div className="hero glass">
      <div className="hero-copy">
        <span className="brand-tag">Reliable Attendance Insights</span>
        <h1 className="page-title">Welcome back, {user.name}</h1>
        <div className="subtle">
          Role: <span className="strong">{user.role}</span>. Keep attendance logs current,
          review trends quickly, and export reports when needed.
        </div>
      </div>
      <div className="hero-stats">
        <div className="status-pill">Current Attendance Rate: {stats.percentage}%</div>
        <div className="subtle">
          Present on {stats.present} day(s) and absent on {stats.absent} day(s).
        </div>
      </div>
    </div>
  );
}

function ReportsPanel({ records }) {
  const recent = records[0];
  return (
    <div className="section-card glass">
      <h2 className="section-title">Report Highlights</h2>
      <div className="metrics-grid">
        <div className="subtle">
          Most recent attendance entry:{" "}
          <span className="strong">
            {recent ? `${formatDateTime(recent.dateTime)} (${recent.status})` : "No records yet"}
          </span>
        </div>
        <div className="subtle">
          Export the full history as CSV to share quick updates with your team or manager.
        </div>
      </div>
    </div>
  );
}

function App() {
  const { theme, setTheme } = useTheme();
  const [session, setSession] = useState(() => loadSession());
  const [page, setPage] = useState("home");
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ searchDate: "", from: "", to: "" });
  const [notifications, setNotifications] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);

  const pushNotification = (type, title, message) => {
    const item = { id: crypto.randomUUID(), type, title, message };
    setNotifications((current) => [...current, item]);
    window.setTimeout(() => {
      setNotifications((current) => current.filter((entry) => entry.id !== item.id));
    }, 3200);
  };

  const loadData = async () => {
    const [attendanceRes, metaRes] = await Promise.all([api.getAttendance(), api.getMeta()]);
    setRecords(attendanceRes.records);
    setMeta(metaRes);
  };

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    api
      .getSession()
      .then((data) => {
        setSession((current) => ({ ...current, user: data.user }));
        return loadData();
      })
      .catch(() => {
        clearSession();
        setSession(null);
      });
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const date = record.date;
      if (filters.searchDate && date !== filters.searchDate) {
        return false;
      }
      if (filters.from && date < filters.from) {
        return false;
      }
      if (filters.to && date > filters.to) {
        return false;
      }
      return true;
    });
  }, [records, filters]);

  const stats = useMemo(() => getStats(records), [records]);

  const handleLogin = async (credentials) => {
    setBusy(true);
    setError("");
    try {
      const response = await api.login(credentials);
      const nextSession = { token: response.token, user: response.user };
      saveSession(nextSession);
      setSession(nextSession);
      await loadData();
      pushNotification("success", "Login Successful", `Welcome, ${response.user.name}`);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (logoutError) {
      // Ignore logout network issues and still clear local session.
    }
    clearSession();
    setSession(null);
    setRecords([]);
    setPage("home");
  };

  const handleMarkAttendance = async (status) => {
    setBusy(true);
    try {
      const response = await api.createAttendance(status);
      await loadData();
      pushNotification(
        "success",
        "Attendance Updated",
        `${response.record.status.toUpperCase()} marked for ${formatDate(response.record.dateTime)}`
      );
    } catch (actionError) {
      pushNotification("error", "Action Failed", actionError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateRecord = async (payload) => {
    if (!editingRecord) {
      return;
    }

    setBusy(true);
    try {
      await api.updateAttendance(editingRecord.id, payload);
      await loadData();
      setEditingRecord(null);
      pushNotification("info", "Record Updated", "Attendance entry updated successfully.");
    } catch (updateError) {
      pushNotification("error", "Update Failed", updateError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRecord = async (record) => {
    const confirmed = window.confirm(`Delete attendance for ${formatDate(record.dateTime)}?`);
    if (!confirmed) {
      return;
    }

    setBusy(true);
    try {
      await api.deleteAttendance(record.id);
      await loadData();
      pushNotification("info", "Record Deleted", "Attendance entry removed.");
    } catch (deleteError) {
      pushNotification("error", "Delete Failed", deleteError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session?.token) {
    return (
      <>
        <LoginPage
          onLogin={handleLogin}
          loading={busy}
          error={error}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
        <NotificationStack notifications={notifications} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Navbar
        page={page}
        onNavigate={setPage}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        meta={meta}
      />

      <div className="layout-grid">
        <Hero user={session.user} stats={stats} />
        <SummaryCards stats={stats} />

        {(page === "home" || page === "attendance") && (
          <div className="page-grid">
            <div className="layout-grid">
              <AttendanceActions onMark={handleMarkAttendance} busy={busy} />
              <Filters
                filters={filters}
                onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
                onReset={() => setFilters({ searchDate: "", from: "", to: "" })}
                onExport={() => exportCsv(filteredRecords)}
                resultCount={filteredRecords.length}
              />
              <AttendanceTable
                records={filteredRecords}
                onEdit={setEditingRecord}
                onDelete={handleDeleteRecord}
              />
            </div>
            <CalendarView records={records} />
          </div>
        )}

        {(page === "home" || page === "reports") && (
          <>
            <Charts records={records} theme={theme} />
            <ReportsPanel records={records} />
          </>
        )}
      </div>

      <div className="footer-bar glass">
        <div>
          <div className="strong">Release {meta?.version || "v1.0"}</div>
          <div className="subtle">Designed as a modular DevOps-style internal product.</div>
        </div>
        <div className="subtle">
          Session user: <span className="strong">{session.user.username}</span>
        </div>
      </div>

      {editingRecord ? (
        <EditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={handleUpdateRecord}
          busy={busy}
        />
      ) : null}

      <NotificationStack notifications={notifications} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
