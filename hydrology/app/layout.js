import "./globals.css";
import 'leaflet/dist/leaflet.css';
import KeepAlive from '../components/KeepAlive';
import { NotificationProvider } from '../components/NotificationToast';
import { SettingsProvider } from '../contexts/SettingsContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          <NotificationProvider>
            <KeepAlive />
            {children}
          </NotificationProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
