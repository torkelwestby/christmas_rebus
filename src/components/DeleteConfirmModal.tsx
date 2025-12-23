'use client';

interface DeleteConfirmModalProps {
  ideaTitle: string;
  onConfirm: (archive: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DeleteConfirmModal({ 
  ideaTitle, 
  onConfirm, 
  onCancel,
  isLoading 
}: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <span className="text-3xl">🗑️</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          Slett idé?
        </h3>

        {/* Description */}
        <p className="text-gray-600 text-center mb-6">
          Hva vil du gjøre med <span className="font-semibold">"{ideaTitle}"</span>?
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => onConfirm(true)}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Arkiverer...</span>
              </>
            ) : (
              <>
                <span>📦</span>
                <span>Arkiver</span>
              </>
            )}
          </button>

          <button
            onClick={() => onConfirm(false)}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold shadow-sm hover:shadow-md transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Sletter...</span>
              </>
            ) : (
              <>
                <span>❌</span>
                <span>Slett permanent</span>
              </>
            )}
          </button>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full py-3 px-4 border-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-xl font-medium transition-colors"
          >
            Avbryt
          </button>
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <span className="font-semibold">💡 Tips:</span> Arkiverte ideer kan gjenopprettes senere. 
            Permanente slettinger kan ikke angres.
          </p>
        </div>
      </div>
    </div>
  );
}