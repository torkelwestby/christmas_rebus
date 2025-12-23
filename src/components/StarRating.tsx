'use client';

import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}

export default function StarRating({ value, onChange, label, disabled }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {value > 0 && (
          <span className="text-xs text-gray-500 font-medium">
            {value}/5
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => !disabled && setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            className="group relative focus:outline-none disabled:cursor-not-allowed"
          >
            <svg
              className={`w-8 h-8 transition-all duration-150 ${
                star <= displayValue
                  ? 'text-yellow-400 fill-yellow-400 scale-110'
                  : 'text-gray-300 fill-gray-300 group-hover:text-yellow-200 group-hover:scale-105'
              } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        ))}
        {value > 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="ml-2 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Nullstill
          </button>
        )}
      </div>
    </div>
  );
}