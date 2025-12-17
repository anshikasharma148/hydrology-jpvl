'use client';
import { useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';

const AdminUserForm = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    role: 'Shift Engineer',
    status: 'Active',
    password: 'cdc@123',
    allowPasswordChange: true,
  });

  const [currentStep, setCurrentStep] = useState(1); // ✅ Stepper state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await fetch('https://hydrology-jpvl.onrender.com/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.firstName,
          middle_name: formData.middleName,
          last_name: formData.lastName,
          email: formData.email,
          role: formData.role,
          status: formData.status,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');

      setSuccessMessage('✅ User created successfully!');
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        role: 'Shift Engineer',
        status: 'Active',
        password: 'cdc@123',
        allowPasswordChange: true,
      });
      setCurrentStep(1); // Reset stepper after submit
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const steps = ['User Details', 'Access Settings', 'Password Settings'];

  return (
    <AdminLayout title="Assign Users" subtitle="Add a new user with system access and role assignment">
      <div className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-10">
          {/* ✅ Stepper */}
          <div className="mb-10 relative">
            <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-300"></div>
            <div
              className="absolute top-4 left-0 h-0.5 bg-blue-600 transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            ></div>

            <div className="flex justify-between relative z-10">
              {steps.map((label, index) => {
                const step = index + 1;
                return (
                  <div key={label} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                        currentStep >= step
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {step}
                    </div>
                    <span className="mt-2 text-xs sm:text-sm font-medium text-gray-700">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>


          {/* ✅ Messages */}
          {successMessage && (
            <div className="mb-6 p-3 sm:p-4 text-green-700 bg-green-100 border border-green-300 rounded-lg text-sm sm:text-base">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mb-6 p-3 sm:p-4 text-red-700 bg-red-100 border border-red-300 rounded-lg text-sm sm:text-base">
              {errorMessage}
            </div>
          )}

          {/* ✅ Form */}
          <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10">
            {/* Step 1 */}
            <div>
              <div className="flex items-center mb-6">
                <span className="h-3 w-3 rounded-full bg-blue-500 mr-3"></span>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">User Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">👤</span> First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-xl 
                               focus:ring-2 focus:ring-blue-300 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-300"
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">👤</span> Middle Name
                  </label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-xl 
                               focus:ring-2 focus:ring-blue-300 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-300"
                    placeholder="Enter middle name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">👤</span> Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-xl 
                               focus:ring-2 focus:ring-blue-300 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-300"
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <span className="mr-2">📧</span> Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-xl 
                             focus:ring-2 focus:ring-blue-300 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-300"
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <div className="flex items-center mb-6 pt-6 border-t border-dashed border-gray-200">
                <span className="h-3 w-3 rounded-full bg-blue-500 mr-3"></span>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Access Settings</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">🛠</span> Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-xl 
                               focus:ring-2 focus:ring-blue-300 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-300"
                  >
                    <option value="Shift Engineer">Shift Engineer</option>
                    <option value="Viewer">Viewer</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="mr-2">✅</span> Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-xl 
                               focus:ring-2 focus:ring-blue-300 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all duration-300"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Deleted">Deleted</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex items-center mb-6 pt-6 border-t border-dashed border-gray-200">
                <span className="h-3 w-3 rounded-full bg-blue-500 mr-3"></span>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Password Settings</h2>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <span className="mr-2">🔑</span> Default Password
                </label>
                <input
                  type="text"
                  name="password"
                  value={formData.password}
                  readOnly
                  className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div className="flex items-center mt-3">
                <input
                  type="checkbox"
                  id="allowPasswordChange"
                  name="allowPasswordChange"
                  checked={formData.allowPasswordChange}
                  onChange={handleChange}
                  className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 border-gray-300 rounded focus:ring-blue-400"
                />
                <label htmlFor="allowPasswordChange" className="ml-3 text-gray-700 text-sm sm:text-base">
                  Allow user to change password on first login
                </label>
              </div>
            </div>

            {/* ✅ Submit */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                onClick={() => setCurrentStep(steps.length)}
                className={`w-full bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-4 px-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 font-semibold text-sm sm:text-lg ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? 'Creating User...' : '➕ Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUserForm;
