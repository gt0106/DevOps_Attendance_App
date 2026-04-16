const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const sessions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function loadUsers() {
  return readJson(USERS_FILE, []);
}

async function loadAttendance() {
  return readJson(ATTENDANCE_FILE, []);
}

async function saveAttendance(records) {
  return writeJson(ATTENDANCE_FILE, records);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAuthToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7);
}

function requireAuth(req, res, next) {
  const token = getAuthToken(req);
  const session = token ? sessions.get(token) : null;

  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.session = session;
  req.token = token;
  next();
}

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const users = await loadUsers();
  const user = users.find(
    (entry) => entry.username === username && entry.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const token = createToken();
  const session = {
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: new Date().toISOString()
  };

  sessions.set(token, session);

  return res.json({
    token,
    user: session
  });
});

app.post("/api/logout", requireAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Logged out successfully" });
});

app.get("/api/session", requireAuth, (req, res) => {
  res.json({ user: req.session });
});

app.get("/api/attendance", requireAuth, async (req, res) => {
  const records = await loadAttendance();
  const userRecords = records
    .filter((record) => record.username === req.session.username)
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  res.json({ records: userRecords });
});

app.post("/api/attendance", requireAuth, async (req, res) => {
  const { status } = req.body || {};
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";

  if (!["present", "absent"].includes(normalizedStatus)) {
    return res.status(400).json({ message: "Status must be present or absent" });
  }

  const records = await loadAttendance();
  const now = new Date();
  const localDate = formatLocalDate(now);

  const duplicate = records.find(
    (record) => record.username === req.session.username && record.date === localDate
  );

  if (duplicate) {
    return res.status(409).json({ message: "Attendance already marked for today" });
  }

  const newRecord = {
    id: crypto.randomUUID(),
    username: req.session.username,
    status: normalizedStatus,
    date: localDate,
    dateTime: now.toISOString(),
    updatedAt: now.toISOString()
  };

  records.push(newRecord);
  await saveAttendance(records);

  res.status(201).json({
    message: `Marked ${normalizedStatus} successfully`,
    record: newRecord
  });
});

app.put("/api/attendance/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, dateTime } = req.body || {};
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";

  if (!["present", "absent"].includes(normalizedStatus)) {
    return res.status(400).json({ message: "Status must be present or absent" });
  }

  const records = await loadAttendance();
  const recordIndex = records.findIndex(
    (record) => record.id === id && record.username === req.session.username
  );

  if (recordIndex === -1) {
    return res.status(404).json({ message: "Attendance record not found" });
  }

  const nextDateTime = new Date(dateTime);
  if (Number.isNaN(nextDateTime.getTime())) {
    return res.status(400).json({ message: "Invalid date/time value" });
  }

  const nextDate = formatLocalDate(nextDateTime);
  const duplicate = records.find(
    (record, index) =>
      index !== recordIndex &&
      record.username === req.session.username &&
      record.date === nextDate
  );

  if (duplicate) {
    return res.status(409).json({ message: "Another record already exists for that day" });
  }

  records[recordIndex] = {
    ...records[recordIndex],
    status: normalizedStatus,
    date: nextDate,
    dateTime: nextDateTime.toISOString(),
    updatedAt: new Date().toISOString()
  };

  await saveAttendance(records);
  res.json({
    message: "Attendance record updated",
    record: records[recordIndex]
  });
});

app.delete("/api/attendance/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const records = await loadAttendance();
  const nextRecords = records.filter(
    (record) => !(record.id === id && record.username === req.session.username)
  );

  if (nextRecords.length === records.length) {
    return res.status(404).json({ message: "Attendance record not found" });
  }

  await saveAttendance(nextRecords);
  res.json({ message: "Attendance record deleted" });
});

app.get("/api/meta", async (req, res) => {
  const records = await loadAttendance();
  const latestRecord = [...records].sort(
    (a, b) => new Date(b.updatedAt || b.dateTime) - new Date(a.updatedAt || a.dateTime)
  )[0];

  res.json({
    version: "v1.0",
    lastUpdated: latestRecord?.updatedAt || latestRecord?.dateTime || new Date().toISOString()
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`DevOps Attendance Tracker running on http://localhost:${PORT}`);
});
