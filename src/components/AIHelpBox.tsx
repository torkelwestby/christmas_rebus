'use client';

interface AIHelpBoxProps {
  aiPrompt?: string;
  onPromptChange?: (value: string) => void;
  isAnalyzing: boolean;
  isBusy: boolean;
  onAnalyze: () => void;
  aiSuggestions: any;
  showAiPanel: boolean;
  onApplySuggestions: () => void;
  onDismissSuggestions: () => void;
  promptLabel?: string;
  promptPlaceholder?: string;
  analysisDescription?: string;
  useRegister?: any;
  commentFieldName?: string;
  hasImage?: boolean;
  registeredValue?: string;
}

export default function AIHelpBox({
  aiPrompt,
  onPromptChange,
  isAnalyzing,
  isBusy,
  onAnalyze,
  aiSuggestions,
  showAiPanel,
  onApplySuggestions,
  onDismissSuggestions,
  promptLabel = "💬 Din beskrivelse til AI (valgfritt)",
  promptPlaceholder = "F.eks. 'Selvbetjent kiosk med ansiktsgjenkjenning på Oslo S'",
  analysisDescription = "Beskriv kort hva du ser eller tenker. Last opp bilde om du vil. Du kan bruke bare tekst, bare bilde, eller begge deler.",
  useRegister,
  commentFieldName = "comment",
  hasImage = false,
  registeredValue
}: AIHelpBoxProps) {
  const typedPrompt = aiPrompt?.trim() || '';
  const typedRegistered = (registeredValue ?? '').trim();
  const canAnalyze = !!((typedPrompt || typedRegistered || hasImage) && !isBusy);

  return (
    <>
      {!aiSuggestions && (
        <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 border-2 border-violet-300 rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-violet-900 mb-1 flex items-center gap-2">
              <span>Få hjelp fra AI</span>
              <span className="text-2xl">🤖</span>
            </h3>
            <p className="text-sm text-violet-700 mb-4">{analysisDescription}</p>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor={useRegister ? commentFieldName : "aiPrompt"}
                  className="block text-sm font-medium text-violet-900 mb-2"
                >
                  {promptLabel}
                </label>
                {useRegister ? (
                  <textarea
                    id={commentFieldName}
                    rows={2}
                    {...useRegister(commentFieldName)}
                    placeholder={promptPlaceholder}
                    disabled={isBusy}
                    className="w-full text-sm bg-white border-violet-200 focus:border-violet-400 focus:ring-violet-400"
                  />
                ) : (
                  <textarea
                    id="aiPrompt"
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => onPromptChange?.(e.target.value)}
                    placeholder={promptPlaceholder}
                    disabled={isBusy}
                    className="w-full text-sm bg-white border-violet-200 focus:border-violet-400 focus:ring-violet-400"
                  />
                )}
              </div>

              <div className="relative group/button">
                <button
                  type="button"
                  onClick={onAnalyze}
                  disabled={!canAnalyze}
                  className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:opacity-60 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Analyserer...</span>
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      <span>Få AI-forslag</span>
                    </>
                  )}
                </button>
                {!canAnalyze && !isBusy && (
                  <p className="text-xs text-red-600 mt-2 text-left opacity-0 group-hover/button:opacity-100 transition-opacity duration-200">
                    Legg til beskrivelse eller bilde
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAiPanel && aiSuggestions && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-300 p-4 sm:p-6 animate-in slide-in-from-top-2 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-emerald-900 mb-1 flex items-center gap-2">
              <span>AI-forslag</span>
              <span className="text-2xl">✨</span>
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-emerald-800">Tittel</p>
                <p className="text-emerald-700">{aiSuggestions.title}</p>
              </div>
              <div>
                <p className="font-medium text-emerald-800">Beskrivelse</p>
                <p className="text-emerald-700">{aiSuggestions.description}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApplySuggestions}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
            >
              ✅ Bruk forslag
            </button>
            <button
              type="button"
              onClick={onDismissSuggestions}
              className="px-4 py-2.5 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-sm transition-all"
            >
              ❌ Avvis
            </button>
          </div>
        </div>
      )}
    </>
  );
}
