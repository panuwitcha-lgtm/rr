import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import LivePosture from './pages/LivePosture';
import SitTimer from './pages/SitTimer';
import TodayStats from './pages/TodayStats';
import History from './pages/History';
import Score from './pages/Score';
import Notifications from './pages/Notifications';
import NotificationDetail from './pages/NotificationDetail';
import Device from './pages/Device';
import DeviceLink from './pages/DeviceLink';
import AlertSettings from './pages/AlertSettings';
import AppSettings from './pages/AppSettings';
import Profile from './pages/Profile';

function Private({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="splash"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <DataProvider><Layout>{children}</Layout></DataProvider>;
}

const routes = [
  ['/', Dashboard], ['/live', LivePosture], ['/timer', SitTimer],
  ['/stats/today', TodayStats], ['/stats/history', History], ['/stats/score', Score],
  ['/notifications', Notifications], ['/notifications/:id', NotificationDetail],
  ['/device', Device], ['/device/link', DeviceLink],
  ['/settings', AlertSettings], ['/settings/app', AppSettings], ['/profile', Profile],
];

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          {routes.map(([path, Page]) => <Route key={path} path={path} element={<Private><Page /></Private>} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
