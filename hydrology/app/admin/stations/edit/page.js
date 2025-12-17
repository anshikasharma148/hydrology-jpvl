'use client';
import { Suspense } from 'react';
import EditStationForm from './EditStationForm';
import LoadingSpinner from '../../../../components/LoadingSpinner';

export default function EditStationPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading edit page..." />}>
      <EditStationForm />
    </Suspense>
  );
}
