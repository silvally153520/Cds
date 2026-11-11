import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomDetailPage } from './pages/RoomDetailPage';
import { BookingsPage } from './pages/BookingsPage';
import { AuthPage } from './pages/AuthPage';
import { HostRegisterPage } from './pages/HostRegisterPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';

const HostDashboardPage = lazy(() => import('./pages/HostDashboardPage').then((module) => ({ default: module.HostDashboardPage })));
const HostPropertiesPage = lazy(() => import('./pages/HostPropertiesPage').then((module) => ({ default: module.HostPropertiesPage })));
const HostPropertyWizardPage = lazy(() => import('./pages/HostPropertyWizardPage').then((module) => ({ default: module.HostPropertyWizardPage })));
const HostCalendarPage = lazy(() => import('./pages/HostCalendarPage').then((module) => ({ default: module.HostCalendarPage })));

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<RoomsPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/:id" element={<RoomDetailPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/host/register" element={<HostRegisterPage />} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['HOST']}><Navigate to="/host/dashboard" replace /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
            <Route path="/host/dashboard" element={<ProtectedRoute allowedRoles={['HOST']}><Suspense fallback={<PageLoading />}><HostDashboardPage /></Suspense></ProtectedRoute>} />
            <Route path="/host/properties" element={<ProtectedRoute allowedRoles={['HOST']}><Suspense fallback={<PageLoading />}><HostPropertiesPage /></Suspense></ProtectedRoute>} />
            <Route path="/host/properties/new" element={<ProtectedRoute allowedRoles={['HOST']}><Suspense fallback={<PageLoading />}><HostPropertyWizardPage /></Suspense></ProtectedRoute>} />
            <Route path="/host/properties/:id/edit" element={<ProtectedRoute allowedRoles={['HOST']}><Suspense fallback={<PageLoading />}><HostPropertyWizardPage /></Suspense></ProtectedRoute>} />
            <Route path="/host/calendar" element={<ProtectedRoute allowedRoles={['HOST']}><Suspense fallback={<PageLoading />}><HostCalendarPage /></Suspense></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function PageLoading() {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Đang tải trang…</div>;
}

export default App;
