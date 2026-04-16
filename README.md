# DevOps Attendance Tracking Web App

A modern attendance tracking app with a React-based frontend and a simple Express backend using JSON file storage.

## Features

- Simple login/logout with local session storage
- Dashboard with present, absent, and attendance percentage summary cards
- Mark present or absent with automatic date/time capture
- Duplicate attendance prevention for the same day
- Attendance history table sorted by latest first
- Calendar view with present and absent highlights
- Search by date and filter by date range
- Pie chart and bar chart reporting
- Edit and delete attendance records
- CSV export
- Dark mode toggle
- Notification toasts
- Responsive dashboard layout
- Version label and simulated last updated timestamp
- Modular frontend and backend structure

## Demo Credentials

- `admin / admin123`
- `engineer / devops123`

## Folder Structure

```text
.
|-- data/
|   |-- attendance.json
|   `-- users.json
|-- public/
|   |-- app.jsx
|   |-- index.html
|   `-- styles.css
|-- package.json
|-- README.md
`-- server.js
```

## Run Locally

1. Install [Node.js](https://nodejs.org/) if it is not already installed.
2. Open a terminal in the project root.
3. Run `npm install`
4. Run `npm start`
5. Open [http://localhost:3000](http://localhost:3000)

## Notes

- The backend stores users and attendance records in JSON files under `data/`.
- The frontend stores the active session and theme in `localStorage`.
- The frontend loads React, ReactDOM, Babel Standalone, and Chart.js from CDN links in `public/index.html`.
