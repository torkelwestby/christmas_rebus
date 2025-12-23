'use client';

interface FormTypeSelectorProps {
  selectedType: 'inspirasjon' | 'innovasjonspanel';
  onTypeChange: (type: 'inspirasjon' | 'innovasjonspanel') => void;
}

export default function FormTypeSelector({ selectedType, onTypeChange }: FormTypeSelectorProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-gray-200 p-2 flex gap-2">
      <button
        type="button"
        onClick={() => onTypeChange('inspirasjon')}
        className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
          selectedType === 'inspirasjon'
            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg scale-105'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">✨</span>
          <span>Last opp inspirasjon</span>
          <span className="text-xs opacity-80 font-normal">
            Del trender, innsikter og idéer
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onTypeChange('innovasjonspanel')}
        className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
          selectedType === 'innovasjonspanel'
            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg scale-105'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl">🚀</span>
          <span>Send til vurdering</span>
          <span className="text-xs opacity-80 font-normal">
            Konkrete idéer til panelet
          </span>
        </div>
      </button>
    </div>
  );
}