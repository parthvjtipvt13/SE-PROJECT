# ProjexHub — Centralized B.Tech Project Management System

Group 1 · SE Lab · VJTI (Devansh Mehta, Tanush Lokhande, Parth Madrewar, Rehan Mehta)

React + Node/Express + PostgreSQL. Three roles — **Student, Guide, Coordinator** — covering:
registration & login (JWT), group formation, topic submission/approval (with duplicate detection),
guide allocation (per-guide load limit), milestones, document upload with versioning and draft
auto-save, guide review with marks & feedback, scheduling (clash detection), notifications,
role dashboards, activity log and result publication.

## Prerequisites
Node.js 18+ and PostgreSQL 14+ running locally.

## Setup

```bash
# 1. Backend
cd backend
copy .env.example .env        # (cp on Mac/Linux) – edit the DATABASE_URL password if needed
npm install
npm run db:setup              # creates the database, tables and demo data
npm run dev                   # API on http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # app on http://localhost:5173
```

Single-server mode: `cd frontend && npm run build`, then `npm start` in `backend` serves everything on port 4000.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Coordinator | coordinator@projexhub.dev | Coord@123 |
| Guide | guide1@projexhub.dev (also guide2, guide3) | Guide@123 |
| Student (Group 1) | rehan@projexhub.dev (also devansh, tanush, parth) | Student@123 |
| Student (no group) | aarav / isha / kabir / meera @projexhub.dev | Student@123 |

## Try the full lifecycle
1. Log in as an ungrouped student → **My Group** → create a group using teammates' roll numbers (241080102 …).
2. **Project Topic** → submit. Log in as coordinator → **Topic Approvals** → approve.
3. Coordinator → **Groups** → allocate a guide; **Milestones** → create one for the group.
4. Student → **Milestones** → type notes (auto-saved) and upload a file (upload again for v2).
5. Guide → **Review Queue** → give marks + feedback.
6. Coordinator → **Groups** → **Publish result**; the student sees it under **Result**.

## Tests
`cd backend && npm run db:reset && npm test` runs a 12-step end-to-end test of the whole lifecycle.

## Layout
```
backend/  src/{app,server,db,access}.js  src/routes/*  src/db/{schema.sql,seed.js,setup.js}  test/smoke.js
frontend/ src/{App,Layout,auth,api,ui}.jsx  src/pages/*
```
