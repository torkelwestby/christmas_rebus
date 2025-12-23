'use client';

import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

interface VurderingInput {
  title: string;
  description?: string;
  comment?: string;
  targetAudience?: string;
  needsProblem?: string;
  valueProposition?: string;
  stage?: string;
}

export default function VurderingForm() {
  const { username } = useAuth();
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<VurderingInput>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // AI-spesifikke states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const isBusy = isSubmitting || isAnalyzing;

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
    if (isAnalyzing || imagePreviews.length === 0) return; 
    
    setIsAnalyzing(true);
    setErrorMessage('');
    setShowAiPanel(true);
    
    try {
      const userComment = watch('comment') || '';

      const aiResponse = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageDataUrl: imagePreviews[0],
          comment: userComment 
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
      setShowAdvanced(true);

    } catch (error) {
      console.error('AI analysis error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke analysere bildet.');
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

  const onSubmit = async (data: VurderingInput) => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Vennligst last opp minst ett bilde');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Upload to Cloudinary FIRST (same as InspirasjonForm)
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error('Bildeopplasting er ikke konfigurert. Kontakt administrator.');
      }

      console.log('Laster opp bilder til Cloudinary...');
      
      const imageUrls: string[] = [];
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const cloudinaryResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!cloudinaryResponse.ok) {
          throw new Error('Bildeopplasting feilet');
        }

        const cloudinaryData = await cloudinaryResponse.json();
        imageUrls.push(cloudinaryData.secure_url);
      }

      console.log('Bilder lastet opp:', imageUrls);

      // Now send to Airtable with URLs
      const response = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description?.trim(),
          targetAudience: data.targetAudience?.trim(),
          needsProblem: data.needsProblem?.trim(),
          valueProposition: data.valueProposition?.trim(),
          stage: data.stage,
          type: 'Ide klar for vurdering til innovasjonsporteføljen',
          submitter: username || 'Anonym',
          imageUrls,
        }),
      });

      const responseData = await response.json().catch(() => ({ error: 'Ukjent feil' }));

      if (!response.ok) {
        console.error('API Error:', responseData);
        throw new Error(responseData.error || `Serverfeil (${response.status})`);
      }

      console.log('Success:', responseData);

      setSuccessMessage('✨ Idé sendt til vurdering!');
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
      {successMessage && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center animate-in slide-in-from-top-2">
          <p className="text-green-700 font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {showAiPanel && aiSuggestions && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border-2 border-purple-200 p-6 animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl">✨</span>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-2">AI-forslag basert på bildet</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Tittel:</span>
                  <p className="text-gray-600 mt-1">{aiSuggestions.title}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Beskrivelse:</span>
                  <p className="text-gray-600 mt-1">{aiSuggestions.description}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Målgruppe:</span>
                  <p className="text-gray-600 mt-1">{aiSuggestions.targetAudience}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Behov:</span>
                  <p className="text-gray-600 mt-1">{aiSuggestions.needsProblem}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Verdiforslag:</span>
                  <p className="text-gray-600 mt-1">{aiSuggestions.valueProposition}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={applyAiSuggestions}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all"
            >
              ✅ Bruk forslagene
            </button>
            <button
              type="button"
              onClick={dismissAiSuggestions}
              className="px-4 py-2.5 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all"
            >
              ❌ Avvis
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
          📷 Bilder (maks 5) *
        </label>
        
        {imagePreviews.length < 5 && (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 sm:p-8 text-center hover:border-primary-500 hover:bg-primary-50/50 transition-all">
              <span className="text-4xl sm:text-5xl mb-2 sm:mb-3 block">📸</span>
              <span className="text-sm sm:text-base font-medium text-gray-700 block mb-1">
                Klikk for å laste opp ({imagePreviews.length}/5)
              </span>
              <span className="text-xs sm:text-sm text-gray-500">
                Velg flere bilder samtidig • Maks 4 MB per bilde
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={isBusy}
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
                  onClick={() => removeImage(index)}
                  disabled={isBusy}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {imagePreviews.length > 0 && !aiSuggestions && (
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">🤖</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Vil du ha hjelp fra AI?</h4>
                <p className="text-xs sm:text-sm text-gray-600 mb-3">
                  AI kan analysere bildet og foreslå innhold. Helt valgfritt!
                </p>
                
                <div className="mb-3">
                  <label htmlFor="comment" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    💬 Ekstra kontekst til AI (valgfri)
                  </label>
                  <textarea
                    id="comment"
                    rows={2}
                    {...register('comment')}
                    placeholder="F.eks. 'Dette er et nytt energidrikke-konsept'..."
                    disabled={isBusy}
                    className="w-full text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={analyzeWithAI}
                  disabled={isBusy}
                  className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Analyserer...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Analyser med AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="flex items-center gap-2 text-sm sm:text-base">
            <span>💡</span> Tittel *
          </label>
          <input
            id="title"
            type="text"
            {...register('title', { required: true, minLength: 2 })}
            placeholder="En kort, beskrivende tittel"
            disabled={isBusy}
            className="mt-1.5"
            autoComplete="off"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">Tittel må være minst 2 tegn</p>}
        </div>

        <div>
          <label htmlFor="description" className="flex items-center gap-2 text-sm sm:text-base">
            <span>💭</span> Beskrivelse
          </label>
          <textarea
            id="description"
            rows={4}
            {...register('description')}
            placeholder="Beskriv ideen din..."
            disabled={isBusy}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
        >
          <span className="transform transition-transform" style={{ display: 'inline-block', transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          Flere detaljer (valgfritt)
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
            <div>
              <label htmlFor="targetAudience" className="flex items-center gap-2 text-sm">
                <span>🎯</span> Målgruppe / Kunde
              </label>
              <textarea
                id="targetAudience"
                rows={2}
                {...register('targetAudience')}
                placeholder="Hvem er denne ideen for?"
                disabled={isBusy}
                className="mt-1.5"
              />
            </div>

            <div>
              <label htmlFor="needsProblem" className="flex items-center gap-2 text-sm">
                <span>❗</span> Behov / Problem
              </label>
              <textarea
                id="needsProblem"
                rows={2}
                {...register('needsProblem')}
                placeholder="Hvilket problem løser dette?"
                disabled={isBusy}
                className="mt-1.5"
              />
            </div>

            <div>
              <label htmlFor="valueProposition" className="flex items-center gap-2 text-sm">
                <span>💎</span> Verdiforslag
              </label>
              <textarea
                id="valueProposition"
                rows={2}
                {...register('valueProposition')}
                placeholder="Hva er verdien for kunden?"
                disabled={isBusy}
                className="mt-1.5"
              />
            </div>

            <div>
              <label htmlFor="stage" className="flex items-center gap-2 text-sm">
                <span>📊</span> Stage
              </label>
              <select id="stage" {...register('stage')} disabled={isBusy} className="mt-1.5">
                <option value="">Velg stage</option>
                <option value="Idégenerering">Idégenerering</option>
                <option value="Idéutforsking">Idéutforsking</option>
                <option value="Problem/Løsning">Problem/Løsning</option>
                <option value="Produkt/Marked">Produkt/Marked</option>
                <option value="Skalering">Skalering</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-2">
        <button
          type="submit"
          disabled={isBusy || imagePreviews.length === 0}
          className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 sm:py-4 px-6 rounded-xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
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
      </div>
    </form>
  );
}