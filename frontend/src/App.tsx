import { Component, type ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import "./App.css"
import { Navbar } from "./components/Navbar"
import { Sidebar } from "./components/Sidebar"
import { ToastProvider } from "./components/Toast"
import { DashboardPage } from "./components/pages/Dashboard"
import { EmergencyPage } from "./components/pages/Emergency"
import { PharmacyPage } from "./components/pages/Pharmacy"
import { LabResultsPage } from "./components/pages/LabResults"
import { VitalSignsPage } from "./components/pages/VitalSigns"
import { PatientRecordsPage } from "./components/pages/PatientRecords"
import { AuditLogPage } from "./components/pages/AuditLog"
import { SystemStatusPage } from "./components/pages/SystemStatus"

function AppShell() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
          <Sidebar />
          <div className="flex flex-1 flex-col bg-slate-50 transition-colors dark:bg-slate-950">
            <Navbar />
            <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 transition-colors dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/emergency" element={<EmergencyPage />} />
                <Route path="/pharmacy" element={<PharmacyPage />} />
                <Route path="/lab-results" element={<LabResultsPage />} />
                <Route path="/vital-signs" element={<VitalSignsPage />} />
                <Route path="/patient-records" element={<PatientRecordsPage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
                <Route path="/system-status" element={<SystemStatusPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </ToastProvider>
  )
}

interface BoundaryProps {
  children: ReactNode
}

interface BoundaryState {
  hasError: boolean
}

class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error("Application crashed", error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
          <h1 className="text-3xl font-semibold">Something went wrong</h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Refresh the page to continue.</p>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  )
}

export default App
