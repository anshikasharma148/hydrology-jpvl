import "./globals.css";
import 'leaflet/dist/leaflet.css';
import KeepAlive from '../components/KeepAlive';
import { NotificationProvider } from '../components/NotificationToast';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          <KeepAlive />
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
