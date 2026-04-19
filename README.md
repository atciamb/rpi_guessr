# RPI Guessr

A GeoGuessr-style game for Rensselaer Polytechnic Institute. Guess locations around RPI campus from photos.

**Play now:** https://rpi.neelema.net/

## Local Development

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### Backend

The backend is a Go server with PostgreSQL and MinIO (S3-compatible storage). Use Docker Compose for local development:

```bash
cd backend
docker-compose up
```

This starts:
- Go backend server on `http://localhost:8080`
- PostgreSQL on port `5433`
- MinIO (S3-compatible storage) on `http://localhost:9000` (console on `http://localhost:9001`)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend.

### Admin Panel

The admin panel (`/admin`) allows uploading photos and managing the game. **When running locally, authentication is disabled** - you can access the admin panel without signing in. In production, Google OAuth restricts access to authorized users.

## Deployment

- **Frontend:** Deployed to Vercel automatically on push to `main`
- **Backend:** Deployed to EC2 via GitHub Actions

### CI/CD

Merging to `main` triggers deployment pipelines:
- Changes in `frontend/` trigger the Vercel frontend deployment
- Changes in `backend/` trigger the EC2 backend deployment

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

Note: This is one of several hobby projects I maintain, so I may be slow to review PRs. I appreciate your patience.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Leaflet
- **Backend:** Go, PostgreSQL, MinIO/S3
- **Deployment:** Vercel (frontend), AWS EC2 (backend)
