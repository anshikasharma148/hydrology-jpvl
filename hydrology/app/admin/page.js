'use client';
import { motion } from "framer-motion";
import AdminLayout from "../../components/AdminLayout";

export default function AdminHome() {
  // User Management Section
  const userManagementItems = [
    {
      href: "/admin/users",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4a4 4 0 100 8 4 4 0 000-8zm-6 14v-1a6 6 0 0112 0v1" />
        </svg>
      ),
      title: "Assign Users",
      description: "Manage user permissions and roles"
    },
    {
      href: "/admin/user-management",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM6 8c1.66 0 3-1.34 3-3S7.66 2 6 2 3 3.34 3 5s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V18h14v-4.5C13 11.17 8.33 10 6 10zm10 1c-.29 0-.62.02-.97.05 1.16.84 1.97 2.11 1.97 3.45V18h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      ),
      title: "User Management",
      description: "View, edit, and delete user accounts"
    },
    {
      href: "/admin/login-logs",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Login Logs",
      description: "View user login activities and history"
    }
  ];

  // Station Management Section
  const stationManagementItems = [
    {
      href: "/admin/stations",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      title: "Register Station",
      description: "Register a new station with CSV mapping"
    },
    {
      href: "/admin/station-management",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 6a4 4 0 110 8 4 4 0 010-8z" />
        </svg>
      ),
      title: "Manage Stations",
      description: "View, edit, and delete registered stations"
    },
    {
      href: "/admin/station-status",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Station Status",
      description: "Manage station status (Live/Offline/Maintenance)"
    }
  ];

  // Other/Settings Section
  const otherItems = [
    {
      href: "/admin/settings",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12z" />
        </svg>
      ),
      title: "Settings",
      description: "Configure application preferences"
    }
  ];

  const renderCard = (item, index) => (
    <motion.a
      key={item.href}
      href={item.href}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start p-5 bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-slate-300 transition-all duration-200 group"
    >
      <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors mr-4">
        {item.icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-800 group-hover:text-blue-700 mb-1 transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-gray-500">
          {item.description}
        </p>
      </div>
      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </motion.a>
  );

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Manage your application settings" showBackButton={false}>
      <div className="space-y-8">
        {/* User Management Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-12 bg-blue-600 rounded"></div>
            <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {userManagementItems.map((item, index) => renderCard(item, index))}
          </div>
        </div>

        {/* Station Management Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-12 bg-green-600 rounded"></div>
            <h2 className="text-2xl font-bold text-gray-800">Station Management</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {stationManagementItems.map((item, index) => renderCard(item, index + userManagementItems.length))}
          </div>
        </div>

        {/* Other/Settings Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-12 bg-gray-600 rounded"></div>
            <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {otherItems.map((item, index) => renderCard(item, index + userManagementItems.length + stationManagementItems.length))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
