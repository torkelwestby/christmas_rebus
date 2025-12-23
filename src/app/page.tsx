'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface RebusState {
  id: number;
  solved: boolean;
  userAnswer: string;
  feedback: string;
  isChecking: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
}

export default function HomePage() {
  const [rebuses, setRebuses] = useState<RebusState[]>([
    { id: 1, solved: false, userAnswer: '', feedback: '', isChecking: false },
    { id: 2, solved: false, userAnswer: '', feedback: '', isChecking: false },
    { id: 3, solved: false, userAnswer: '', feedback: '', isChecking: false },
    { id: 4, solved: false, userAnswer: '', feedback: '', isChecking: false },
    { id: 5, solved: false, userAnswer: '', feedback: '', isChecking: false },
  ]);

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrateMessage, setCelebrateMessage] = useState('');
  const [currentSolvedId, setCurrentSolvedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Last inn fremgang fra Airtable ved oppstart
  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const response = await fetch('/api/progress');
      if (response.ok) {
        const data = await response.json();
        if (data.rebuses) {
          setRebuses(data.rebuses);
        }
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (rebusId: number) => {
    const rebus = rebuses.find(r => r.id === rebusId);
    if (!rebus || !rebus.userAnswer.trim()) return;

    setRebuses(prev => prev.map(r =>
      r.id === rebusId ? { ...r, isChecking: true, feedback: '' } : r
    ));

    try {
      const response = await fetch('/api/check-rebus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rebusId,
          userAnswer: rebus.userAnswer,
        }),
      });

      const data = await response.json();

      if (data.correct) {
        setRebuses(prev => prev.map(r =>
          r.id === rebusId
            ? { ...r, solved: true, feedback: '', isChecking: false, userAnswer: '' }
            : r
        ));

        setCelebrateMessage(data.message);
        setCurrentSolvedId(rebusId);
        setShowCelebration(true);
      } else {
        setRebuses(prev => prev.map(r =>
          r.id === rebusId
            ? { ...r, feedback: data.message, isChecking: false }
            : r
        ));
      }
    } catch (error) {
      console.error('Error:', error);
      setRebuses(prev => prev.map(r =>
        r.id === rebusId
          ? { ...r, feedback: '❌ Noe gikk galt. Prøv igjen!', isChecking: false }
          : r
      ));
    }
  };

  const handleScheduleSave = async () => {
    if (currentSolvedId === null) return;

    const rebus = rebuses.find(r => r.id === currentSolvedId);
    if (!rebus) return;

    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rebusId: currentSolvedId,
          solved: true,
          scheduledDate: rebus.scheduledDate,
          scheduledTime: rebus.scheduledTime,
        }),
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }

    setShowCelebration(false);
    setCurrentSolvedId(null);
  };

  const handleInputChange = (rebusId: number, value: string) => {
    setRebuses(prev => prev.map(r =>
      r.id === rebusId ? { ...r, userAnswer: value, feedback: '' } : r
    ));
  };

  const handleDateChange = (rebusId: number, date: string) => {
    setRebuses(prev => prev.map(r =>
      r.id === rebusId ? { ...r, scheduledDate: date } : r
    ));
  };

  const handleTimeChange = (rebusId: number, time: string) => {
    setRebuses(prev => prev.map(r =>
      r.id === rebusId ? { ...r, scheduledTime: time } : r
    ));
  };

  const solvedCount = rebuses.filter(r => r.solved).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎄</div>
          <p className="text-lg text-gray-600">Laster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🎄</div>
        <h1 className="text-4xl sm:text-5xl font-bold text-green-800 mb-4">
          Julerebus 2025
        </h1>
        <p className="text-lg text-gray-700 max-w-2xl mx-auto mb-4">
          Løs alle rebusene og lås opp eksklusive opplevelser for 2026!
        </p>
        <div className="inline-block bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border-2 border-green-200">
          <span className="text-2xl font-bold text-green-700">
            {solvedCount} / 5 løst
          </span>
        </div>
      </div>

      {/* Rebuses Stack */}
      <div className="space-y-6">
        {rebuses.map((rebus) => (
          <div
            key={rebus.id}
            className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border-4 transition-all duration-300 overflow-hidden ${
              rebus.solved
                ? 'border-green-500 shadow-green-200'
                : 'border-red-200 hover:border-red-300'
            }`}
          >
            {/* Rebus Image - Full width with natural aspect ratio */}
            <div className="relative w-full bg-gradient-to-br from-red-100 to-green-100">
              <div className="relative w-full" style={{ paddingBottom: '30%' }}>
                <Image
                  src={`/rebus${rebus.id}.png`}
                  alt={`Rebus ${rebus.id}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 896px"
                  priority={rebus.id <= 2}
                />
                {rebus.solved && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <div className="bg-green-500 text-white rounded-full p-6 shadow-2xl">
                      <span className="text-5xl">✓</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Section */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-800">
                  Rebus #{rebus.id}
                </h3>
                {rebus.solved && (
                  <span className="text-2xl">🎁</span>
                )}
              </div>

              {!rebus.solved ? (
                <>
                  <input
                    type="text"
                    value={rebus.userAnswer}
                    onChange={(e) => handleInputChange(rebus.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !rebus.isChecking) {
                        handleSubmit(rebus.id);
                      }
                    }}
                    placeholder="Skriv ditt svar her..."
                    disabled={rebus.isChecking}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-green-500 outline-none transition-all bg-white text-gray-900 placeholder-gray-400 disabled:opacity-50"
                  />

                  <button
                    onClick={() => handleSubmit(rebus.id)}
                    disabled={!rebus.userAnswer.trim() || rebus.isChecking}
                    className="w-full mt-3 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    {rebus.isChecking ? 'Sjekker...' : 'Sjekk svar'}
                  </button>

                  {rebus.feedback && (
                    <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {rebus.feedback}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                    <p className="text-center text-green-800 font-semibold">
                      🎉 Opplevelse låst opp!
                    </p>
                  </div>
                  {rebus.scheduledDate && (
                    <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-center">
                      <p className="text-sm text-blue-800">
                        📅 Planlagt: {new Date(rebus.scheduledDate + (rebus.scheduledTime ? `T${rebus.scheduledTime}` : '')).toLocaleString('no-NO', {
                          dateStyle: 'long',
                          timeStyle: rebus.scheduledTime ? 'short' : undefined
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Celebration Modal */}
      {showCelebration && currentSolvedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
          <div className="fireworks-container absolute inset-0 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="firework"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-md w-full text-center animate-in zoom-in-95 relative z-10">
            <div className="text-7xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold text-green-700 mb-4">
              Gratulerer!
            </h2>
            <p className="text-xl text-gray-700 mb-6">
              {celebrateMessage}
            </p>

            {/* Date and Time Picker */}
            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Når ønsker du å dra? (valgfritt)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    value={rebuses.find(r => r.id === currentSolvedId)?.scheduledDate || ''}
                    onChange={(e) => handleDateChange(currentSolvedId, e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 outline-none transition-all bg-white text-gray-900"
                  />
                </div>
                <div>
                  <input
                    type="time"
                    value={rebuses.find(r => r.id === currentSolvedId)?.scheduledTime || ''}
                    onChange={(e) => handleTimeChange(currentSolvedId, e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 outline-none transition-all bg-white text-gray-900"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleScheduleSave}
              className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
            >
              Fantastisk! 🎄
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      {solvedCount === 5 && (
        <div className="mt-12 text-center">
          <div className="inline-block bg-gradient-to-r from-green-500 to-red-500 text-white rounded-2xl px-8 py-6 shadow-2xl">
            <p className="text-2xl font-bold mb-2">
              🌟 Du har løst alle rebusene! 🌟
            </p>
            <p className="text-lg">
              Gleder oss til å oppleve alle disse tingene sammen i 2026! 🎊
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
