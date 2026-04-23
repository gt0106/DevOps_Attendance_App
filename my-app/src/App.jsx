import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";

const API = "http://localhost:5001";

export default function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [feedback, setFeedback] = useState("");
  const [theme, setTheme] = useState("light");
  const [toasts, setToasts] = useState([]);
  const pieRef = useRef(null);
  const barRef = useRef(null);
  const charts = useRef([]);

  const notify = (msg) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2500);
  };

  const login = async () => {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username: "admin", password: "admin123" })
    });
    const data = await res.json();
    localStorage.setItem("token", data.token);
    setUser(data.user);
    loadData(data.token);
  };

  const loadData = async (token) => {
    const res = await fetch(`${API}/api/attendance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setRecords(data.records);
  };

  const mark = async (status) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/api/attendance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      notify("Attendance marked");
      loadData(token);
    } else {
      notify("Already marked today");
    }
  };

  const filtered = useMemo(() => {
    return filterDate
      ? records.filter((r) => r.date === filterDate)
      : records;
  }, [records, filterDate]);

  const stats = {
    present: records.filter(r => r.status === "present").length,
    absent: records.filter(r => r.status === "absent").length,
    total: records.length
  };

  const percent = stats.total
    ? Math.round((stats.present / stats.total) * 100)
    : 0;

  // charts
  useEffect(() => {
    charts.current.forEach(c => c.destroy());
    charts.current = [];

    if (!records.length) return;

    const pie = new Chart(pieRef.current, {
      type: "pie",
      data: {
        labels: ["Present", "Absent"],
        datasets: [{
          data: [stats.present, stats.absent],
          backgroundColor: ["#22c55e", "#ef4444"]
        }]
      }
    });

    const monthly = {};
    records.forEach(r => {
      const m = new Date(r.dateTime).toLocaleString("en-IN", {month:"short"});
      if (!monthly[m]) monthly[m] = {p:0,a:0};
      r.status === "present" ? monthly[m].p++ : monthly[m].a++;
    });

    const bar = new Chart(barRef.current, {
      type: "bar",
      data: {
        labels: Object.keys(monthly),
        datasets: [
          { label:"Present", data:Object.values(monthly).map(x=>x.p), backgroundColor:"#22c55e" },
          { label:"Absent", data:Object.values(monthly).map(x=>x.a), backgroundColor:"#ef4444" }
        ]
      }
    });

    charts.current.push(pie, bar);
  }, [records]);

  const exportCSV = () => {
    const rows = records.map(r => `${r.date},${r.status}`);
    const blob = new Blob([rows.join("\n")]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "attendance.csv";
    a.click();
  };

  if (!user) {
    return (
      <div className="center">
        <div className="card glass">
          <h2>DevOps Dashboard</h2>
          <button onClick={login}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${theme}`}>

      {/* TOPBAR */}
      <div className="topbar">
        My DevOps Status
        <button onClick={() => setTheme(theme==="light"?"dark":"light")}>
          Toggle
        </button>
      </div>

      {/* PROFILE */}
      <div className="card profile glass">
        <div className="avatar">👤</div>
        <div>
          <h3>{user.name}</h3>
          <p>Enrollment: 07001192024</p>
          <p>Branch: AIML | Sem: 4</p>
        </div>
      </div>

      {/* ATTENDANCE */}
      <div className="card glass">
        <h3>Attendance Progress</h3>
        <div className="progress">
          <div className="bar" style={{width:percent+"%"}}></div>
        </div>
        <p>{stats.present}/{stats.total} ({percent}%)</p>

        <button onClick={()=>mark("present")}>Present</button>
        <button onClick={()=>mark("absent")}>Absent</button>
      </div>

      {/* FILTER + EXPORT */}
      <div className="card glass">
        <input type="date" onChange={(e)=>setFilterDate(e.target.value)} />
        <button onClick={exportCSV}>Export CSV</button>
      </div>

      {/* CHARTS */}
      <div className="card glass">
        <h3>Charts</h3>
        <canvas ref={pieRef}></canvas>
        <canvas ref={barRef}></canvas>
      </div>

      {/* HISTORY */}
      <div className="card glass">
        <h3>History</h3>
        {filtered.map(r=>(
          <div key={r.id} className="row">
            <span>{r.date}</span>
            <span className={r.status}>{r.status}</span>
          </div>
        ))}
      </div>

      {/* FEEDBACK */}
      <div className="card glass">
        <textarea value={feedback} onChange={e=>setFeedback(e.target.value)} />
        <button onClick={()=>notify("Feedback submitted")}>Submit</button>
      </div>

      {/* TOAST */}
      <div className="toast">
        {toasts.map(t=> <div key={t.id}>{t.msg}</div>)}
      </div>

    </div>
  );
}