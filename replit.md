# MarketPro CRM

## Overview

MarketPro CRM is a comprehensive Digital Marketing Customer Relationship Management web application. It provides lead management, client tracking, sales pipeline visualization, invoicing, payment processing, campaign management, and team collaboration features. The application follows a corporate, professional UI design with role-based access control (RBAC) for different user types including Admin, Manager, Sales Executive, Support Staff, and Client portal access.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: TailwindCSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers
- **Charts**: Recharts for data visualization in reports and dashboards

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful API endpoints under `/api/*` prefix
- **Authentication**: Passport.js with Local Strategy for credentials-based login
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session storage
- **Password Security**: scrypt hashing with random salts for secure password storage

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization

### Authentication & Authorization
- **Session-based auth**: HTTP-only cookies with 7-day expiration
- **Role-Based Access Control (RBAC)**: Five user roles with hierarchical permissions
  - Admin: Full system access
  - Manager: Leads, tasks, campaigns, reports, team management
  - Sales: Leads, follow-ups, pipeline, quotations
  - Support: Tasks and client viewing
  - Client: Portal access only
- **Permission checking**: `hasPermission()` utility function for granular access control

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route-based page components
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities and configuration
├── server/           # Express backend application
│   ├── auth.ts       # Authentication setup
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database access layer
│   └── db.ts         # Database connection
├── shared/           # Shared code between frontend/backend
│   └── schema.ts     # Drizzle database schema
└── migrations/       # Database migration files
```

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production Build**: esbuild bundles server code, Vite builds client assets
- **Output**: `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## External Dependencies

### Database
- **PostgreSQL**: Primary data store accessed via `DATABASE_URL` environment variable
- **Session Storage**: PostgreSQL table `user_sessions` for session persistence

### Key NPM Packages
- **drizzle-orm** / **drizzle-kit**: Database ORM and migration tooling
- **passport** / **passport-local**: Authentication framework
- **express-session** / **connect-pg-simple**: Session management
- **@tanstack/react-query**: Async state management
- **recharts**: Chart library for reports
- **zod**: Runtime type validation

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Secret key for session encryption (defaults to development value)