'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';
import FormTypeSelector from '@/components/FormTypeSelector';
import InspirasjonForm from '@/components/InspirasjonForm';
import InnovasjonspanelForm from '@/components/InnovasjonspanelForm';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [formType, setFormType] = useState<'inspirasjon' | 'innovasjonspanel'>('inspirasjon');

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="max-w-3xl mx-auto container-padding py-8 sm:py-12">
      {/* Hero section */}
      <div className="mb-8 text-center">
        <div className="inline-block mb-4">
          <span className="text-6xl">💡</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Send inn en idé
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Del en rask inspirasjon eller send en fullstendig idé til innovasjonspanelet
        </p>
      </div>

      {/* Form type selector */}
      <div className="mb-6">
        <FormTypeSelector 
          selectedType={formType} 
          onTypeChange={setFormType} 
        />
      </div>

      {/* Form */}
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg border-2 border-gray-200/50 p-6 sm:p-8">
        {formType === 'inspirasjon' ? (
          <InspirasjonForm />
        ) : (
          <InnovasjonspanelForm />
        )}
      </div>
    </div>
  );
}