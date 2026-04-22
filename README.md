# Student Dashboard App

A deployable student dashboard built with an Express backend and a lightweight React-powered frontend served from `public/`. It includes attendance intelligence, marks prediction, assignment tracking, calendar planning, notifications, goals, gamification, dark mode, and an academic assistant.

The app now supports two storage modes:

- `JSON` mode by default for local simplicity
- `MongoDB` mode automatically when `MONGODB_URI` is set

## Features

- Attendance progress with percentage and attended days
- Attendance risk prediction around the `75%` threshold
- Marks prediction from current academic performance
- Weekly and monthly analytics charts
- Assignment board with status, feedback, late indicator, and upload action
- Goal setting for attendance and target marks
- Notification bell for deadlines, low attendance, and performance drops
- Calendar view for classes, deadlines, and exams
- Subject-wise analytics with strengths and weak areas
- Feedback and suggestion box
- Gamification badges and streak tracking
- Dark mode and responsive layout
- AI helper endpoint for common academic questions
- Docker-ready deployment setup
- Health check endpoint for platforms like Render, Railway, Fly.io, and Docker health probes
- Optional MongoDB Atlas integration with automatic seeding from local JSON data

## Demo Credentials

- `admin / admin123`

## Project Structure

```text
.
|-- data/
|   |-- student-dashboard.json
|   `-- users.json
|-- public/
|   |-- app.jsx
|   |-- index.html
|   `-- styles.css
|-- .dockerignore
|-- .env.example
|-- .gitignore
|-- Dockerfile
|-- package.json
|-- README.md
`-- server.js
```

## Local Development

1. Install Node.js 18 or newer.
2. Run `npm install`
3. Run `npm start`
4. Open [http://localhost:5001](http://localhost:5001)

## Environment Variables

- `PORT`: HTTP port for the Express server. Default: `5001`
- `DATA_DIR`: Optional absolute or relative path for persisted JSON data. Default: `./data`
- `MONGODB_URI`: Optional MongoDB connection string. If provided, the app switches to MongoDB mode.
- `MONGODB_DB_NAME`: Optional MongoDB database name. Default: `student_dashboard`

Example:

```bash
PORT=5001
DATA_DIR=./data
MONGODB_URI=
MONGODB_DB_NAME=student_dashboard
```

If MongoDB is enabled and the target collections are empty, the app seeds `users` and `students` from the local JSON files automatically.

## Health Check

Use this endpoint after deployment:

```text
GET /api/health
```

Expected response includes:

- `status`
- `uptimeSeconds`
- `storageMode`
- `studentsLoaded`
- `timestamp`

## Deploy With Docker

Build the image:

```bash
docker build -t student-dashboard-app .
```

Run the container:

```bash
docker run -p 5001:5001 -v $(pwd)/data:/app/data student-dashboard-app
```

On Windows PowerShell:

```powershell
docker run -p 5001:5001 -v ${PWD}\\data:/app/data student-dashboard-app
```

## Deploy On Render / Railway / Similar Platforms

Use these settings:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Node version: `18+`

Important:

- If your platform uses ephemeral storage, JSON data will reset on redeploy or restart.
- For the easiest persistent setup, use MongoDB Atlas and set `MONGODB_URI`.
- If you stay on JSON mode, mount a disk/volume and set `DATA_DIR` to that mounted path.

## Render Blueprint

This repo now includes [render.yaml](C:\Users\TANISHKA\OneDrive\Documents\New%20project\render.yaml) for a Render web service with:

- `npm install` build
- `npm start` start
- `/api/health` health check
- manual `MONGODB_URI` secret entry

## MongoDB Atlas Setup

1. Create a free MongoDB Atlas cluster
2. Create a database user
3. Whitelist your deploy platform IPs, or allow access from anywhere for initial setup
4. Copy the connection string into `MONGODB_URI`
5. Optionally set `MONGODB_DB_NAME=student_dashboard`
6. Deploy the app

On first start, the app will seed data from `data/users.json` and `data/student-dashboard.json` if the collections are empty.

## Production Notes

- The app is deployable as-is for demos, prototypes, and portfolio use.
- Session storage is currently in-memory, so sessions reset when the server restarts.
- Assignment upload currently stores submission metadata instead of binary files.
- Google Calendar sync is represented at the UI/data-design level, not yet implemented with OAuth.

## Recommended Next Backend Upgrades

1. Persist sessions and authentication properly
2. Add real file uploads using `multer` or object storage
3. Move session/auth handling to secure persistent auth
4. Add Google Calendar OAuth sync
5. Replace the rule-based assistant with an LLM-backed service
