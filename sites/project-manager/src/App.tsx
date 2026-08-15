import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { RequireAdmin } from './auth/RequireAdmin';
import { RequireAuth } from './auth/RequireAuth';
import { RequireStaff } from './auth/RequireStaff';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { HomeRedirect } from './pages/HomeRedirect';
import { DashboardPage } from './pages/DashboardPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { TaskPage } from './pages/TaskPage';
import { ClientManagerPage } from './pages/ClientManagerPage';
import { TimeReportingPage } from './pages/TimeReportingPage';
import { UsersAdminPage } from './pages/UsersAdminPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { PortalLayout } from './layouts/PortalLayout';
import { ClientsListPage } from './features/companies/ClientsListPage';
import { ProjectsListPage } from './features/projects/ProjectsListPage';
import { ProjectDetailPage } from './features/projects/ProjectDetailPage';
import { DiscussionsPage } from './features/discussions/DiscussionsPage';
import { ManageCompaniesPage } from './pages/ManageCompaniesPage';
import { InvoicesAdminPage } from './pages/InvoicesAdminPage';
import { ClientInvoicesPage } from './pages/ClientInvoicesPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { InvoiceFormPage } from './pages/InvoiceFormPage';
import { ClientCompanySettingsPage } from './pages/ClientCompanySettingsPage';
import { ClientCompanyDetailPage } from './pages/ClientCompanyDetailPage';
import { WorkspaceLegacyRedirect } from './pages/WorkspaceLegacyRedirect';
import { UserAccountPage } from './pages/UserAccountPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />

      <Route
        element={
          <RequireAuth>
            <PortalLayout />
          </RequireAuth>
        }
      >
        <Route path="/app/dashboard" element={<DashboardPage />} />
        <Route path="/app/account" element={<UserAccountPage />} />
        <Route path="/app/projects" element={<ProjectsListPage />} />
        <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/app/discussions" element={<DiscussionsPage />} />
        <Route path="/app/discussions/:discussionId" element={<DiscussionsPage />} />
        <Route path="/app/tasks" element={<TaskPage />} />
        <Route path="/app/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/app/reports" element={<TimeReportingPage />} />
        <Route
          path="/clients"
          element={
            <RequireStaff>
              <ClientsListPage />
            </RequireStaff>
          }
        />
        <Route
          path="/clients/users"
          element={
            <RequireStaff>
              <UsersAdminPage />
            </RequireStaff>
          }
        />
        <Route
          path="/clients/users/:userId"
          element={
            <RequireStaff>
              <UserDetailPage />
            </RequireStaff>
          }
        />
        <Route
          path="/app/manage"
          element={
            <RequireStaff>
              <ManageCompaniesPage />
            </RequireStaff>
          }
        />
        <Route
          path="/app/manage/:companyId"
          element={
            <RequireStaff>
              <ClientManagerPage />
            </RequireStaff>
          }
        />
        <Route
          path="/app/invoices"
          element={
            <RequireAdmin>
              <InvoicesAdminPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/app/invoices/new"
          element={
            <RequireAdmin>
              <InvoiceFormPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/app/invoices/:invoiceId/edit"
          element={
            <RequireAdmin>
              <InvoiceFormPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/app/invoices/:invoiceId"
          element={
            <RequireAdmin>
              <InvoiceDetailPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/app/settings"
          element={
            <RequireAdmin>
              <AdminSettingsPage />
            </RequireAdmin>
          }
        />
        <Route path="/app/my-invoices" element={<ClientInvoicesPage />} />
        <Route path="/app/my-invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="/app/company-settings" element={<ClientCompanySettingsPage />} />
        <Route path="/app/company-settings/:companyId" element={<ClientCompanyDetailPage />} />
      </Route>

      <Route path="/w/:companyId/*" element={<WorkspaceLegacyRedirect />} />
    </Routes>
  );
}

export default App;
