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
import { useStations } from "../hooks/useStations";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [trendsHover, setTrendsHover] = useState(false);
  const [trendsSubmenu, setTrendsSubmenu] = useState(null); // 'aws' or 'ews'
  const [trendsStation, setTrendsStation] = useState(null);
  const trendsRef = useRef(null);
  const trendsTimeoutRef = useRef(null);
  const pathname = usePathname();
  const { awsStations: awsStationsData, ewsStations: ewsStationsData } = useStations();
  
  // Convert station data to format needed by navbar
  const awsStations = awsStationsData.map(station => ({
    name: station.station_name,
    slug: station.station_name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, ''),
    stationId: station.StationID,
    selectedFields: station.selected_fields || [],
    customFields: station.custom_fields || []
  }));
  
  const ewsStations = ewsStationsData.map(station => ({
    name: station.station_name,
    slug: station.station_name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, ''),
    stationId: station.StationID,
    selectedFields: station.selected_fields || [],
    customFields: station.custom_fields || []
  }));
  
  // Comprehensive field label mapping for all possible fields
  const fieldLabelMap = {
    // AWS fields
    "temperature": "Temperature",
    "pressure": "Pressure",
    "relative_humidity": "Humidity",
    "windspeed": "Wind Speed",
    "winddirection": "Wind Direction",
    "rain": "Rain",
    "precipitation": "Precipitation",
    "bucket_weight": "Bucket Weight",
    "PIR": "PIR (Solar Radiation)",
    "avg_PIR": "Average PIR",
    
    // EWS fields
    "water_level": "Water Level",
    "water_discharge": "Water Discharge",
    "surface_velocity": "Surface Velocity",
    "avg_surface_velocity": "Average Surface Velocity",
    "water_dist_sensor": "Water Distance Sensor",
    "tilt_angle": "Tilt Angle",
    "flow_direction": "Flow Direction",
    "SNR": "SNR",
    "internal_temperature": "Internal Temperature",
    "charge_current": "Charge Current",
    "observed_current": "Observed Current",
    "absorbed_current": "Absorbed Current", // Alias for observed_current
    "battery_voltage": "Battery Voltage",
    "solar_panel_tracking": "Solar Panel Tracking",
  };
  
  // Function to get label for a field key, with fallback for custom fields
  const getFieldLabel = (fieldKey) => {
    return fieldLabelMap[fieldKey] || fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  const getEwsFields = (stationSlug) => {
    // Find station and get its selected fields
    const station = ewsStations.find(s => s.slug === stationSlug);
    if (!station) {
      return [];
    }
    
    // Get all selected fields and convert to field objects with labels
    const fields = [];
    
    // Add standard selected fields
    if (station.selectedFields && station.selectedFields.length > 0) {
      station.selectedFields.forEach(fieldKey => {
        fields.push({
          key: fieldKey,
          label: getFieldLabel(fieldKey)
        });
      });
    }
    
    // Add custom fields if available
    if (station.customFields && Array.isArray(station.customFields) && station.customFields.length > 0) {
      station.customFields.forEach(customField => {
        if (customField.name) {
          fields.push({
            key: customField.name,
            label: customField.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          });
        }
      });
    }
    
    // Sort fields alphabetically by label for better UX
    return fields.sort((a, b) => a.label.localeCompare(b.label));
  };
  
  const getAwsFields = (stationSlug) => {
    // Find station and get its selected fields
    const station = awsStations.find(s => s.slug === stationSlug);
    if (!station) {
      return [];
    }
    
    // Get all selected fields and convert to field objects with labels
    const fields = [];
    
    // Add standard selected fields
    if (station.selectedFields && station.selectedFields.length > 0) {
      station.selectedFields.forEach(fieldKey => {
        fields.push({
          key: fieldKey,
          label: getFieldLabel(fieldKey)
        });
      });
    }
    
    // Add custom fields if available
    if (station.customFields && Array.isArray(station.customFields) && station.customFields.length > 0) {
      station.customFields.forEach(customField => {
        if (customField.name) {
          fields.push({
            key: customField.name,
            label: customField.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          });
        }
      });
    }
    
    // Sort fields alphabetically by label for better UX
    return fields.sort((a, b) => a.label.localeCompare(b.label));
  };
  
  const handleTrendsParameterSelect = (type, stationSlug, fieldKey) => {
    router.push(`/trends?type=${type}&station=${stationSlug}&parameter=${fieldKey}`);
    setTrendsHover(false);
    setTrendsSubmenu(null);
    setTrendsStation(null);
  };
  
  // Close dropdown with delay when mouse leaves
  const handleMouseLeave = () => {
    if (trendsTimeoutRef.current) {
      clearTimeout(trendsTimeoutRef.current);
    }
    trendsTimeoutRef.current = setTimeout(() => {
      setTrendsHover(false);
      setTrendsSubmenu(null);
      setTrendsStation(null);
    }, 300); // 300ms delay before closing
  };
  
  const handleMouseEnter = () => {
    if (trendsTimeoutRef.current) {
      clearTimeout(trendsTimeoutRef.current);
    }
    setTrendsHover(true);
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (trendsTimeoutRef.current) {
        clearTimeout(trendsTimeoutRef.current);
      }
    };
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
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
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
                  <div 
                    className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-2xl border border-gray-300 py-1 min-w-[200px] z-[100]"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* AWS Option */}
                    <div
                      className="relative"
                      onMouseEnter={() => {
                        if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                        setTrendsSubmenu('aws');
                      }}
                      onMouseLeave={() => {
                        // Don't close immediately, allow moving to submenu
                      }}
                    >
                      <div className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors">
                        <span className="text-gray-800 font-semibold">AWS</span>
                        <ChevronRight size={16} className="text-gray-500" />
                      </div>
                      
                      {/* AWS Stations Submenu */}
                      {trendsSubmenu === 'aws' && (
                        <div 
                          className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-2xl border border-gray-300 py-1 min-w-[180px] z-[100]"
                          onMouseEnter={() => {
                            if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                          }}
                          onMouseLeave={handleMouseLeave}
                        >
                          {awsStations.map((station) => (
                            <div
                              key={station.slug}
                              className="relative"
                              onMouseEnter={() => {
                                if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                                setTrendsStation({ type: 'aws', slug: station.slug });
                              }}
                            >
                              <div className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors">
                                <span className="text-gray-800 font-medium">{station.name}</span>
                                <ChevronRight size={16} className="text-gray-500" />
                              </div>
                              
                              {/* AWS Parameters Submenu */}
                              {trendsStation?.type === 'aws' && trendsStation?.slug === station.slug && (
                                <div 
                                  className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-2xl border border-gray-300 py-1 min-w-[240px] max-h-[400px] overflow-y-auto z-[100]"
                                  onMouseEnter={() => {
                                    if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                                  }}
                                  onMouseLeave={handleMouseLeave}
                                >
                                  {getAwsFields(station.slug).length > 0 ? (
                                    getAwsFields(station.slug).map((field) => (
                                      <div
                                        key={field.key}
                                        onClick={() => handleTrendsParameterSelect('AWS', station.slug, field.key)}
                                        className="px-4 py-2.5 hover:bg-blue-100 hover:text-blue-800 cursor-pointer text-sm text-gray-800 transition-colors font-medium"
                                      >
                                        {field.label}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-4 py-2.5 text-gray-500 text-sm italic">
                                      No parameters available
                                    </div>
                                  )}
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
                      onMouseEnter={() => {
                        if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                        setTrendsSubmenu('ews');
                      }}
                    >
                      <div className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors">
                        <span className="text-gray-800 font-semibold">EWS</span>
                        <ChevronRight size={16} className="text-gray-500" />
                      </div>
                      
                      {/* EWS Stations Submenu */}
                      {trendsSubmenu === 'ews' && (
                        <div 
                          className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-2xl border border-gray-300 py-1 min-w-[180px] z-[100]"
                          onMouseEnter={() => {
                            if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                          }}
                          onMouseLeave={handleMouseLeave}
                        >
                          {ewsStations.map((station) => (
                            <div
                              key={station.slug}
                              className="relative"
                              onMouseEnter={() => {
                                if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                                setTrendsStation({ type: 'ews', slug: station.slug });
                              }}
                            >
                              <div className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors">
                                <span className="text-gray-800 font-medium">{station.name}</span>
                                <ChevronRight size={16} className="text-gray-500" />
                              </div>
                              
                              {/* EWS Parameters Submenu */}
                              {trendsStation?.type === 'ews' && trendsStation?.slug === station.slug && (
                                <div 
                                  className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-2xl border border-gray-300 py-1 min-w-[240px] max-h-[400px] overflow-y-auto z-[100]"
                                  onMouseEnter={() => {
                                    if (trendsTimeoutRef.current) clearTimeout(trendsTimeoutRef.current);
                                  }}
                                  onMouseLeave={handleMouseLeave}
                                >
                                  {getEwsFields(station.slug).length > 0 ? (
                                    getEwsFields(station.slug).map((field) => (
                                      <div
                                        key={field.key}
                                        onClick={() => handleTrendsParameterSelect('EWS', station.slug, field.key)}
                                        className="px-4 py-2.5 hover:bg-blue-100 hover:text-blue-800 cursor-pointer text-sm text-gray-800 transition-colors font-medium"
                                      >
                                        {field.label}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-4 py-2.5 text-gray-500 text-sm italic">
                                      No parameters available
                                    </div>
                                  )}
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
