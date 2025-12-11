import "./globals.css";
import 'leaflet/dist/leaflet.css';
import KeepAlive from '../components/KeepAlive';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <KeepAlive />
        {children}
      </body>
    </html>
  );
}
