"use client";
import { useState, useEffect, useRef } from "react";
import {
  Menu,
  LogOut,
  Settings,
  BarChart3,
  TrendingUp,
  FileText,
  Cloud,
  AlertTriangle,
  Droplets,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [trendsHover, setTrendsHover] = useState(false);
  const [trendsSubmenu, setTrendsSubmenu] = useState(null); // 'aws' or 'ews'
  const [trendsStation, setTrendsStation] = useState(null);
  const trendsRef = useRef(null);
  const pathname = usePathname();
  
  // AWS stations and fields
  const awsStations = [
    { name: "Vasudhara", slug: "vasudhara" },
    { name: "Mana", slug: "mana" },
    { name: "Barrage", slug: "vishnu_prayag" },
  ];
  
  const awsFields = [
    { key: "temperature", label: "Temperature" },
    { key: "pressure", label: "Pressure" },
    { key: "relative_humidity", label: "Humidity" },
    { key: "windspeed", label: "Wind Speed" },
    { key: "winddirection", label: "Wind Dir" },
    { key: "rain", label: "Rain" },
    { key: "precipitation", label: "Precipitation" },
    { key: "bucket_weight", label: "Bucket Weight" },
    { key: "PIR", label: "PIR" },
    { key: "avg_PIR", label: "Avg PIR" },
  ];
  
  // EWS stations and fields
  const ewsStations = [
    { name: "Vasudhara", slug: "vasudhara" },
    { name: "Mana", slug: "mana" },
  ];
  
  const ewsBaseFields = [
    { key: "water_level", label: "Water Level" },
    { key: "water_discharge", label: "Water Discharge" },
    { key: "surface_velocity", label: "Surface Velocity" },
    { key: "avg_surface_velocity", label: "Avg Surface Velocity" },
    { key: "water_dist_sensor", label: "Distance from Sensor" },
    { key: "tilt_angle", label: "Tilt Angle" },
    { key: "flow_direction", label: "Flow Direction" },
  ];
  
  const ewsVasudharaFields = [
    { key: "internal_temperature", label: "Internal Temperature" },
    { key: "charge_current", label: "Charge Current" },
    { key: "absorbed_current", label: "Absorbed Current" },
    { key: "battery_voltage", label: "Battery Voltage" },
    { key: "solar_panel_tracking", label: "Solar Panel Tracking" },
  ];
  
  const ewsManaFields = [
    { key: "SNR", label: "SNR" },
  ];
  
  const getEwsFields = (stationSlug) => {
    if (stationSlug === "vasudhara") {
      return [...ewsBaseFields, ...ewsVasudharaFields];
    } else if (stationSlug === "mana") {
      return [...ewsBaseFields, ...ewsManaFields];
    }
    return ewsBaseFields;
  };
  
  const handleTrendsParameterSelect = (type, stationSlug, fieldKey) => {
    router.push(`/trends?type=${type}&station=${stationSlug}&parameter=${fieldKey}`);
    setTrendsHover(false);
    setTrendsSubmenu(null);
    setTrendsStation(null);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (trendsRef.current && !trendsRef.current.contains(event.target)) {
        setTrendsHover(false);
        setTrendsSubmenu(null);
        setTrendsStation(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error parsing user data", error);
      }
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    // Clear user data
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie =
      "adminToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    // Redirect to login and replace history
    window.location.replace("/auth/login");

    // Continuously trap navigation attempts
    setTimeout(() => {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", () => {
        window.history.pushState(null, "", window.location.href);
      });
    }, 200);
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
    { name: "AWS", href: "/aws", icon: Cloud },
    { name: "EWS", href: "/ews", icon: AlertTriangle },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Trends", href: "/trends", icon: TrendingUp },
  ];

  const fullName = user ? `${user.first_name} ${user.last_name || ""}`.trim() : "User";

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 py-3 px-6 flex items-center justify-between transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200"
          : "bg-white border-b border-gray-100"
      }`}
    >
      {/* Left Side - Logo/Branding */}
      <Link
        href="/dashboard"
        className="flex items-center hover:opacity-80 transition-opacity no-underline [&_*]:no-underline cursor-pointer"
      >
        <div className="h-12 w-12 rounded-lg flex items-center justify-center">
          <Droplets size={32} className="text-blue-600" />
        </div>
        <div className="ml-3">
          <h1 className="text-2xl font-bold text-gray-900">Hydrology</h1>
          <p className="text-xs text-gray-500 font-medium">Monitoring System</p>
        </div>
      </Link>

      {/* Center - Navigation Links (Desktop) */}
      <div className="hidden lg:flex items-center space-x-1 absolute left-1/2 transform -translate-x-1/2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          // Special handling for Trends dropdown
          if (item.name === "Trends") {
            return (
              <div
                key={item.name}
                ref={trendsRef}
                className="relative"
                onMouseEnter={() => setTrendsHover(true)}
                onMouseLeave={() => {
                  setTrendsHover(false);
                  setTimeout(() => {
                    if (!trendsHover) {
                      setTrendsSubmenu(null);
                      setTrendsStation(null);
                    }
                  }, 200);
                }}
              >
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-2 rounded-md text-lg font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={20} className="mr-2" />
                  {item.name}
                  <ChevronRight size={16} className="ml-1" />
                </Link>
                
                {/* Nested Dropdown Menu */}
                {trendsHover && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] z-50">
                    {/* AWS Option */}
                    <div
                      className="relative"
                      onMouseEnter={() => setTrendsSubmenu('aws')}
                    >
                      <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between">
                        <span className="text-gray-700 font-medium">AWS</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                      
                      {/* AWS Stations Submenu */}
                      {trendsSubmenu === 'aws' && (
                        <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[180px] z-50">
                          {awsStations.map((station) => (
                            <div
                              key={station.slug}
                              className="relative"
                              onMouseEnter={() => setTrendsStation({ type: 'aws', slug: station.slug })}
                            >
                              <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between">
                                <span className="text-gray-700">{station.name}</span>
                                <ChevronRight size={16} className="text-gray-400" />
                              </div>
                              
                              {/* AWS Parameters Submenu */}
                              {trendsStation?.type === 'aws' && trendsStation?.slug === station.slug && (
                                <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[220px] max-h-[400px] overflow-y-auto z-50">
                                  {awsFields.map((field) => (
                                    <div
                                      key={field.key}
                                      onClick={() => handleTrendsParameterSelect('AWS', station.slug, field.key)}
                                      className="px-4 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                                    >
                                      {field.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* EWS Option */}
                    <div
                      className="relative"
                      onMouseEnter={() => setTrendsSubmenu('ews')}
                    >
                      <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between">
                        <span className="text-gray-700 font-medium">EWS</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                      
                      {/* EWS Stations Submenu */}
                      {trendsSubmenu === 'ews' && (
                        <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[180px] z-50">
                          {ewsStations.map((station) => (
                            <div
                              key={station.slug}
                              className="relative"
                              onMouseEnter={() => setTrendsStation({ type: 'ews', slug: station.slug })}
                            >
                              <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between">
                                <span className="text-gray-700">{station.name}</span>
                                <ChevronRight size={16} className="text-gray-400" />
                              </div>
                              
                              {/* EWS Parameters Submenu */}
                              {trendsStation?.type === 'ews' && trendsStation?.slug === station.slug && (
                                <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[220px] max-h-[400px] overflow-y-auto z-50">
                                  {getEwsFields(station.slug).map((field) => (
                                    <div
                                      key={field.key}
                                      onClick={() => handleTrendsParameterSelect('EWS', station.slug, field.key)}
                                      className="px-4 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                                    >
                                      {field.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }
          
          // Regular nav items
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-2 rounded-md text-lg font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:text-blue-600 hover:bg-gray-100"
              }`}
            >
              <Icon size={20} className="mr-2" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Right Side - User Section */}
      <div className="flex items-center space-x-4">
        {/* User Greeting (Desktop) */}
        <div className="hidden md:block text-gray-700 text-base">
          Welcome,{" "}
          <span className="font-semibold text-blue-700">{fullName}</span>
        </div>

        {/* Logout Button (Desktop) */}
        <button
          onClick={handleLogout}
          className="hidden md:flex items-center space-x-2 px-4 py-2 
             text-white 
             bg-red-600/80 
             border border-red-600 
             backdrop-blur-sm 
             rounded-md 
             transition-all duration-300 
             hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/40"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        >
          <Menu size={28} />
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 w-full bg-white shadow-lg border-b border-gray-200 lg:hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-base font-medium text-gray-700">
              Welcome, {fullName}
            </p>
          </div>

          <div className="py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-lg font-medium ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={20} className="mr-3" />
                  {item.name}
                </Link>
              );
            })}

            <div className="border-t border-gray-200 mt-2 pt-2">
              <Link
                href="/settings"
                className="flex items-center px-4 py-3 text-base text-gray-700 hover:bg-gray-100"
                onClick={() => setMenuOpen(false)}
              >
                <Settings size={20} className="mr-3" />
                Settings
              </Link>

              <div className="flex justify-center mt-4">
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 
               text-white 
               bg-red-600/80 
               border border-red-600 
               backdrop-blur-sm 
               rounded-md 
               transition-all duration-300 
               hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/40"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
