'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';
import { AIRTABLE_FIELDS as FIELDS } from '@/lib/schemas';
import IdeaEditModal from '@/components/IdeaEditModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

// Airtable singleSelect kan komme som string eller { name: string }
const getSelectName = (v: any) => (typeof v === 'string' ? v : v?.name || '');

// Normaliser for trygg matching
const norm = (s: string) =>
  s
    ?.toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase() || '';

const stageKey = (raw: string) => {
  const n = norm(raw);
  if (!n) return '';
  if (['idegenerering', 'ide gen', 'idégen', 'idegen'].includes(n)) return 'Idégenerering';
  if (['ideutforsking', 'idéutforsking', 'utforsking'].includes(n)) return 'Idéutforsking';
  if (
    [
      'problem/losning',
      'problem losning',
      'problem løsning',
      'problem/løsning',
      'problemlosning',
      'problemloesning',
    ].includes(n)
  )
    return 'Problem/Løsning';
  if (['produkt/marked', 'produkt marked'].includes(n)) return 'Produkt/Marked';
  if (['skalering'].includes(n)) return 'Skalering';
  if (['arkivert'].includes(n)) return 'Arkivert';
  return raw;
};

const STAGES = [
  { id: 'Idégenerering', label: 'Idégenerering', emoji: '💭', color: 'bg-blue-50 border-blue-200' },
  { id: 'Idéutforsking', label: 'Idéutforsking', emoji: '🔍', color: 'bg-purple-50 border-purple-200' },
  { id: 'Problem/Løsning', label: 'Problem/Løsning', emoji: '🎯', color: 'bg-pink-50 border-pink-200' },
  { id: 'Produkt/Marked', label: 'Produkt/Marked', emoji: '🚀', color: 'bg-orange-50 border-orange-200' },
  { id: 'Skalering', label: 'Skalering', emoji: '📈', color: 'bg-green-50 border-green-200' },
  { id: 'Arkivert', label: 'Arkivert', emoji: '📦', color: 'bg-gray-50 border-gray-200' },
];

export default function KanbanBoard() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [ideas, setIdeas] = useState<AirtableRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [draggedIdea, setDraggedIdea] = useState<AirtableRecord | null>(null);
  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);
  const [editingIdea, setEditingIdea] = useState<AirtableRecord | null>(null);
  const [deletingIdea, setDeletingIdea] = useState<AirtableRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchIdeas();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const fetchIdeas = async () => {
    setIsLoading(true);
    setError('');
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/ideas?max=200`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      const recs: AirtableRecord[] = data.records || [];

      setIdeas(recs);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Kunne ikke laste ideer. Prøv å laste siden på nytt.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateIdeaStage = async (ideaId: string, newStage: string) => {
    if (!isAdmin) {
      alert('Du har ikke tilgang til å flytte ideer. Kun admin kan gjøre dette.');
      fetchIdeas(); // Refresh to reset any optimistic updates
      return;
    }

    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/ideas?id=${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!response.ok) throw new Error('Failed to update');

      const updatedIdea = await response.json();
      setIdeas((prev) =>
        prev.map((idea) => (idea.id === ideaId ? (updatedIdea.id ? updatedIdea : { ...idea, ...updatedIdea }) : idea))
      );
    } catch (err) {
      console.error('Update error:', err);
      fetchIdeas();
    }
  };

  const handleIdeaUpdated = (updatedIdea: AirtableRecord) => {
    setIdeas((prev) => prev.map((idea) => (idea.id === updatedIdea.id ? updatedIdea : idea)));
    setEditingIdea(null);
  };

  const handleDelete = async (archive: boolean) => {
    if (!deletingIdea || !isAdmin) return;

    setIsDeleting(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/ideas?id=${deletingIdea.id}&archive=${archive}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      if (archive) {
        const updatedIdea = {
          ...deletingIdea,
          fields: {
            ...deletingIdea.fields,
            [FIELDS.STAGE]: 'Arkivert',
          },
        };
        setIdeas((prev) => prev.map((r) => (r.id === deletingIdea.id ? updatedIdea : r)));
      } else {
        setIdeas((prev) => prev.filter((r) => r.id !== deletingIdea.id));
      }

      setDeletingIdea(null);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Kunne ikke slette idé. Prøv igjen.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Drag handlers - only for admin
  const handleDragStart = (e: React.DragEvent, idea: AirtableRecord) => {
    if (!isAdmin) {
      e.preventDefault();
      return;
    }
    setDraggedIdea(idea);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDraggedOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    setDraggedOverStage(null);

    if (!draggedIdea) return;

    const currentStage = getSelectName(draggedIdea.fields[FIELDS.STAGE]);

    if (currentStage !== stageId) {
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === draggedIdea.id
            ? { ...idea, fields: { ...idea.fields, [FIELDS.STAGE]: { name: stageId } } }
            : idea
        )
      );

      updateIdeaStage(draggedIdea.id, stageId);
    }

    setDraggedIdea(null);
  };

  // Group ideas by stage
  const groupedIdeas: Record<string, AirtableRecord[]> = {};
  for (const stage of STAGES) {
    groupedIdeas[stage.id] = [];
  }
  groupedIdeas[''] = []; // For ideas without stage

  for (const idea of ideas) {
    const rawStage = getSelectName(idea.fields[FIELDS.STAGE]);
    const key = stageKey(rawStage) || '';
    if (groupedIdeas[key]) {
      groupedIdeas[key].push(idea);
    } else {
      groupedIdeas[''].push(idea);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-8 text-center">
          <div className="text-3xl mb-2">⏳</div>
          <p className="text-sm text-gray-700">Laster Kanban...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-lg font-semibold mb-2">Kunne ikke laste Kanban</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchIdeas}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-3 sm:px-6 py-3 sm:py-6">
        {/* Header - kompakt på mobil */}
        <div className="mb-3 sm:mb-5">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-1">Innovasjonstrakt</h1>
          <p className="text-xs sm:text-base text-gray-600">
            {isAdmin ? 'Dra og slipp for å flytte ideer (anbefalt på PC)' : 'Du har kun lesetilgang'}
          </p>
        </div>

        {/* Kanban Board - optimalisert for mobil */}
        <div className="overflow-x-auto pb-3 -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex gap-2 sm:gap-4 min-w-max sm:min-w-0">
            {/* Uten stage kolonne */}
            {groupedIdeas[''].length > 0 && (
              <KanbanColumn
                stage={{ id: '', label: 'Uten stage', emoji: '❓', color: 'bg-gray-50 border-gray-300' }}
                ideas={groupedIdeas['']}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                isDraggedOver={draggedOverStage === ''}
                onEdit={(idea) => isAdmin && setEditingIdea(idea)}
                onDelete={(idea) => isAdmin && setDeletingIdea(idea)}
                isAdmin={isAdmin}
              />
            )}

            {/* Stage kolonner */}
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                ideas={groupedIdeas[stage.id] || []}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                isDraggedOver={draggedOverStage === stage.id}
                onEdit={(idea) => isAdmin && setEditingIdea(idea)}
                onDelete={(idea) => isAdmin && setDeletingIdea(idea)}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </div>

        {/* Info for basic users - kompakt */}
        {!isAdmin && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-800">
              <span className="font-semibold">ℹ️</span> Kun lesetilgang. Kontakt admin for endringer.
            </p>
          </div>
        )}
      </div>

      {/* Modals - only show for admin */}
      {isAdmin && editingIdea && (
        <IdeaEditModal idea={editingIdea} onClose={() => setEditingIdea(null)} onSuccess={handleIdeaUpdated} />
      )}

      {isAdmin && deletingIdea && (
        <DeleteConfirmModal
          ideaTitle={deletingIdea.fields[FIELDS.TITLE] || 'Uten tittel'}
          onConfirm={handleDelete}
          onCancel={() => setDeletingIdea(null)}
          isLoading={isDeleting}
        />
      )}
    </>
  );
}

// Kanban Column Component - optimalisert for mobil
interface KanbanColumnProps {
  stage: { id: string; label: string; emoji: string; color: string };
  ideas: AirtableRecord[];
  onDragStart: (e: React.DragEvent, idea: AirtableRecord) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  isDraggedOver: boolean;
  onEdit: (idea: AirtableRecord) => void;
  onDelete: (idea: AirtableRecord) => void;
  isAdmin: boolean;
}

function KanbanColumn({
  stage,
  ideas,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDraggedOver,
  onEdit,
  onDelete,
  isAdmin,
}: KanbanColumnProps) {
  return (
    <div
      className={`flex-shrink-0 w-44 sm:w-60 flex flex-col transition-all ${isDraggedOver ? 'scale-[1.02]' : ''}`}
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Column Header - kompakt */}
      <div
        className={`border-2 rounded-t-xl sm:rounded-t-2xl p-2 sm:p-3 ${stage.color} ${
          isDraggedOver ? 'border-primary-500 bg-primary-100' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-base sm:text-xl flex-shrink-0">{stage.emoji}</span>
            <h2 className="font-semibold text-gray-900 text-xs sm:text-base truncate">{stage.label}</h2>
          </div>
          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white rounded-full text-xs font-medium text-gray-700 flex-shrink-0">
            {ideas.length}
          </span>
        </div>
      </div>

      {/* Column Content - optimalisert scroll */}
      <div
        className={`border-2 border-t-0 rounded-b-xl sm:rounded-b-2xl p-1.5 sm:p-3 flex-1 space-y-1.5 sm:space-y-3 min-h-[250px] sm:min-h-[400px] bg-white/50 backdrop-blur-sm ${
          isDraggedOver ? 'border-primary-500 bg-primary-50/50' : stage.color
        }`}
      >
        {ideas.length === 0 ? (
          <div className="flex items-center justify-center h-24 sm:h-32 text-gray-400 text-xs">
            Ingen ideer
          </div>
        ) : (
          ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onDragStart={(e) => onDragStart(e, idea)}
              onEdit={() => onEdit(idea)}
              onDelete={() => onDelete(idea)}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Idea Card Component - kompakt mobil design
interface IdeaCardProps {
  idea: AirtableRecord;
  onDragStart: (e: React.DragEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}

function IdeaCard({ idea, onDragStart, onEdit, onDelete, isAdmin }: IdeaCardProps) {
  const fields = idea.fields;
  const images = fields[FIELDS.IMAGE] || [];
  const firstImage = images[0];
  const imageUrl = firstImage?.thumbnails?.large?.url || firstImage?.url;
  const averageScore = fields[FIELDS.AVERAGE_SCORE];

  return (
    <div
      draggable={isAdmin}
      onDragStart={onDragStart}
      className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-1.5 sm:p-3 ${
        isAdmin ? 'cursor-move hover:shadow-md hover:border-primary-300 active:cursor-grabbing' : 'cursor-default'
      } transition-all group relative`}
    >
      {/* Action buttons - touch-vennlig */}
      {isAdmin && (
        <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 bg-white/95 hover:bg-primary-600 text-gray-700 hover:text-white rounded-md shadow-sm transition-all touch-manipulation"
            title="Rediger"
          >
            <span className="text-xs">✏️</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 bg-white/95 hover:bg-red-600 text-gray-700 hover:text-white rounded-md shadow-sm transition-all touch-manipulation"
            title="Slett"
          >
            <span className="text-xs">🗑️</span>
          </button>
        </div>
      )}

      {/* Thumbnail */}
      {imageUrl && (
        <div className="relative w-full h-12 sm:h-20 mb-1 sm:mb-2 rounded-md overflow-hidden bg-gray-100">
          <Image
            src={imageUrl}
            alt={fields[FIELDS.TITLE] || 'Idé'}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
            sizes="(max-width: 640px) 224px, 320px"
            quality={80}
          />
        </div>
      )}

      {/* Title - only element visible on mobile */}
      <h3 className="font-medium text-gray-900 text-xs sm:text-sm line-clamp-2 sm:mb-2">
        {fields[FIELDS.TITLE] || 'Uten tittel'}
      </h3>

      {/* Description - hidden on mobile */}
      <p className="hidden sm:block text-xs text-gray-600 line-clamp-2 mb-2 leading-snug">
        {fields[FIELDS.DESCRIPTION] || 'Ingen beskrivelse'}
      </p>

      {/* Footer - hidden on mobile */}
      <div className="hidden sm:flex items-center justify-between text-xs gap-1">
        <span className="text-gray-500 truncate flex-1 min-w-0">{fields[FIELDS.SUBMITTER] || 'Anonym'}</span>
        {averageScore && averageScore > 0 && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span className="text-yellow-500">⭐</span>
            <span className="font-medium text-gray-700">{averageScore.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Type badge - hidden on mobile */}
      {fields[FIELDS.TYPE] && (
        <div className="hidden sm:block mt-2 pt-2 border-t border-gray-100">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
            <span>{fields[FIELDS.TYPE] === 'Inspirasjon' ? '💡' : '⭐'}</span>
            <span className="truncate max-w-[100px]">
              {fields[FIELDS.TYPE] === 'Inspirasjon' ? 'Inspirasjon' : 'Vurdering'}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}