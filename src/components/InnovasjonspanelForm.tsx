'use client';

import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AIHelpBox from './AIHelpBox';
import ImageUpload from './ImageUpload';
import InfoBox from './InfoBox';

interface InnovasjonspanelInput {
  title: string;
  description: string;
  targetAudience: string;
  needsProblem: string;
  valueProposition: string;
  comment?: string;
}

export default function InnovasjonspanelForm() {
  const { username } = useAuth();
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<InnovasjonspanelInput>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // AI-spesifikke states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const isBusy = isSubmitting || isAnalyzing;

  // Watch form fields for real-time validation
  const title = watch('title');
  const description = watch('description');
  const targetAudience = watch('targetAudience');
  const needsProblem = watch('needsProblem');
  const valueProposition = watch('valueProposition');
  const comment = watch('comment');

  // Check if form is valid (all required fields filled)
  const hasAllFields =
    !!title?.trim() &&
    !!description?.trim() &&
    !!targetAudience?.trim() &&
    !!needsProblem?.trim() &&
    !!valueProposition?.trim();

  const hasImage = selectedFiles.length > 0;

  const isFormValid = hasAllFields && hasImage && !isBusy;


  // Check if AI can be used
  const canUseAI = (comment?.trim() || imagePreviews.length > 0) && !isBusy;

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

    const userComment = watch('comment') || '';

    // Minst én av prompt eller bilde må være satt
    if (!userComment.trim() && imagePreviews.length === 0) {
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
          comment: userComment.trim() || undefined
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
    setValue('targetAudience', aiSuggestions.targetAudience);
    setValue('needsProblem', aiSuggestions.needsProblem);
    setValue('valueProposition', aiSuggestions.valueProposition);
    
    setShowAiPanel(false);
    setSuccessMessage('✨ AI-forslag er lagt til!');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const dismissAiSuggestions = () => {
    setAiSuggestions(null);
    setShowAiPanel(false);
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

  const onSubmit = async (data: InnovasjonspanelInput) => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Vennligst last opp minst ett bilde');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Last opp bilder til Cloudinary
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error('Bildeopplasting er ikke konfigurert');
      }

      const imageUrls: string[] = [];
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

      // Send til API
      const response = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description.trim(),
          targetAudience: data.targetAudience.trim(),
          needsProblem: data.needsProblem.trim(),
          valueProposition: data.valueProposition.trim(),
          type: 'Ide klar for vurdering til innovasjonsporteføljen',
          submitter: username || 'Anonym',
          imageUrls,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kunne ikke sende inn idé');
      }

      setSuccessMessage('🎉 Idé sendt til innovasjonspanelet!');
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
      {/* Intro-boks */}
      <InfoBox
        icon=""
        title="Send idé til vurdering"
        description="Har du en konkret idé som kan utvikles videre som innovasjonsprosjekt hos BAMA? Alle forslag vurderes og prioriteres av innovasjonspanelet. Idé-eier kontaktes ved behov for mer info eller når idéen tas videre til utforsking. Fyll ut feltene så godt du kan eller bruk AI for hjelp."
      />

      {/* Success/Error messages */}
      {successMessage && (
        <InfoBox
          icon="🎉"
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
        isAnalyzing={isAnalyzing}
        isBusy={isBusy}
        onAnalyze={analyzeWithAI}
        aiSuggestions={aiSuggestions}
        showAiPanel={showAiPanel}
        onApplySuggestions={applyAiSuggestions}
        onDismissSuggestions={dismissAiSuggestions}
        useRegister={register}
        commentFieldName="comment"
        registeredValue={comment}   // NY linje
        hasImage={imagePreviews.length > 0}
        promptPlaceholder="F.eks. 'Ferdigkuttet grønnsaksmiks klar til å bli suppe'"
        analysisDescription="Beskriv kort din idé eller last opp bilde. Du kan bruke bare tekst, bare bilde, eller begge deler."
      />

      {/* Required Fields */}
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="flex items-center gap-2 text-sm sm:text-base font-medium text-gray-700">
            <span>💡</span> Tittel *
          </label>
          <input
            id="title"
            type="text"
            {...register('title', { required: 'Tittel er påkrevd', minLength: { value: 2, message: 'Tittel må være minst 2 tegn' } })}
            placeholder="En kort, beskrivende tittel"
            disabled={isBusy}
            className="mt-1.5"
            autoComplete="off"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="description" className="flex items-center gap-2 text-sm sm:text-base font-medium text-gray-700">
            <span>💭</span> Beskrivelse *
          </label>
          <textarea
            id="description"
            rows={4}
            {...register('description', { required: 'Beskrivelse er påkrevd' })}
            placeholder="Beskriv ideen i detalj..."
            disabled={isBusy}
            className="mt-1.5"
          />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
        </div>

        <div>
          <label htmlFor="targetAudience" className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span>🎯</span> Målgruppe / Kunde *
          </label>
          <textarea
            id="targetAudience"
            rows={2}
            {...register('targetAudience', { required: 'Målgruppe er påkrevd' })}
            placeholder="Hvem er denne ideen for?"
            disabled={isBusy}
            className="mt-1.5"
          />
          {errors.targetAudience && <p className="mt-1 text-sm text-red-600">{errors.targetAudience.message}</p>}
        </div>

        <div>
          <label htmlFor="needsProblem" className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span>❗</span> Behov / Problem *
          </label>
          <textarea
            id="needsProblem"
            rows={2}
            {...register('needsProblem', { required: 'Behov/Problem er påkrevd' })}
            placeholder="Hvilket problem løser dette?"
            disabled={isBusy}
            className="mt-1.5"
          />
          {errors.needsProblem && <p className="mt-1 text-sm text-red-600">{errors.needsProblem.message}</p>}
        </div>

        <div>
          <label htmlFor="valueProposition" className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span>💎</span> Verdiforslag *
          </label>
          <textarea
            id="valueProposition"
            rows={2}
            {...register('valueProposition', { required: 'Verdiforslag er påkrevd' })}
            placeholder="Hva er verdien for kunden?"
            disabled={isBusy}
            className="mt-1.5"
          />
          {errors.valueProposition && <p className="mt-1 text-sm text-red-600">{errors.valueProposition.message}</p>}
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
                <span>🚀</span> Send til vurdering
              </span>
            )}
          </button>
{!isBusy && (
  <>
    {!hasAllFields && (
      <p className="text-xs text-red-600 mt-2 text-left opacity-0 group-hover/submit:opacity-100 transition-opacity duration-200">
        Fyll ut alle påkrevde felter
      </p>
    )}
    {hasAllFields && !hasImage && (
      <p className="text-xs text-red-600 mt-2 text-left opacity-0 group-hover/submit:opacity-100 transition-opacity duration-200">
        Legg ved minst ett bilde
      </p>
    )}
  </>
)}
    </div>
</div>
    </form>
  );
}

