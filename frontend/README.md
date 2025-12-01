# CAMTC Healthcare Dashboard

Production-grade healthcare command center showcasing blockchain-backed workflows for emergency, pharmacy, lab, telemetry, and compliance operations.

## Core Stack

- React 18 + TypeScript (Vite)
- Tailwind CSS 3 + custom shadcn-style primitives
- Zustand state management
- React Router v6
- React Hook Form + Zod validation
- Axios + mocked API service
- ethers v6 wallet connector
- Recharts data visualizations

## Features

- Mission control dashboard with live TPS/latency metrics and validator analytics
- Tier-1 Emergency Room workflow with severity-driven priority scores
- Tier-2 Pharmacy and Lab modules (file upload + manual entry tabs)
- Real-time Vital Signs monitor with alert badges and simulated WebSocket status
- Advanced Patient Record explorer with filters, pagination, JSON modal, and signature verification
- HIPAA-ready Audit Log filters plus CSV export and live indicators
- System Status admin view with validator modal, throughput charts, and rolling system logs
- Global wallet-aware navbar, collapsible sidebar, toast notifications, and error boundary

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` folder to Vercel, Netlify, or any static host. Configure `VITE_API_URL` (and optionally `VITE_WS_URL`) in `.env` before building.

## Project Structure

```
src/
├── components/
│   ├── Navbar, Sidebar, LoadingSpinner, Toast
│   ├── pages/ (Dashboard, Emergency, Pharmacy, LabResults, VitalSigns, PatientRecords, AuditLog, SystemStatus)
│   └── ui/ (button, card, input, select, textarea, label, badge)
├── hooks/ (useWeb3, useApi, useWebSocket)
├── services/ (api, wallet, web3)
├── store/ (authStore, transactionStore, metricsStore)
├── types/
├── App.tsx
└── main.tsx
```

## Testing Checklist

- `npm run dev` — start StackBlitz/localhost session
- `npm run build` — ensure TypeScript + Vite compilation succeeds
- Verify wallet connect/disconnect flow, form validations, and toast handling
- Confirm charts render with mock data and tables remain responsive at tablet/desktop breakpoints

## Notes

- API/WebSocket calls are mocked via `services/api.ts` but mirror the real endpoint contracts for easy backend swaps.
- All dynamic values (validators, metrics, transactions) refresh on timers to simulate production telemetry.
