<div align="center">

# auth-service

**Identity & token service for the Platform messaging system**

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)

</div>

---

## Responsibilities

- User registration with email OTP verification
- Login with JWT access token + refresh token rotation
- OAuth 2.0 social login (Google, X (formerly Twitter))
- OIDC / enterprise SSO (`/auth/oidc/login`, `/auth/sso/info`)
- User profile management (`/api/users`)
- Enterprise ownership: workspace / RBAC (`admin`), friends, notifications,
  ai-context, audit logging, and firebase (FCM push)
- Issues JWT tokens that **chat-service validates independently** — no inter-service calls required at runtime

---

## API Reference

### Auth endpoints

| Method | Path | Description | Auth required |
|--------|------|-------------|:---:|
| `POST` | `/auth/register` | Register new user, sends OTP email | |
| `POST` | `/auth/verify-otp` | Verify OTP → activates account | |
| `POST` | `/auth/login` | Login → returns `accessToken` + `refreshToken` | |
| `POST` | `/auth/refresh` | Refresh token rotation | |
| `POST` | `/auth/logout` | Invalidate refresh token | Bearer |
| `POST` | `/auth/forgot-password` | Request password reset | |
| `POST` | `/auth/reset-password` | Apply new password with reset token | |

### OAuth endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/google` | Redirect to Google OAuth |
| `GET` | `/auth/google/callback` | Google OAuth callback |
| `GET` | `/auth/twitter` | Redirect to X (formerly Twitter) OAuth |
| `GET` | `/auth/twitter/callback` | X (formerly Twitter) OAuth callback |

> The X strategy lives in `strategies/x.strategy.ts` (rebranded from Twitter); the
> controller routes are still mounted at `/auth/twitter`.

### User endpoints

| Method | Path | Description | Auth required |
|--------|------|-------------|:---:|
| `GET` | `/api/users/me` | Current user profile | Bearer |
| `PATCH` | `/api/users/me` | Update display name / avatar | Bearer |
| `GET` | `/api/users/search?q=` | Search users by name/email | Bearer |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```env
PORT=3001
MONGO_URI=mongodb://localhost:27018/platform
REDIS_URL=redis://localhost:6379

# JWT — must match chat-service app.jwt.secret
JWT_ACCESS_SECRET=your_shared_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Email (OTP mailer)
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=noreply@example.com
MAIL_PASS=your_mail_password
MAIL_FROM="Platform <noreply@example.com>"

# OAuth (optional — comment out unused providers)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

---

## Running Locally

### With Docker (recommended — see root README)

```bash
docker compose -f infra/docker-compose/compose.yml up -d auth-service
```

### Without Docker

```bash
# Requires MongoDB on :27018 and Redis on :6379
cd apps/server/auth-service
pnpm install
pnpm start:dev       # http://localhost:3001
```

### Tests

```bash
pnpm test            # unit tests (Jest)
pnpm test:e2e        # e2e tests
pnpm test:cov        # coverage report
```

---

## Module Structure

```
src/
├── modules/
│   ├── admin/         # Workspace / RBAC administration
│   ├── ai-context/    # AI context entries CRUD
│   ├── audit/         # Audit logging
│   ├── auth/          # AuthController, AuthService, strategies (JWT, Google, X), OIDC/SSO
│   ├── Email/         # EmailService (OTP mailer)
│   ├── firebase/      # FCM push
│   ├── friends/       # Friend requests / relationships
│   ├── notifications/ # User notifications
│   ├── users/         # UsersController, UsersService, User schema
│   └── workspace/     # Workspace / department model
├── config/            # ConfigModule setup
├── database/          # MongooseModule config
└── main.ts
```

---

## JWT Token Contract

Tokens are signed HS256 with `JWT_ACCESS_SECRET`. The payload structure:

```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234568790
}
```

chat-service reads `sub` as the authenticated user ID on every request.
