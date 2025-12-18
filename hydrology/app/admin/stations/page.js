'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import AdminLayout from '../../../components/AdminLayout';
import { useNotification } from '../../../components/NotificationToast';
import LoadingSpinner from '../../../components/LoadingSpinner';

// Standard AWS fields
const AWS_STANDARD_FIELDS = [
  { name: 'windspeed', label: 'Wind Speed' },
  { name: 'winddirection', label: 'Wind Direction' },
  { name: 'temperature', label: 'Temperature' },
  { name: 'relative_humidity', label: 'Relative Humidity' },
  { name: 'pressure', label: 'Pressure' },
  { name: 'PIR', label: 'PIR (Solar Radiation)' },
  { name: 'avg_PIR', label: 'Average PIR' },
  { name: 'bucket_weight', label: 'Bucket Weight' },
  { name: 'precipitation', label: 'Precipitation' },
  { name: 'rain', label: 'Rain' }
];

// Standard EWS fields
const EWS_STANDARD_FIELDS = [
  { name: 'surface_velocity', label: 'Surface Velocity' },
  { name: 'SNR', label: 'SNR' },
  { name: 'avg_surface_velocity', label: 'Average Surface Velocity' },
  { name: 'water_dist_sensor', label: 'Water Distance Sensor' },
  { name: 'water_level', label: 'Water Level' },
  { name: 'water_discharge', label: 'Water Discharge' },
  { name: 'tilt_angle', label: 'Tilt Angle' },
  { name: 'flow_direction', label: 'Flow Direction' },
  { name: 'internal_temperature', label: 'Internal Temperature' },
  { name: 'charge_current', label: 'Charge Current' },
  { name: 'observed_current', label: 'Observed Current' },
  { name: 'battery_voltage', label: 'Battery Voltage' },
  { name: 'solar_panel_tracking', label: 'Solar Panel Tracking' }
];

// Generate column letters (A-Z, then AA-ZZ)
const generateColumnLetters = (count = 30) => {
  const letters = [];
  for (let i = 0; i < count; i++) {
    if (i < 26) {
      letters.push(String.fromCharCode(65 + i)); // A-Z
    } else {
      const first = String.fromCharCode(65 + Math.floor((i - 26) / 26));
      const second = String.fromCharCode(65 + ((i - 26) % 26));
      letters.push(first + second); // AA-ZZ
    }
  }
  return letters;
};

const COLUMN_LETTERS = generateColumnLetters(30);

// Get backend URL
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://hydrology-jpvl.onrender.com";
};

const StationForm = () => {
  const router = useRouter();
  const { showAlert, showConfirm } = useNotification();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    serviceType: '', // AWS or EWS
    stationId: '',
    stationName: '',
    deviceId: '',
    csvFolderPath: '',
    longitude: '',
    latitude: '',
    country: '',
    state: '',
    district: '',
    pinCode: ''
  });

  // Field selection and column mappings
  const [selectedFields, setSelectedFields] = useState([]);
  const [columnMappings, setColumnMappings] = useState({}); // { fieldName: 'A', ... }
  const [customFields, setCustomFields] = useState([]); // [{ name, type, column }]

  const steps = ['Basic Info', 'Location', 'Field Mapping', 'Review'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleServiceTypeChange = (e) => {
    const serviceType = e.target.value;
    setFormData(prev => ({ ...prev, serviceType }));
    // Reset field selections when service type changes
    setSelectedFields([]);
    setColumnMappings({});
  };

  const handleFieldToggle = (fieldName) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldName)) {
        // Remove field and its mapping
        const newMappings = { ...columnMappings };
        delete newMappings[fieldName];
        setColumnMappings(newMappings);
        return prev.filter(f => f !== fieldName);
      } else {
        return [...prev, fieldName];
      }
    });
  };

  const handleColumnMappingChange = (fieldName, columnLetter) => {
    setColumnMappings(prev => ({
      ...prev,
      [fieldName]: columnLetter
    }));
  };

  const handleAddCustomField = () => {
    setCustomFields(prev => [...prev, { name: '', type: 'DECIMAL(10,2)', column: 'A' }]);
  };

  const handleCustomFieldChange = (index, field, value) => {
    setCustomFields(prev => prev.map((f, i) => 
      i === index ? { ...f, [field]: value } : f
    ));
  };

  const handleRemoveCustomField = (index) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!formData.serviceType) {
      showAlert('Please select Service Type (AWS or EWS)', 'warning');
      return false;
    }
    if (!formData.stationId || !formData.stationName || !formData.deviceId || !formData.csvFolderPath) {
      showAlert('Please fill in all basic information fields', 'warning');
      return false;
    }
    if (selectedFields.length === 0) {
      showAlert('Please select at least one field to map', 'warning');
      return false;
    }
    // Check all selected fields have column mappings
    for (const field of selectedFields) {
      if (!columnMappings[field]) {
        showAlert(`Please select a CSV column for field: ${field}`, 'warning');
        return false;
      }
    }
    // Validate custom fields
    for (const customField of customFields) {
      if (!customField.name || !customField.column) {
        showAlert('Please fill in all custom field details', 'warning');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      const backendUrl = getBackendUrl();
      const token = localStorage.getItem("token");

      // Build column mappings object (including timestamp)
      const allColumnMappings = {
        A: 'timestamp', // First column is always timestamp
        ...columnMappings
      };

      // Add custom field mappings
      customFields.forEach(cf => {
        allColumnMappings[cf.column] = cf.name;
      });

      const payload = {
        StationID: formData.stationId,
        ServicesID: formData.serviceType,
        DeviceID: formData.deviceId,
        station_name: formData.stationName,
        csv_folder_path: formData.csvFolderPath,
        column_mappings: allColumnMappings,
        selected_fields: selectedFields,
        custom_fields: customFields.length > 0 ? customFields : null,
        Longitude: formData.longitude || null,
        Latitude: formData.latitude || null,
        Country: formData.country || null,
        State: formData.state || null,
        District: formData.district || null,
        PinCode: formData.pinCode || null
      };

      const response = await fetch(`${backendUrl}/api/stations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();

      if (result.success) {
        showAlert('Station registered successfully!', 'success');
        // Reset form
        setFormData({
          serviceType: '',
          stationId: '',
          stationName: '',
          deviceId: '',
          csvFolderPath: '',
          longitude: '',
          latitude: '',
          country: '',
          state: '',
          district: '',
          pinCode: ''
        });
        setSelectedFields([]);
        setColumnMappings({});
        setCustomFields([]);
        setCurrentStep(1);
        // Optionally redirect to management page
        setTimeout(() => {
          router.push('/admin/station-management');
        }, 2000);
      } else {
        showAlert(result.error || 'Failed to register station', 'error');
      }
    } catch (error) {
      console.error('Error registering station:', error);
      const errorMessage = error.message || 'An error occurred while registering the station';
      showAlert(
        errorMessage.includes('404') || errorMessage.includes('Not Found')
          ? 'API endpoint not found. Please ensure the backend server is running and has been restarted to load the new routes.'
          : errorMessage,
        'error'
      );
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const standardFields = formData.serviceType === 'AWS' ? AWS_STANDARD_FIELDS : EWS_STANDARD_FIELDS;

  if (loading) {
    return <LoadingSpinner message="Registering station..." />;
  }

  return (
    <AdminLayout title="Register New Station" subtitle="Add a new station with CSV column mapping">
      <div className="w-full max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-10">
          {/* Stepper */}
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
                          ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-300 text-gray-400"
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

          <form onSubmit={handleSubmit}>
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Service Type */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Service Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="serviceType"
                          value="AWS"
                          checked={formData.serviceType === 'AWS'}
                          onChange={handleServiceTypeChange}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-700">AWS (Weather Station)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="serviceType"
                          value="EWS"
                          checked={formData.serviceType === 'EWS'}
                          onChange={handleServiceTypeChange}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-700">EWS (Barrage Monitoring)</span>
                      </label>
                    </div>
        </div>
            
            {/* Station ID */}
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Station ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="stationId"
                value={formData.stationId}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., ST021"
                required
              />
            </div>

            {/* Station Name */}
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Station Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="stationName"
                value={formData.stationName}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., New Station"
                required
              />
            </div>

                  {/* Device ID */}
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Device ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                      name="deviceId"
                      value={formData.deviceId}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 31931"
                required
              />
            </div>

                  {/* CSV Folder Path */}
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CSV Folder Path <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                      name="csvFolderPath"
                      value={formData.csvFolderPath}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., /Hydrology_Backup/NewStation_AWS"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Full path to the folder containing CSV files</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={!formData.serviceType || !formData.stationId || !formData.stationName || !formData.deviceId || !formData.csvFolderPath}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next: Location
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Location Information */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Location Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Longitude</label>
                    <input
                      type="text"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 79.452111"
              />
            </div>
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Latitude</label>
              <input
                type="text"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 30.7880086"
              />
            </div>
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., India"
              />
            </div>
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Uttarakhand"
              />
            </div>
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">District</label>
              <input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Chamoli"
              />
            </div>
            <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Pin Code</label>
              <input
                type="text"
                name="pinCode"
                value={formData.pinCode}
                onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 246422"
              />
                  </div>
            </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Previous
                  </button>
              <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Next: Field Mapping
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Field Selection & Column Mapping */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Field Selection & Column Mapping</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Select which fields to track and map them to CSV columns (A, B, C, D...). 
                  Column A is typically the timestamp column.
                </p>

                {/* Standard Fields */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Standard Fields</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {standardFields.map((field) => (
                      <div key={field.name} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <input
                          type="checkbox"
                          id={`field-${field.name}`}
                          checked={selectedFields.includes(field.name)}
                          onChange={() => handleFieldToggle(field.name)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={`field-${field.name}`} className="flex-1 cursor-pointer">
                          <span className="font-medium text-gray-700">{field.label}</span>
                          <span className="text-xs text-gray-500 ml-2">({field.name})</span>
                        </label>
                        {selectedFields.includes(field.name) && (
                          <div className="flex gap-2 items-center">
                            <select
                              value={columnMappings[field.name] || ''}
                              onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                  // Show custom input
                                  const customValue = prompt('Enter custom column letter (e.g., A, B, AA, AB):');
                                  if (customValue && customValue.trim()) {
                                    handleColumnMappingChange(field.name, customValue.trim().toUpperCase());
                                  }
                                } else {
                                  handleColumnMappingChange(field.name, e.target.value);
                                }
                              }}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select column...</option>
                              {COLUMN_LETTERS.map(letter => (
                                <option key={letter} value={letter}>Column {letter}</option>
                              ))}
                              <option value="__custom__">--- Custom ---</option>
                            </select>
                            {columnMappings[field.name] && !COLUMN_LETTERS.includes(columnMappings[field.name]) && (
                              <span className="text-xs text-gray-500">({columnMappings[field.name]})</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">Custom Fields</h4>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      + Add Custom Field
              </button>
            </div>

                  {customFields.length === 0 ? (
                    <p className="text-sm text-gray-600">No custom fields added yet</p>
                  ) : (
                    <div className="space-y-3">
                      {customFields.map((field, index) => (
                        <div key={index} className="flex gap-3 items-end p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Field Name</label>
                            <input
                              type="text"
                              value={field.name}
                              onChange={(e) => handleCustomFieldChange(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="e.g., custom_metric"
                            />
                          </div>
                          <div className="w-32">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Data Type</label>
                            <select
                              value={field.type}
                              onChange={(e) => handleCustomFieldChange(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                              <option value="DECIMAL(5,2)">DECIMAL(5,2)</option>
                              <option value="DOUBLE">DOUBLE</option>
                              <option value="VARCHAR(100)">VARCHAR(100)</option>
                              <option value="INT">INT</option>
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="block text-xs font-medium text-gray-700 mb-1">CSV Column</label>
                            <div className="flex gap-2 items-center">
                              <select
                                value={field.column}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    const customValue = prompt('Enter custom column letter (e.g., A, B, AA, AB):');
                                    if (customValue && customValue.trim()) {
                                      handleCustomFieldChange(index, 'column', customValue.trim().toUpperCase());
                                    }
                                  } else {
                                    handleCustomFieldChange(index, 'column', e.target.value);
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                {COLUMN_LETTERS.map(letter => (
                                  <option key={letter} value={letter}>Column {letter}</option>
                                ))}
                                <option value="__custom__">--- Custom ---</option>
                              </select>
                              {field.column && !COLUMN_LETTERS.includes(field.column) && (
                                <span className="text-xs text-gray-500">({field.column})</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(index)}
                            className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    disabled={selectedFields.length === 0}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next: Review
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Review & Submit */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Review & Submit</h3>
                
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-600">Service Type:</span> <span className="font-medium">{formData.serviceType}</span></div>
                      <div><span className="text-gray-600">Station ID:</span> <span className="font-medium">{formData.stationId}</span></div>
                      <div><span className="text-gray-600">Station Name:</span> <span className="font-medium">{formData.stationName}</span></div>
                      <div><span className="text-gray-600">Device ID:</span> <span className="font-medium">{formData.deviceId}</span></div>
                      <div className="md:col-span-2"><span className="text-gray-600">CSV Path:</span> <span className="font-medium">{formData.csvFolderPath}</span></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Location</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-600">Coordinates:</span> <span className="font-medium">{formData.latitude}, {formData.longitude}</span></div>
                      <div><span className="text-gray-600">Location:</span> <span className="font-medium">{formData.district}, {formData.state}, {formData.country}</span></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Field Mappings</h4>
                    <div className="space-y-2 text-sm">
                      {selectedFields.map(field => {
                        const fieldLabel = standardFields.find(f => f.name === field)?.label || field;
                        return (
                          <div key={field} className="flex justify-between">
                            <span className="text-gray-600">{fieldLabel}:</span>
                            <span className="font-medium">Column {columnMappings[field]}</span>
                          </div>
                        );
                      })}
                      {customFields.map((field, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-gray-600">{field.name} (custom):</span>
                          <span className="font-medium">Column {field.column} ({field.type})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Registering...' : 'Register Station'}
                  </button>
          </div>
              </motion.div>
            )}
        </form>
      </div>
    </div>
    </AdminLayout>
  );
};

export default StationForm;
