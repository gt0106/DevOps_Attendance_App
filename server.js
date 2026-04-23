require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5001;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const DASHBOARD_FILE = path.join(DATA_DIR, "student-dashboard.json");
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "student_dashboard";

const sessions = new Map();
let mongoClient = null;
let mongoDb = null;

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content.replace(/^\uFEFF/, ""));
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

async function readSeedUsers() {
  return readJson(USERS_FILE, []);
}

async function readSeedDashboardCollection() {
  return readJson(DASHBOARD_FILE, []);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeMongoDocument(document) {
  if (!document) {
    return null;
  }

  const nextValue = { ...document };
  delete nextValue._id;
  return nextValue;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createUsernameFromEmail(email) {
  return normalizeEmail(email).split("@")[0].replace(/[^a-z0-9._-]/g, "") || `user-${crypto.randomUUID().slice(0, 8)}`;
}

function titleCaseFromEmail(email) {
  const base = createUsernameFromEmail(email)
    .replace(/[._-]+/g, " ")
    .trim();

  if (!base) {
    return "DevOps Learner";
  }

  return base.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function createDashboardTemplate(email, enrollmentNo) {
  const seedCollection = await readSeedDashboardCollection();
  const seed = clone(seedCollection[0] || {});

  return {
    ...seed,
    username: createUsernameFromEmail(email),
    profile: {
      ...(seed.profile || {}),
      name: titleCaseFromEmail(email),
      courseTitle: "Fundamentals of DevOps",
      cohort: seed.profile?.cohort || "Current Cohort",
      team: enrollmentNo,
      mentor: seed.profile?.mentor || "DevOps Faculty"
    }
  };
}

function shouldHydrateFromSeed(student) {
  return (
    !student.assignments?.length ||
    !student.calendarEvents?.length ||
    !student.subjects?.some((subject) => (subject.attendance?.total || 0) > 0)
  );
}

async function hydrateStudentFromSeed(student) {
  if (!shouldHydrateFromSeed(student)) {
    return student;
  }

  const seedCollection = await readSeedDashboardCollection();
  const seed = clone(seedCollection[0] || {});

  return {
    ...seed,
    ...student,
    username: student.username,
    profile: {
      ...(seed.profile || {}),
      ...(student.profile || {}),
      courseTitle: "Fundamentals of DevOps"
    },
    goals: {
      ...(seed.goals || {}),
      ...(student.goals || {})
    },
    subjects: student.subjects?.some((subject) => (subject.attendance?.total || 0) > 0)
      ? student.subjects
      : seed.subjects,
    assignments: student.assignments?.length ? student.assignments : seed.assignments,
    calendarEvents: student.calendarEvents?.length ? student.calendarEvents : seed.calendarEvents,
    suggestions: student.suggestions?.length ? student.suggestions : seed.suggestions,
    attendanceLog: student.attendanceLog || seed.attendanceLog || []
  };
}

function calculateAttendance(attendanceLog, subjects) {
  if (attendanceLog?.length) {
    const attended = attendanceLog.filter((entry) => entry.status === "present").length;
    const total = attendanceLog.length;
    const percentage = total ? round((attended / total) * 100) : 0;
    const requiredToReach75 = total * 0.75 <= attended
      ? 0
      : Math.ceil((0.75 * total - attended) / 0.25);
    const safeToMiss = Math.max(0, Math.floor(attended / 0.75 - total));

    return {
      attended,
      total,
      percentage,
      safeToMiss,
      requiredToReach75
    };
  }

  const totals = subjects.reduce(
    (acc, subject) => {
      acc.attended += subject.attendance.attended;
      acc.total += subject.attendance.total;
      return acc;
    },
    { attended: 0, total: 0 }
  );

  const percentage = totals.total ? round((totals.attended / totals.total) * 100) : 0;
  const requiredToReach75 = totals.total * 0.75 <= totals.attended
    ? 0
    : Math.ceil((0.75 * totals.total - totals.attended) / 0.25);
  const safeToMiss = Math.max(0, Math.floor(totals.attended / 0.75 - totals.total));

  return {
    ...totals,
    percentage,
    safeToMiss,
    requiredToReach75
  };
}

const storage = {
  mode: "json",

  async init() {
    if (!MONGODB_URI) {
      this.mode = "json";
      return;
    }

    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB_NAME);
    this.mode = "mongodb";
    await this.seedMongoIfEmpty();
  },

  async seedMongoIfEmpty() {
    const usersCollection = mongoDb.collection("users");
    const studentsCollection = mongoDb.collection("students");

    const [userCount, studentCount] = await Promise.all([
      usersCollection.countDocuments(),
      studentsCollection.countDocuments()
    ]);

    if (userCount === 0) {
      const users = await readSeedUsers();
      if (users.length) {
        await usersCollection.insertMany(users);
      }
    }

    if (studentCount === 0) {
      const students = await readSeedDashboardCollection();
      if (students.length) {
        await studentsCollection.insertMany(students);
      }
    }
  },

  async loadUsers() {
    if (this.mode === "mongodb") {
      return mongoDb.collection("users").find({}, { projection: { _id: 0 } }).toArray();
    }

    return readSeedUsers();
  },

  async saveUsersCollection(records) {
    if (this.mode === "mongodb") {
      const usersCollection = mongoDb.collection("users");
      await usersCollection.deleteMany({});
      if (records.length) {
        await usersCollection.insertMany(records);
      }
      return;
    }

    await writeJson(USERS_FILE, records);
  },

  async loadDashboardCollection() {
    if (this.mode === "mongodb") {
      const students = await mongoDb.collection("students").find().toArray();
      return students.map(sanitizeMongoDocument);
    }

    return readSeedDashboardCollection();
  },

  async saveDashboardCollection(records) {
    if (this.mode === "mongodb") {
      const studentsCollection = mongoDb.collection("students");
      await studentsCollection.deleteMany({});
      if (records.length) {
        await studentsCollection.insertMany(records);
      }
      return;
    }

    await writeJson(DASHBOARD_FILE, records);
  },

  async getStudentRecord(username) {
    if (this.mode === "mongodb") {
      const student = await mongoDb.collection("students").findOne({ username });
      return sanitizeMongoDocument(student);
    }

    const collection = await this.loadDashboardCollection();
    return collection.find((entry) => entry.username === username) || null;
  },

  async updateStudentRecord(username, updater) {
    if (this.mode === "mongodb") {
      const current = await this.getStudentRecord(username);
      if (!current) {
        throw new Error("Student data not found");
      }

      const nextValue = updater(clone(current));
      await mongoDb.collection("students").replaceOne({ username }, nextValue, { upsert: false });
      return nextValue;
    }

    const collection = await this.loadDashboardCollection();
    const index = collection.findIndex((entry) => entry.username === username);

    if (index === -1) {
      throw new Error("Student data not found");
    }

    const nextValue = updater(clone(collection[index]));
    collection[index] = nextValue;
    await this.saveDashboardCollection(collection);
    return nextValue;
  },

  async createUser(user, dashboardRecord) {
    const users = await this.loadUsers();
    users.push(user);
    await this.saveUsersCollection(users);

    const collection = await this.loadDashboardCollection();
    collection.push(dashboardRecord);
    await this.saveDashboardCollection(collection);

    return { user, dashboardRecord };
  }
};

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

function formatDateLabel(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

function round(number) {
  return Math.round(number * 10) / 10;
}

function calculateMarks(subjects) {
  const perSubject = subjects.map((subject) => {
    const predicted = round(
      subject.marks.mid * 0.35 +
      subject.marks.internal * 0.25 +
      subject.marks.assignmentAverage * 0.2 +
      (subject.monthlyTrend.at(-1) || subject.marks.mid) * 0.2
    );

    return {
      subjectId: subject.id,
      name: subject.name,
      predicted,
      classAverage: subject.marks.classAverage,
      differenceFromAverage: round(predicted - subject.marks.classAverage)
    };
  });

  const overallPredicted = perSubject.length
    ? round(perSubject.reduce((sum, subject) => sum + subject.predicted, 0) / perSubject.length)
    : 0;

  return {
    overallPredicted,
    perSubject
  };
}

function buildTrendSeries(attendanceLog, subjects) {
  const weekBuckets = [];
  for (let index = 0; index < attendanceLog.length; index += 7) {
    const slice = attendanceLog.slice(index, index + 7);
    const present = slice.filter((entry) => entry.status === "present").length;
    weekBuckets.push({
      label: `W${weekBuckets.length + 1}`,
      attendance: slice.length ? round((present / slice.length) * 100) : 0
    });
  }

  const monthlyAttendanceMap = attendanceLog.reduce((acc, entry) => {
    const key = entry.date.slice(0, 7);
    if (!acc[key]) {
      acc[key] = { total: 0, attended: 0 };
    }
    acc[key].total += 1;
    if (entry.status === "present") {
      acc[key].attended += 1;
    }
    return acc;
  }, {});

  const monthlyAttendance = Object.entries(monthlyAttendanceMap).map(([month, value]) => ({
    label: month,
    attendance: value.total ? round((value.attended / value.total) * 100) : 0
  }));

  const averageMonthlyMarks = subjects[0]?.monthlyTrend.map((_, index) => {
    const values = subjects.map((subject) => subject.monthlyTrend[index] || 0);
    return round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }) || [];

  const monthlyMarks = averageMonthlyMarks.map((value, index) => ({
    label: `M${index + 1}`,
    marks: value
  }));

  return {
    weeklyAttendance: weekBuckets,
    monthlyAttendance,
    monthlyMarks
  };
}

function buildStrengths(subjects) {
  const sorted = [...subjects].sort((a, b) => {
    const scoreA = a.marks.internal + a.marks.assignmentAverage;
    const scoreB = b.marks.internal + b.marks.assignmentAverage;
    return scoreB - scoreA;
  });

  return {
    strengths: sorted.slice(0, 2).map((subject) => ({
      subjectId: subject.id,
      name: subject.name,
      reason: subject.feedback
    })),
    weaknesses: [...sorted].reverse().slice(0, 2).map((subject) => ({
      subjectId: subject.id,
      name: subject.name,
      reason: subject.feedback
    }))
  };
}

function buildBadges(attendance, assignments) {
  const badges = [];

  if (attendance.percentage >= 85) {
    badges.push({ id: "badge-attendance", label: "Attendance Star", detail: "Maintained 85%+ attendance" });
  }

  if (assignments.some((assignment) => assignment.status === "submitted" && !assignment.late)) {
    badges.push({ id: "badge-punctual", label: "On-Time Submitter", detail: "Submitted at least one assignment before deadline" });
  }

  if (assignments.filter((assignment) => assignment.status === "submitted").length >= 2) {
    badges.push({ id: "badge-consistency", label: "Consistency Streak", detail: "Two or more submissions completed" });
  }

  return badges;
}

function calculateStreak(attendanceLog) {
  let streak = 0;
  for (let index = attendanceLog.length - 1; index >= 0; index -= 1) {
    if (attendanceLog[index].status !== "present") {
      break;
    }
    streak += 1;
  }
  return streak;
}

function buildNotifications(student, attendance, marks) {
  const now = new Date();
  const notifications = [];

  student.assignments.forEach((assignment) => {
    if (assignment.status === "pending") {
      const due = new Date(assignment.dueDate);
      const hoursLeft = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60));
      notifications.push({
        id: `deadline-${assignment.id}`,
        type: "deadline",
        title: `${assignment.title} due soon`,
        message: hoursLeft > 0 ? `Due in about ${hoursLeft} hours.` : "Deadline has passed, submit as soon as possible.",
        severity: hoursLeft <= 24 ? "high" : "medium",
        read: false
      });
    }
  });

  if (attendance.percentage < 75 || attendance.safeToMiss <= 1) {
    notifications.push({
      id: "attendance-warning",
      type: "attendance",
      title: "Attendance warning",
      message: attendance.percentage < 75
        ? `You are at ${attendance.percentage}%. Attend ${attendance.requiredToReach75} upcoming sessions to recover above 75%.`
        : `You can only miss ${attendance.safeToMiss} more sessions before dropping under 75%.`,
      severity: "high",
      read: false
    });
  }

  const decliningSubjects = student.subjects.filter((subject) => {
    const trend = subject.weeklyTrend;
    return trend[trend.length - 1] < trend[0] - 5;
  });

  decliningSubjects.forEach((subject) => {
    notifications.push({
      id: `performance-${subject.id}`,
      type: "performance",
      title: `${subject.name} performance dipped`,
      message: `Recent weekly trend fell to ${subject.weeklyTrend.at(-1)}. Schedule revision this week.`,
      severity: marks.overallPredicted < student.goals.marksTarget ? "medium" : "low",
      read: false
    });
  });

  return notifications.slice(0, 6);
}

function buildAssistantHints(attendance, marks) {
  return {
    bunkAllowanceMessage: attendance.safeToMiss > 0
      ? `You can skip ${attendance.safeToMiss} more sessions and still stay above 75%, assuming the current totals stay consistent.`
      : `You should avoid skipping sessions right now because you are close to the 75% threshold.`,
    marksImprovementMessage: marks.overallPredicted >= 85
      ? "You are on track for a strong DevOps assessment. Focus on mock drills and deployment speed."
      : "Improve lab performance and task quality in weaker DevOps modules to lift your final prediction."
  };
}

function buildDashboardPayload(student) {
  const attendance = calculateAttendance(student.attendanceLog, student.subjects);
  const marks = calculateMarks(student.subjects);
  const trends = buildTrendSeries(student.attendanceLog, student.subjects);
  const subjectInsights = buildStrengths(student.subjects);
  const badges = buildBadges(attendance, student.assignments);
  const streak = calculateStreak(student.attendanceLog);
  const notifications = buildNotifications(student, attendance, marks);
  const assistantHints = buildAssistantHints(attendance, marks);

  const overview = {
    attendancePercentage: attendance.percentage,
    attendedDays: attendance.attended,
    totalDays: attendance.total,
    assignmentsSubmitted: student.assignments.filter((entry) => entry.status === "submitted").length,
    pendingAssignments: student.assignments.filter((entry) => entry.status === "pending").length,
    predictedMarks: marks.overallPredicted
  };

  const predictions = {
    attendanceRisk: attendance.percentage < 75 ? "high" : attendance.percentage < 80 ? "medium" : "low",
    attendanceMessage: attendance.percentage < 75
      ? `Risk detected. Attend ${attendance.requiredToReach75} consecutive sessions to move above 75%.`
      : `Healthy range. You can miss ${attendance.safeToMiss} session${attendance.safeToMiss === 1 ? "" : "s"} and remain above 75%.`,
    marksMessage: `Predicted DevOps assessment score is ${marks.overallPredicted}% based on checkpoint scores, labs, tasks, and recent trend.`
  };

  const calendar = student.calendarEvents.map((event) => ({
    ...event,
    dateLabel: formatDateLabel(event.date)
  }));

  return {
    profile: student.profile,
    goals: student.goals,
    overview,
    predictions,
    attendance,
    marks,
    trends,
    subjects: student.subjects,
    assignments: student.assignments,
    notifications,
    analytics: {
      subjectInsights,
      badges,
      streak,
      classComparison: marks.perSubject
    },
    calendar,
    suggestions: student.suggestions,
    assistantHints,
    integrations: {
      googleCalendar: {
        status: "design-only",
        steps: [
          "Use Google OAuth 2.0 for account consent.",
          "Map session, deadline, and evaluation events to Google Calendar event payloads.",
          "Run a background sync job to keep dashboard updates aligned."
        ]
      }
    }
  };
}

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  const users = await storage.loadUsers();
  const user = users.find(
    (entry) => normalizeEmail(entry.email) === normalizeEmail(email) && entry.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = createToken();
  const session = {
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    enrollmentNo: user.enrollmentNo,
    createdAt: new Date().toISOString()
  };

  sessions.set(token, session);

  return res.json({
    token,
    user: session
  });
});

app.post("/api/register", async (req, res) => {
  const { email, password, enrollmentNo } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const normalizedEnrollment = String(enrollmentNo || "").trim();

  if (!normalizedEmail || !password || !normalizedEnrollment) {
    return res.status(400).json({ message: "Email, password, and enrollment number are required" });
  }

  const users = await storage.loadUsers();
  const duplicate = users.find(
    (entry) =>
      normalizeEmail(entry.email) === normalizedEmail ||
      String(entry.enrollmentNo || "").trim().toLowerCase() === normalizedEnrollment.toLowerCase()
  );

  if (duplicate) {
    return res.status(409).json({ message: "An account already exists with this email or enrollment number" });
  }

  const username = createUsernameFromEmail(normalizedEmail);
  const newUser = {
    username,
    email: normalizedEmail,
    password,
    enrollmentNo: normalizedEnrollment,
    name: titleCaseFromEmail(normalizedEmail),
    role: "DevOps Learner"
  };
  const dashboardRecord = await createDashboardTemplate(normalizedEmail, normalizedEnrollment);
  dashboardRecord.username = username;

  await storage.createUser(newUser, dashboardRecord);

  res.status(201).json({
    message: "Registration successful. Please sign in with your email and password."
  });
});

app.post("/api/logout", requireAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Logged out successfully" });
});

app.get("/api/session", requireAuth, (req, res) => {
  res.json({ user: req.session });
});

app.get("/api/health", async (req, res) => {
  const collection = await storage.loadDashboardCollection();

  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    dataDirectory: DATA_DIR,
    storageMode: storage.mode,
    databaseName: storage.mode === "mongodb" ? MONGODB_DB_NAME : null,
    studentsLoaded: collection.length,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  const rawStudent = await storage.getStudentRecord(req.session.username);
  const student = rawStudent ? await hydrateStudentFromSeed(rawStudent) : null;

  if (!student) {
    return res.status(404).json({ message: "DevOps tracker data not found" });
  }

  res.json(buildDashboardPayload(student));
});

app.post("/api/attendance/mark", requireAuth, async (req, res) => {
  const { status } = req.body || {};
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (!["present", "absent"].includes(normalizedStatus)) {
    return res.status(400).json({ message: "Status must be present or absent" });
  }

  const today = new Date().toISOString().slice(0, 10);

  let updated;

  try {
    updated = await storage.updateStudentRecord(req.session.username, (student) => {
      const record = clone(student);
      record.attendanceLog = record.attendanceLog || [];

      if (record.attendanceLog.some((entry) => entry.date === today)) {
        throw new Error("Attendance already marked for today");
      }

      record.attendanceLog.push({
        date: today,
        status: normalizedStatus
      });

      return record;
    });
  } catch (error) {
    return res.status(409).json({ message: error.message });
  }

  res.status(201).json({
    message: `Marked ${normalizedStatus} successfully`,
    dashboard: buildDashboardPayload(await hydrateStudentFromSeed(updated))
  });
});

app.put("/api/goals", requireAuth, async (req, res) => {
  const { attendanceTarget, marksTarget } = req.body || {};

  const nextAttendanceTarget = clamp(Number(attendanceTarget) || 75, 60, 100);
  const nextMarksTarget = clamp(Number(marksTarget) || 70, 35, 100);

  const updated = await storage.updateStudentRecord(req.session.username, (student) => ({
    ...student,
    goals: {
      attendanceTarget: nextAttendanceTarget,
      marksTarget: nextMarksTarget
    }
  }));

  res.json({
    message: "Goals updated",
    goals: updated.goals,
    dashboard: buildDashboardPayload(updated)
  });
});

app.post("/api/feedback", requireAuth, async (req, res) => {
  const { message } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ message: "Feedback message is required" });
  }

  const updated = await storage.updateStudentRecord(req.session.username, (student) => ({
    ...student,
    suggestions: [
      {
        id: crypto.randomUUID(),
        message: String(message).trim(),
        createdAt: new Date().toISOString()
      },
      ...student.suggestions
    ]
  }));

  res.status(201).json({
    message: "Suggestion saved",
    suggestions: updated.suggestions,
    dashboard: buildDashboardPayload(updated)
  });
});

app.post("/api/assignments/:id/upload", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { fileName, fileSizeKb } = req.body || {};

  if (!fileName) {
    return res.status(400).json({ message: "fileName is required" });
  }

  let updatedStudent;

  try {
    updatedStudent = await storage.updateStudentRecord(req.session.username, (student) => {
      const assignment = student.assignments.find((entry) => entry.id === id);

      if (!assignment) {
        throw new Error("Assignment not found");
      }

      const submittedAt = new Date().toISOString();
      assignment.fileName = fileName;
      assignment.fileSizeKb = Number(fileSizeKb) || Math.floor(Math.random() * 900) + 100;
      assignment.submittedAt = submittedAt;
      assignment.status = "submitted";
      assignment.late = new Date(submittedAt) > new Date(assignment.dueDate);

      return student;
    });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }

  res.status(201).json({
    message: "Assignment uploaded",
    dashboard: buildDashboardPayload(updatedStudent)
  });
});

app.post("/api/assistant/query", requireAuth, async (req, res) => {
  const { question } = req.body || {};

  if (!question || !String(question).trim()) {
    return res.status(400).json({ message: "Question is required" });
  }

  const student = await storage.getStudentRecord(req.session.username);
  if (!student) {
    return res.status(404).json({ message: "DevOps tracker data not found" });
  }

  const dashboard = buildDashboardPayload(student);
  const normalized = String(question).toLowerCase();

  let answer = dashboard.assistantHints.marksImprovementMessage;

  if (normalized.includes("skip") || normalized.includes("75")) {
    answer = dashboard.assistantHints.bunkAllowanceMessage;
  } else if (normalized.includes("improve") || normalized.includes("marks")) {
    const weakSubjects = dashboard.analytics.subjectInsights.weaknesses.map((item) => item.name).join(", ");
    answer = `${dashboard.assistantHints.marksImprovementMessage} Prioritize ${weakSubjects}.`;
  } else if (normalized.includes("assignment")) {
    const pending = dashboard.assignments.filter((item) => item.status === "pending");
    answer = pending.length
      ? `You have ${pending.length} pending assignment${pending.length === 1 ? "" : "s"}. Start with ${pending[0].title}.`
      : "All assignments are currently submitted. Focus on revision and attendance consistency.";
  } else if (normalized.includes("attendance")) {
    answer = `${dashboard.predictions.attendanceMessage} Your current attendance is ${dashboard.attendance.percentage}%.`;
  }

  res.json({
    answer,
    suggestedPrompts: [
      "Can I skip sessions and still maintain 75%?",
      "How can I improve my DevOps assessment score?",
      "Which task should I finish first?"
    ]
  });
});

app.get("/api/meta", async (req, res) => {
  const collection = await storage.loadDashboardCollection();
  const latestSuggestion = collection
    .flatMap((student) => student.suggestions || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  res.json({
    version: "v2.1",
    lastUpdated: latestSuggestion?.createdAt || new Date().toISOString(),
    storageMode: storage.mode
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function start() {
  try {
    await storage.init();
    app.listen(PORT, () => {
      console.log(`DevOps Attendance Tracker running on http://localhost:${PORT} using ${storage.mode}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();
