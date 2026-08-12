# Glance — Project Management Tool

A self-hosted project management MVP with a React frontend and Express + SQLite backend.

## Features

- User registration and login (JWT auth)
- Project management (create, edit, archive, delete)
- Kanban board with drag-and-drop (To Do / In Progress / Done)
- List view with filters (status, priority, assignee)
- Task detail modal with comments
- Default admin user seeded on first boot

## Quick Start (Docker)

```bash
docker build -t glance .
docker run -p 3000:3000 -v glance-data:/data glance
```

Open http://localhost:3000

## Default Admin

- Email: `admin@glance.local`
- Password: `admin123`

## Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to the backend on port 3000.

## Environment Variables

| Variable     | Default                    | Description          |
|-------------|----------------------------|----------------------|
| `PORT`      | `3000`                     | Server port          |
| `DB_PATH`   | `/data/glance.db`          | SQLite database path |
| `JWT_SECRET`| `change-me-in-production`  | JWT signing secret   |

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, JWT, bcryptjs
- **Frontend:** React 18, Vite, React Router, plain CSS
- **Database:** SQLite (WAL mode)
