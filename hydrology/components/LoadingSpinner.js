'use client';
import { motion } from 'framer-motion';

export default function LoadingSpinner({ message = "Loading...", size = "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-20 w-20"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="relative inline-block">
          {/* Outer ring */}
          <motion.div
            className={`${sizeClasses[size]} border-4 border-gray-200 border-t-slate-600 rounded-full`}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          {/* Inner ring */}
          <motion.div
            className={`absolute inset-0 ${sizeClasses[size]} border-4 border-transparent border-t-slate-400 rounded-full`}
            animate={{ rotate: -360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-gray-600 font-medium text-sm sm:text-base"
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

