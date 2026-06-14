# OPPO Factory CMMS

## Overview

A comprehensive Computerized Maintenance Management System (CMMS) for the OPPO mobile manufacturing factory. Manages maintenance teams, downtime, inventory, preventive maintenance, training, production capacity, tasks, and attendance.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui (Framer Motion, Recharts, Lucide)
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: Express session-based (cookie)
- **Password hashing**: Node.js crypto.scryptSync

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Manager | manager | manager123 |
| Maintenance Tech | tech1 | tech123 |
| Maintenance Tech | tech2 | tech123 |
| Inventory | inventory1 | inv123 |

## Features

1. **Work Phone Station** — Track work phones per employee (workID, name, color, phone#, PCBA# with QR scan); multiple users may share same phone; filtered list with color/search; roles: admin/manager/teamleader/inventory can add
2. **Login** — Session-based authentication with 5 roles: admin, manager, teamleader, maintenance, inventory
2. **Dashboard** — Summary stats by role
3. **Downtime Records** — Record machine downtime with category, reason, resolution
4. **Inventory** — Spare parts catalog managed by inventory team
5. **Spare Part Orders** — Maintenance team orders parts; inventory/admin approves
6. **Preventive Maintenance** — PM plans with frequency (daily/weekly/monthly); calendar auto-generates recurring virtual occurrences; "Mark Done" auto-advances `nextDueDate` to the next occurrence; email notifications toggle
7. **Training Plans** — Training schedule with participants, team filter, and notifications; team leaders see only their team
8. **Production Capacity** — Hourly production per line; alerts when below minimum; reason required
9. **Tasks** — Admin/manager/teamleader assigns tasks; team leaders see only their team's tasks; team badge displayed
10. **Line Plans** — Team leader creates daily shift plans, shared to team members
11. **Attendance** — Daily attendance recorder with check-in/out times
12. **Broken Machines** — Report and track machine breakdowns, assign to technicians
13. **Machine Analysis** — Upload CSV test data; calculates OEE, FPY, Pass/Retest/Escape rates, Avg Cycle Time; machine ranking with risk scores; AI anomaly detection (CRITICAL/WARNING/GOOD); charts (failure frequency, pareto, escape rate, cycle time, OEE breakdown, radar); dataset viewer with pagination; CSV report download. Inventory role excluded.
14. **KPI Report** — Monthly KPI dashboard for admins/managers/teamleaders. Per-member scores: Attendance (35%), Punctuality (15%), Task Completion (50%) = Overall KPI %. Color coded green/amber/red. Clickable detail modal per member. Month picker, role filter, CSV export, print. API: GET /api/kpi?month=YYYY-MM.
15. **User Management** — Admin-only user CRUD with role + team assignment; pending approvals tab with role/team selector; team badges in user table
16. **Machine Registry** — Machine database with QR code tracking, Excel import/export, role-based access control, status/line/team filters; team badge column
17. **Audit Logs** — Admin-only full audit trail covering every write action across all modules: users, downtime, inventory, PM plans, training, tasks, machines, attendance, broken machines, vacation, announcements, defects, changeover, line plans. Also logs factory-level actions: config changes, section video edits, API key regeneration, machine data resets, and all backup/restore operations. Filterable by action, entity, date range; expandable change diffs. API: `GET /api/audit-logs`.
18. **3 Production Teams** — Assembly, Test, Packaging. Team leaders see/act only on their own team's tasks, vacation requests, machines, and training. Admin/manager can filter any page by team.
19. **User Self-Registration** — Admin toggles signup; users register with pending status; admin assigns role + team at approval.
20. **Public Downtime Reporting** — Admin-toggled feature; unauthenticated users can report machine breakdowns from the login page (name, machine, QR/ID, line). Notifies assigned shift operator. Reports appear in downtime list with "Public Report" amber badge. i18n: EN/AR/ZH.
21. **Defects Log** — Record defects per product/line with type, severity, quantity, and notes. Filterable/exportable. Roles: admin/manager/teamleader can log defects.
22. **Machine Monitor** — Real-time machine status dashboard grouped by production line and station. Shows PASS/FAIL counts, last push time, cycle time, auto-downtime alerts. APIs: push data, by-line, history per machine, api-key, reset. Excel import/export; column mapping for flexible data ingestion.
23. **Analytics & Reports** — Cross-module analytics dashboard: downtime trends, inventory movement, production capacity charts, KPI trend lines. CSV/Excel export.
24. **Production Lines** — Manage all 8+8+8 lines across Assembly/Test/Packaging. Admin/manager can add, rename, activate/deactivate, and reorder lines.
25. **Factory Settings** — Admin-only configuration panel: role display names, section names, section-level permissions (JSONB). PUT /api/factory-config. Includes Backup & Restore (full JSON export/import of all 30+ tables), Automatic Daily Backup (stored in `auto_backups` DB table; replaces old backup at midnight; status card in UI shows date, size, countdown), and OMTP machine agent configuration.
26. **Help Center** — In-app documentation and quick-reference guide for all features. Includes What's New section, animated per-section tutorial videos, role access info, and activation walkthrough.
27. **Automatic Daily Backup** — Scheduler runs on server startup and at midnight daily. Generates a full JSON backup of all factory data via `generateBackupJson()` in `backup-util.ts`; stores in `auto_backups` table (one row, always replaced). Endpoints: `GET /api/backup/auto/info`, `/auto/download`, `POST /api/backup/auto/restore`.

## Theme

Industrial dark theme: Chakra Petch display font, `hsl(222 16% 5%)` background, CSS grid background overlay, `tech-border` utility, `glass-panel` cards, custom scrollbar. Primary blue `hsl(217 91% 60%)`.

## Key Architecture Notes

- **Session**: stores only `userId` — role is always looked up fresh from DB via `getCurrentUser(req)`
- **Machine Monitor API**: full set at `/api/machine-data` — push (POST /), column-mapping (GET/PUT), import (POST /import), export (GET /export), history (GET /history/:id), by-line (GET /by-line), api-key (GET, POST /regenerate), reset (DELETE)
- **Factory Config**: single tenant row (tenantId=1), stored as JSONB for roleNames, sectionNames, sectionPerms
- **DB new tables**: `defects`, `factory_config`, `machine_data_logs`, `machine_column_mappings`
- **Pre-existing TS warnings**: `any` types in older pages and Ark UI slot prop mismatch in button-group.tsx — these are non-breaking and do not affect runtime

## Structure

```text
artifacts/
  api-server/         # Express API server
  cmms/               # React+Vite frontend
lib/
  api-spec/           # OpenAPI spec + codegen
  api-client-react/   # Generated React Query hooks
  api-zod/            # Generated Zod schemas
  db/                 # Drizzle schema + DB connection
scripts/
  src/seed.ts         # Database seed script
```

## Running

- API: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/cmms run dev`
- Seed DB: `pnpm --filter @workspace/scripts run seed`
- Push schema: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
