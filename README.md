# Peer Feedback Platform

Full‑stack platform for safe, structured peer feedback in student groups. It balances privacy and accountability with session‑level anonymity controls, real‑time updates, and a clean, modern UX.

## Highlights
- Session‑level anonymity with clear banners and a confirmation step when identity is required
- Real‑time updates for sessions and feedback activity
- Direct messages (chat) for quick peer‑to‑peer communication
- Privacy and safety features including 2FA, audit logging, moderation, and rate limiting

## Features
- Create and manage feedback sessions per group
- Give targeted feedback to classmates with guidance and length limits
- View aggregated analytics to track trends and growth areas
- Role‑based access: admins, moderators, members
- Environment‑aware database setup and robust API error handling

## Getting Started
1. Install dependencies: `npm install`
2. Generate Prisma client: `npx prisma generate`
3. Push database schema: `npx prisma db push`
4. Start development server: `npm run dev:standard`

## Scripts
- `npm run dev:standard` — start Next.js dev server
- `npm run build` — build for production
- `npm run start` — run production server
- `npm run lint` — lint the project
- `npm run type-check` — TypeScript type checking

## Privacy & Safety
- Two‑Factor Authentication (2FA) for secure sign‑in
- Session‑level anonymity enforcement on the server
- Audit logging for key actions to maintain accountability
- Sentiment analysis and flagging to keep feedback constructive
- Rate limiting and permission checks to protect users and data

## Tech Stack
- Frontend: Next.js, React, Tailwind CSS
- Backend: Next.js API routes, Prisma ORM
- Realtime: Socket.io
- Auth & Security: JWT, 2FA (otplib)


