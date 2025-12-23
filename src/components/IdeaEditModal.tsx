'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import type { IdeaInput } from '@/lib/schemas';
import { AIRTABLE_FIELDS } from '@/lib/schemas';
import Image from 'next/image';

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface IdeaEditModalProps {
  idea: AirtableRecord;
  onClose: () => void;
  onSuccess: (updatedIdea: AirtableRecord) => void;
}

export default function IdeaEditModal({ idea, onClose, onSuccess }: IdeaEditModalProps) {
  const { isAdmin } = useAuth();
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<IdeaInput>({
    defaultValues: {
      title: idea.fields[AIRTABLE_FIELDS.TITLE] || '',
      description: idea.fields[AIRTABLE_FIELDS.DESCRIPTION] || '',
      type: idea.fields[AIRTABLE_FIELDS.TYPE] || '',
      stage: idea.fields[AIRTABLE_FIELDS.STAGE] || '',
      submitter: idea.fields[AIRTABLE_FIELDS.SUBMITTER] || '',
      targetAudience: idea.fields[AIRTABLE_FIELDS.TARGET_AUDIENCE] || '',
      needsProblem: idea.fields[AIRTABLE_FIELDS.NEEDS_PROBLEM] || '',
      valueProposition: idea.fields[AIRTABLE_FIELDS.VALUE_PROPOSITION] || '',
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(
    !!(idea.fields[AIRTABLE_FIELDS.TARGET_AUDIENCE] || 
       idea.fields[AIRTABLE_FIELDS.NEEDS_PROBLEM] || 
       idea.fields[AIRTABLE_FIELDS.VALUE_PROPOSITION])
  );

  // Rolle-sjekk først
  if (!isAdmin) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
            <span className="text-3xl">🔒</span>
          </div>

          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
            Ingen tilgang
          </h3>

          <p className="text-gray-600 text-center mb-6">
            Du har ikke tilgang til å redigere ideer. Kun administratorer kan gjøre endringer.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            Lukk
          </button>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">💡 Tips:</span> Kontakt en administrator hvis du trenger å gjøre endringer på denne ideen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = isSubmitting || uploadProgress;

  // Eksisterende bilder fra Airtable
  const existingImages = idea.fields[AIRTABLE_FIELDS.IMAGE] || [];
  const [imagePreviews, setImagePreviews] = useState<string[]>(
    existingImages.map((img: any) => img.thumbnails?.large?.url || img.url)
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedImageUrls, setRemovedImageUrls] = useState<string[]>([]);

  // Håndter nye bilder
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const totalImages = imagePreviews.length + files.length;
    if (totalImages > 5) {
      setErrorMessage('Du kan maks ha 5 bilder totalt');
      return;
    }

    const invalidFiles = files.filter(f => f.size > 6 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      setErrorMessage('Alle bilder må være mindre enn 6 MB');
      return;
    }

    setErrorMessage('');
    
    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    // Generer forhåndsvisninger for nye filer
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Fjern et bilde (eksisterende eller nytt)
  const removeImage = (index: number) => {
    const imageToRemove = imagePreviews[index];
    
    // Hvis det er et eksisterende bilde fra Airtable
    if (index < existingImages.length) {
      const originalUrl = existingImages[index].url;
      setRemovedImageUrls([...removedImageUrls, originalUrl]);
    } else {
      // Det er et nytt bilde som ikke er lastet opp ennå
      const newFileIndex = index - existingImages.length;
      setSelectedFiles(selectedFiles.filter((_, i) => i !== newFileIndex));
    }
    
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  // Last opp nye bilder til Cloudinary
  const uploadToCloudinary = async (files: File[]): Promise<string[]> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.error('Cloudinary config missing');
      return [];
    }

    setUploadProgress(true);
    const urls: string[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (response.ok) {
          const data = await response.json();
          urls.push(data.secure_url);
        }
      }
    } finally {
      setUploadProgress(false);
    }

    return urls;
  };

  const onSubmit = async (data: IdeaInput) => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      let imageUrls: string[] = [];

      // Behold eksisterende bilder som ikke ble fjernet
      const keptImages = existingImages.filter(
        (img: any) => !removedImageUrls.includes(img.url)
      );
      imageUrls = keptImages.map((img: any) => img.url);

      // Last opp nye bilder
      if (selectedFiles.length > 0) {
        const newUrls = await uploadToCloudinary(selectedFiles);
        imageUrls = [...imageUrls, ...newUrls];
      }

      // Send oppdatering til API
      const response = await fetch(`/api/ideas?id=${idea.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Noe gikk galt');
      }

      const updatedIdea = await response.json();
      onSuccess(updatedIdea);
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Kunne ikke oppdatere idé'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">Rediger idé</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Success/Error messages */}
        {errorMessage && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-center animate-in slide-in-from-top-2">
            <p className="text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Grunnleggende felter */}
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="flex items-center gap-2">
                <span>💡</span> Tittel *
              </label>
              <input
                id="title"
                type="text"
                {...register('title', { required: true, minLength: 2 })}
                disabled={isLoading}
                className="mt-1.5"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">Tittel må være minst 2 tegn</p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="flex items-center gap-2">
                <span>💭</span> Beskrivelse
              </label>
              <textarea
                id="description"
                rows={4}
                {...register('description')}
                disabled={isLoading}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="type" className="flex items-center gap-2">
                  <span>🏷️</span> Type
                </label>
                <select id="type" {...register('type')} disabled={isLoading} className="mt-1.5">
                  <option value="">Velg type</option>
                  <option value="Inspirasjon">💡 Inspirasjon</option>
                  <option value="Ide klar for vurdering til innovasjonsporteføljen">
                    ⭐ Klar for vurdering
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="submitter" className="flex items-center gap-2">
                  <span>👤</span> Innsender
                </label>
                <input
                  id="submitter"
                  type="text"
                  {...register('submitter')}
                  disabled={isLoading}
                  className="mt-1.5"
                />
              </div>

              <div>
                <label htmlFor="stage" className="flex items-center gap-2">
                  <span>📊</span> Stage
                </label>
                <select id="stage" {...register('stage')} disabled={isLoading} className="mt-1.5">
                  <option value="">Velg stage</option>
                  <option value="Idégenerering">Idégenerering</option>
                  <option value="Idéutforsking">Idéutforsking</option>
                  <option value="Problem/Løsning">Problem/Løsning</option>
                  <option value="Produkt/Marked">Produkt/Marked</option>
                  <option value="Skalering">Skalering</option>
                  <option value="Arkivert">Arkivert</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bilder */}
          <div>
            <label className="flex items-center gap-2 mb-2">
              <span>📷</span> Bilder (maks 5)
            </label>
            
            {imagePreviews.length < 5 && (
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary-500 hover:bg-primary-50/50 transition-all">
                  <span className="text-2xl mb-1 block">📸</span>
                  <span className="text-sm text-gray-600">
                    Klikk for å legge til bilder ({imagePreviews.length}/5)
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="hidden"
                />
              </label>
            )}

            {/* Forhåndsvisninger */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <div className="relative w-full h-24">
                      <Image
                        src={preview}
                        alt={`Bilde ${index + 1}`}
                        fill
                        className="object-cover rounded-lg border-2 border-gray-200"
                        sizes="(max-width: 768px) 33vw, 200px"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      disabled={isLoading}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Avanserte felter */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
            >
              <span className="transform transition-transform duration-200" style={{ display: 'inline-block', transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              Flere detaljer
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                <div>
                  <label htmlFor="targetAudience" className="flex items-center gap-2">
                    <span>🎯</span> Målgruppe / Kunde
                  </label>
                  <textarea
                    id="targetAudience"
                    rows={2}
                    {...register('targetAudience')}
                    disabled={isLoading}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label htmlFor="needsProblem" className="flex items-center gap-2">
                    <span>❗</span> Behov / Problem
                  </label>
                  <textarea
                    id="needsProblem"
                    rows={2}
                    {...register('needsProblem')}
                    disabled={isLoading}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label htmlFor="valueProposition" className="flex items-center gap-2">
                    <span>💎</span> Verdiforslag
                  </label>
                  <textarea
                    id="valueProposition"
                    rows={2}
                    {...register('valueProposition')}
                    disabled={isLoading}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Lagrer...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>💾</span> Lagre endringer
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}