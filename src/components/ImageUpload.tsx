'use client';

import Image from 'next/image';

interface ImageUploadProps {
  imagePreviews: string[];
  selectedFiles: File[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  disabled: boolean;
  maxImages?: number;
  label?: string;
  required?: boolean;
}

export default function ImageUpload({
  imagePreviews,
  selectedFiles,
  onFileChange,
  onRemoveImage,
  disabled,
  maxImages = 5,
  label = "Bilder",
  required = false
}: ImageUploadProps) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-2 text-sm sm:text-base font-medium">
        <span>📷</span> {label}{required ? ' *' : ''}
        <span className="text-xs text-gray-500 font-normal">
          ({required ? 'påkrevd, ' : 'valgfritt, '}maks {maxImages})
        </span>
      </label>

      {imagePreviews.length < maxImages && (
        <label className={`block ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
          <div className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${
            disabled
              ? 'border-gray-200 bg-gray-50'
              : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50/50'
          }`}>
            <span className="text-4xl sm:text-5xl mb-2 block">📸</span>
            <span className="text-sm sm:text-base font-medium text-gray-700 block mb-1">
              Last opp bilder
            </span>
            <span className="text-xs text-gray-500">
              Klikk for å velge ({imagePreviews.length}/{maxImages})
            </span>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onFileChange}
            disabled={disabled}
            className="hidden"
          />
        </label>
      )}

      {imagePreviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative group">
              <div className="relative w-full h-24 sm:h-28">
                <Image
                  src={preview}
                  alt={`Bilde ${index + 1}`}
                  fill
                  className="object-cover rounded-lg border-2 border-gray-200"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveImage(index)}
                disabled={disabled}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Fjern bilde"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
