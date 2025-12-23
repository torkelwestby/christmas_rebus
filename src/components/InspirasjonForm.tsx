'use client';

import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AIHelpBox from './AIHelpBox';
import ImageUpload from './ImageUpload';
import InfoBox from './InfoBox';

interface InspirasjonInput {
  title?: string;
  description?: string;
  comment?: string;
}

export default function InspirasjonForm() {
  const { username } = useAuth();
  const { register, handleSubmit, reset, formState: { errors }, watch, setValue } = useForm<InspirasjonInput>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // AI-spesifikke states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const isBusy = isSubmitting || isAnalyzing;

  // Watch form fields for real-time validation
  const title = watch('title');
  const description = watch('description');

  // Check if form is valid (at least title or description)
  const isFormValid = (title?.trim() || description?.trim()) && !isBusy;

  // Compress and resize image
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const maxSize = 1200;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Komprimering feilet'));
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + selectedFiles.length > 5) {
      setErrorMessage('Du kan maks laste opp 5 bilder');
      return;
    }

    setErrorMessage('');
    
    try {
      const compressedFiles = await Promise.all(
        files.map(file => compressImage(file))
      );
      
      const tooLarge = compressedFiles.filter(f => f.size > 4 * 1024 * 1024);
      if (tooLarge.length > 0) {
        setErrorMessage('Noen bilder er for store selv etter komprimering. Prøv mindre bilder.');
        return;
      }

      const newFiles = [...selectedFiles, ...compressedFiles];
      setSelectedFiles(newFiles);

      const newPreviews: string[] = [];
      for (const file of newFiles) {
        const reader = new FileReader();
        const preview = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newPreviews.push(preview);
      }
      setImagePreviews(newPreviews);
    } catch (error) {
      console.error('Image compression error:', error);
      setErrorMessage('Kunne ikke behandle bildene. Prøv andre bilder.');
    }
  };

  const analyzeWithAI = async () => {
    if (isAnalyzing) return;

    // Minst én av prompt eller bilde må være satt
    if (!aiPrompt.trim() && imagePreviews.length === 0) {
      setErrorMessage('Legg til en beskrivelse eller et bilde for å få AI-hjelp');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage('');
    setShowAiPanel(true);

    try {
      const aiResponse = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: imagePreviews.length > 0 ? imagePreviews[0] : undefined,
          comment: aiPrompt.trim() || undefined
        })
      });

      if (!aiResponse.ok) {
        const { error } = await aiResponse.json().catch(() => ({ error: 'AI-feil' }));
        if (aiResponse.status === 429) {
          setErrorMessage(error || 'AI-kvoten er brukt opp.');
          setShowAiPanel(false);
          return;
        }
        throw new Error(error || 'AI-analyse feilet');
      }

      const aiData = await aiResponse.json();
      setAiSuggestions(aiData.analysis);

    } catch (error) {
      console.error('AI analysis error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke analysere. Prøv igjen.');
      setShowAiPanel(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAiSuggestions = () => {
    if (!aiSuggestions) return;

    setValue('title', aiSuggestions.title);
    setValue('description', aiSuggestions.description);

    setShowAiPanel(false);
    setAiPrompt('');
    setSuccessMessage('✨ AI-forslag er lagt til!');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const dismissAiSuggestions = () => {
    setAiSuggestions(null);
    setShowAiPanel(false);
    setAiPrompt('');
  };

  const removeImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setImagePreviews(newPreviews);
    
    if (index === 0) {
      setShowAiPanel(false);
      setAiSuggestions(null);
    }
  };

  const onSubmit = async (data: InspirasjonInput) => {
    const title = data.title?.trim() || '';
    const description = data.description?.trim() || '';

    // Minst ett av feltene må være utfylt (should not happen with button disabled, but just in case)
    if (!title && !description) {
      setErrorMessage('Fyll inn tittel eller beskrivelse');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      let imageUrls: string[] = [];

      // Last opp bilder hvis de finnes
      if (selectedFiles.length > 0) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
          throw new Error('Bildeopplasting er ikke konfigurert');
        }

        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', uploadPreset);

          const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            { method: 'POST', body: formData }
          );

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            imageUrls.push(uploadData.secure_url);
          }
        }
      }

      // Lag tittel hvis bare beskrivelse er satt
      const finalTitle = title || description.substring(0, 50) + (description.length > 50 ? '...' : '');

      const response = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          description: description || undefined,
          type: 'Inspirasjon',
          submitter: username || 'Anonym',
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kunne ikke sende inn idé');
      }

      setSuccessMessage('✨ Inspirasjon sendt inn!');
      reset();
      setImagePreviews([]);
      setSelectedFiles([]);
      setAiSuggestions(null);
      setShowAiPanel(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Kunne ikke sende inn idé'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Info panel */}
      <InfoBox
        icon=""
        title="Del inspirasjon fra verden rundt deg"
        description="Sett en trend? Oppdaget en kundeinnsikt? Del idéer og observasjoner som kan inspirere nye initiativer hos BAMA."
      />

      {/* Success/Error messages */}
      {successMessage && (
        <InfoBox
          icon="✨"
          title={successMessage}
          description=""
          variant="success"
        />
      )}

      {errorMessage && (
        <InfoBox
          icon="⚠️"
          title="Obs!"
          description={errorMessage}
          variant="error"
        />
      )}

      {/* Bildeopplasting */}
      <ImageUpload
        imagePreviews={imagePreviews}
        selectedFiles={selectedFiles}
        onFileChange={handleFileChange}
        onRemoveImage={removeImage}
        disabled={isBusy}
        maxImages={5}
        label="Bilder"
        required={false}
      />

      {/* AI-hjelp komponent */}
      <AIHelpBox
        aiPrompt={aiPrompt}
        onPromptChange={setAiPrompt}
        isAnalyzing={isAnalyzing}
        isBusy={isBusy}
        onAnalyze={analyzeWithAI}
        aiSuggestions={aiSuggestions}
        showAiPanel={showAiPanel}
        onApplySuggestions={applyAiSuggestions}
        onDismissSuggestions={dismissAiSuggestions}
        hasImage={imagePreviews.length > 0}
        promptPlaceholder="F.eks. 'Ny pappemballasje for bær med bedre ventilasjon'"
        analysisDescription="Beskriv kort hva du ser eller tenker. Last opp bilde om du vil. Du kan bruke bare tekst, bare bilde, eller begge deler."
      />

      {/* Tittel og beskrivelse – minst én kreves */}
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="flex items-center gap-2 text-sm sm:text-base font-medium text-gray-700">
            <span>💡</span> Tittel <span className="text-xs text-gray-500 font-normal">(tittel eller beskrivelse må fylles ut)</span>
          </label>
          <input
            id="title"
            type="text"
            {...register('title')}
            placeholder="Kort og beskrivende tittel"
            disabled={isBusy}
            className="mt-1.5"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="description" className="flex items-center gap-2 text-sm sm:text-base font-medium text-gray-700">
            <span>💭</span> Beskrivelse <span className="text-xs text-gray-500 font-normal">(tittel eller beskrivelse må fylles ut)</span>
          </label>
          <textarea
            id="description"
            rows={4}
            {...register('description')}
            placeholder="Beskriv ideen kort"
            disabled={isBusy}
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Submit button */}
      <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-2">
        <div className="relative group/submit">
          <button
            type="submit"
            disabled={!isFormValid}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none text-white py-3 sm:py-4 px-6 rounded-xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl disabled:shadow-md transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Sender inn...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>✨</span> Last opp inspirasjon
              </span>
            )}
          </button>

          {!isBusy && (
            <>
              {!isFormValid && (
                <p className="text-xs text-red-600 mt-2 text-left opacity-0 group-hover/submit:opacity-100 transition-opacity duration-200">
                  Fyll ut tittel eller beskrivelse
                </p>
              )}
            </>
          )}
        </div>
      </div>

    </form>
  );
}



