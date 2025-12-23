'use client';

import { useForm } from 'react-hook-form';
import { useState } from 'react';
import type { IdeaInput } from '@/lib/schemas';
import StarRating from './StarRating';

export default function IdeaForm() {
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<IdeaInput>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRatings, setShowRatings] = useState(false);

  // AI
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const isBusy = isSubmitting || uploadProgress || isAnalyzing;

  // Ratings
  const strategicFit = watch('strategicFit');
  const consumerNeed = watch('consumerNeed');
  const businessPotential = watch('businessPotential');
  const feasibility = watch('feasibility');
  const launchTime = watch('launchTime');

  // Files
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      setErrorMessage('Du kan maks laste opp 5 bilder');
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

    // Auto-analyse første bilde hvis ingen tekst finnes
    const hasContent = watch('title') || watch('description');
    if (newPreviews.length > 0 && !hasContent) {
      analyzeWithAI(newPreviews[0]);
    }
  };

  // Cloudinary batch upload
  const uploadToCloudinary = async (files: File[]): Promise<string[]> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      console.error('Cloudinary config mangler');
      return [];
    }
    setUploadProgress(true);
    const urls: string[] = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
        if (!resp.ok) {
          const errTxt = await resp.text().catch(() => '');
          console.error('Cloudinary upload error:', errTxt);
          continue;
        }
        const data = await resp.json();
        urls.push(data.secure_url);
      }
    } finally {
      setUploadProgress(false);
    }
    return urls;
  };

  // AI analyse. Kan kjøres med kun prompt eller med bilde + prompt.
  const analyzeWithAI = async (imageDataUrl?: string) => {
    if (isAnalyzing) return;
    if (!imageDataUrl && !aiPrompt.trim()) {
      setErrorMessage('Skriv en kort beskrivelse eller last opp et bilde');
      return;
    }
    setIsAnalyzing(true);
    setErrorMessage('');
    setShowAiPanel(true);

    try {
      let imageUrl: string | undefined;

      if (imageDataUrl) {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) {
          setErrorMessage('Cloudinary er ikke konfigurert');
          setShowAiPanel(false);
          setIsAnalyzing(false);
          return;
        }
        const blob = await (await fetch(imageDataUrl)).blob();
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', uploadPreset);
        const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
        if (!uploadResponse.ok) {
          const errTxt = await uploadResponse.text().catch(() => '');
          console.error('Cloudinary upload error:', errTxt);
          throw new Error('Bildeopplasting feilet');
        }
        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.secure_url;
      }

      const aiResponse = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          comment: aiPrompt.trim() || undefined,
        }),
      });

      if (!aiResponse.ok) {
        const { error } = await aiResponse.json().catch(() => ({ error: 'AI-feil' }));
        if (aiResponse.status === 429) {
          setErrorMessage(error || 'AI-kvoten er brukt opp. Fyll ut feltene manuelt.');
          setShowAiPanel(false);
          return;
        }
        throw new Error(error || 'AI-analyse feilet');
      }

      const aiData = await aiResponse.json();
      setAiSuggestions(aiData.analysis);
      setShowAdvanced(true);
    } catch (err) {
      console.error('AI analysis error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Kunne ikke analysere nå.');
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
    setAiPrompt('');
    setSuccessMessage('AI-forslag lagt inn. Rediger før innsending.');
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

  const onSubmit = async (data: IdeaInput) => {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      let imageUrls: string[] = [];
      if (selectedFiles.length > 0) {
        imageUrls = await uploadToCloudinary(selectedFiles);
        if (imageUrls.length === 0 && selectedFiles.length > 0) {
          throw new Error('Bildeopplasting feilet');
        }
      }

      const submitData: any = { ...data };
      if (submitData.strategicFit === 0) delete submitData.strategicFit;
      if (submitData.consumerNeed === 0) delete submitData.consumerNeed;
      if (submitData.businessPotential === 0) delete submitData.businessPotential;
      if (submitData.feasibility === 0) delete submitData.feasibility;
      if (submitData.launchTime === 0) delete submitData.launchTime;

      const response = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submitData, imageUrls }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Noe gikk galt');
      }

      setSuccessMessage('Idé sendt inn');
      reset();
      setImagePreviews([]);
      setSelectedFiles([]);
      setShowAdvanced(false);
      setShowRatings(false);
      setAiSuggestions(null);
      setShowAiPanel(false);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke sende inn idé');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || uploadProgress;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Info */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🚀</span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">Send idé til vurdering</h3>
            <p className="text-sm text-gray-700 mb-2">
              Fyll ut feltene eller bruk AI som støtte.
            </p>
            <p className="text-sm text-gray-600">Alle forslag blir vurdert.</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          {errorMessage}
        </div>
      )}

      {/* Bilder */}
      <div>
        <label className="flex items-center gap-2 mb-2 text-sm sm:text-base font-medium">
          <span>📷</span> Bilder <span className="text-xs text-gray-500 font-normal">(valgfritt, maks 5)</span>
        </label>

        {imagePreviews.length < 5 && (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center hover:border-primary-500 hover:bg-primary-50/50 transition-all">
              <span className="text-4xl sm:text-5xl mb-2 block">📸</span>
              <span className="text-sm sm:text-base font-medium text-gray-700 block mb-1">
                Last opp bilder
              </span>
              <span className="text-xs text-gray-500">
                Klikk for å velge ({imagePreviews.length}/5)
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
                <img
                  src={preview}
                  alt={`Bilde ${index + 1}`}
                  className="w-full h-24 sm:h-28 object-cover rounded-lg border-2 border-gray-200"
                />
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

        {/* AI under kameraboksen. Alltid synlig. */}
        <div className="mt-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Få hjelp fra AI</h4>
              <p className="text-sm text-gray-600 mb-3">
                Skriv en kort beskrivelse. Legg til bilde om du vil. AI foreslår felter for deg.
              </p>

              <label htmlFor="aiPrompt" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                💬 Beskrivelse til AI
              </label>
              <textarea
                id="aiPrompt"
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="F.eks. app som hjelper ansatte å finne prosjektdata raskt"
                disabled={isBusy}
                className="w-full text-sm mb-3"
              />

              <button
                type="button"
                onClick={() => analyzeWithAI(imagePreviews[0])}
                disabled={isBusy || (!aiPrompt.trim() && imagePreviews.length === 0)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Analyserer</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Få AI-forslag</span>
                  </>
                )}
              </button>

              {/* Resultat/loader i samme seksjon */}
              {showAiPanel && (
                <div className="mt-4 rounded-2xl p-4 bg-white/60 border border-purple-200">
                  {isAnalyzing ? (
                    <div className="text-center text-sm text-gray-700">AI analyserer</div>
                  ) : aiSuggestions ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                          <span>✨</span> AI-forslag
                        </h5>
                        <button
                          type="button"
                          onClick={dismissAiSuggestions}
                          className="text-gray-400 hover:text-gray-600 text-xl"
                          aria-label="Lukk"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Tittel</p>
                          <p className="text-sm text-gray-900 font-medium">{aiSuggestions.title}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Beskrivelse</p>
                          <p className="text-sm text-gray-700">{aiSuggestions.description}</p>
                        </div>
                        {aiSuggestions.targetAudience && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Målgruppe</p>
                            <p className="text-sm text-gray-700">{aiSuggestions.targetAudience}</p>
                          </div>
                        )}
                        {aiSuggestions.needsProblem && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Behov eller problem</p>
                            <p className="text-sm text-gray-700">{aiSuggestions.needsProblem}</p>
                          </div>
                        )}
                        {aiSuggestions.valueProposition && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Verdiforslag</p>
                            <p className="text-sm text-gray-700">{aiSuggestions.valueProposition}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={applyAiSuggestions}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2.5 rounded-xl font-semibold transition-all"
                        >
                          Bruk forslagene
                        </button>
                        <button
                          type="button"
                          onClick={dismissAiSuggestions}
                          className="px-4 py-2.5 border-2 border-gray-300 hover:bg-gray-50 rounded-xl font-medium text-gray-700 transition-colors"
                        >
                          Avvis
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grunnleggende felter */}
      <div className="space-y-5">
        <div>
          <label htmlFor="title" className="flex items-center gap-2">
            <span>📝</span> Tittel *
          </label>
          <input
            id="title"
            type="text"
            {...register('title', { required: true, minLength: 2 })}
            placeholder="Kort og beskrivende"
            disabled={isBusy}
            className="mt-1.5"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">Tittel må være minst 2 tegn</p>}
        </div>

        <div>
          <label htmlFor="description" className="flex items-center gap-2">
            <span>💭</span> Beskrivelse
          </label>
          <textarea
            id="description"
            rows={4}
            {...register('description')}
            placeholder="Beskriv ideen"
            disabled={isBusy}
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="flex items-center gap-2">
              <span>🏷️</span> Type
            </label>
            <select id="type" {...register('type')} disabled={isBusy} className="mt-1.5">
              <option value="">Velg type</option>
              <option value="Inspirasjon">💡 Inspirasjon</option>
              <option value="Ide klar for vurdering til innovasjonsporteføljen">⭐ Klar for vurdering</option>
            </select>
          </div>

          <div>
            <label htmlFor="submitter" className="flex items-center gap-2">
              <span>👤</span> Ditt navn (valgfri)
            </label>
            <input
              id="submitter"
              type="text"
              {...register('submitter')}
              placeholder="Anonym"
              disabled={isBusy}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      {/* Avanserte felter */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary-600"
        >
          <span className="inline-block transition-transform" style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          Flere detaljer (valgfritt)
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="targetAudience" className="flex items-center gap-2">
                <span>🎯</span> Målgruppe
              </label>
              <textarea id="targetAudience" rows={2} {...register('targetAudience')} placeholder="Hvem er dette for" disabled={isBusy} className="mt-1.5" />
            </div>
            <div>
              <label htmlFor="needsProblem" className="flex items-center gap-2">
                <span>❗</span> Behov eller problem
              </label>
              <textarea id="needsProblem" rows={2} {...register('needsProblem')} placeholder="Hva løser dette" disabled={isBusy} className="mt-1.5" />
            </div>
            <div>
              <label htmlFor="valueProposition" className="flex items-center gap-2">
                <span>💎</span> Verdiforslag
              </label>
              <textarea id="valueProposition" rows={2} {...register('valueProposition')} placeholder="Hva er verdien" disabled={isBusy} className="mt-1.5" />
            </div>
            <div>
              <label htmlFor="stage" className="flex items-center gap-2">
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

      {/* Vurderinger */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowRatings(!showRatings)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary-600"
        >
          <span className="inline-block transition-transform" style={{ transform: showRatings ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          Vurderinger (valgfritt)
        </button>

        {showRatings && (
          <div className="mt-4 space-y-4">
            <StarRating label="⚡ Strategisk fit og bærekraft" value={strategicFit || 0} onChange={(v) => setValue('strategicFit', v)} disabled={isBusy} />
            <StarRating label="👥 Forbrukerbehov" value={consumerNeed || 0} onChange={(v) => setValue('consumerNeed', v)} disabled={isBusy} />
            <StarRating label="💰 Forretningspotensial" value={businessPotential || 0} onChange={(v) => setValue('businessPotential', v)} disabled={isBusy} />
            <StarRating label="🔧 Gjennomførbarhet" value={feasibility || 0} onChange={(v) => setValue('feasibility', v)} disabled={isBusy} />
            <StarRating label="🚀 Lanseringstid" value={launchTime || 0} onChange={(v) => setValue('launchTime', v)} disabled={isBusy} />
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          type="submit"
          disabled={isBusy}
          className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> Sender inn
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>🚀</span> Send inn idé
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
