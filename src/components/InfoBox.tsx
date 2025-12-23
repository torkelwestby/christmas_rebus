'use client';

interface InfoBoxProps {
  icon: string;
  title: string;
  description: string;
  variant?: 'default' | 'success' | 'error';
}

export default function InfoBox({
  icon,
  title,
  description,
  variant = 'default'
}: InfoBoxProps) {
  const variantStyles = {
    default: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200',
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200'
  };

  const textStyles = {
    default: 'text-gray-900',
    success: 'text-green-700',
    error: 'text-red-700'
  };

  return (
    <div className={`${variantStyles[variant]} border-2 rounded-xl p-4 ${variant !== 'default' ? 'text-center' : ''}`}>
      <div className={`flex items-start gap-3 ${variant !== 'default' ? 'justify-center' : ''}`}>
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <h3 className={`font-semibold ${textStyles[variant]} ${description ? 'mb-2' : ''}`}>{title}</h3>
          {description && (
            <p className={`text-sm ${variant === 'default' ? 'text-gray-700' : textStyles[variant]}`}>
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
