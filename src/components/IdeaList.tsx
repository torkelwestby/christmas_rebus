'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AIRTABLE_FIELDS as FIELDS } from "@/lib/schemas";
import IdeaEditModal from './IdeaEditModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { useAuth } from '@/contexts/AuthContext';

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface IdeaListProps {
  initialRecords: AirtableRecord[];
  initialOffset?: string;
  onRefresh?: () => Promise<void>;
  currentUsername?: string;
}

// Helpers
const getSelectName = (v: any) => (typeof v === 'string' ? v : v?.name || '');
const toNumberOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
};

// Felles inputstil for søk og selekter
const commonInputClasses =
  "w-full h-11 sm:h-11 text-sm sm:text-base px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400";

const selectClasses =
  "w-full h-11 sm:h-11 text-sm sm:text-base px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 cursor-pointer";

// ⭐ Visuell stjernevisning
function StarDisplay({ score }: { score: number | null }) {
  if (score === null || score <= 0) return null;

  const safeScore = Math.max(0, Math.min(5, score));
  const fullStars = Math.floor(safeScore);
  const hasHalfStar = safeScore % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => {
        if (i < fullStars) {
          return (
            <svg key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          );
        } else if (i === fullStars && hasHalfStar) {
          return (
            <svg key={i} className="w-4 h-4 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="half-fill">
                  <stop offset="50%" stopColor="rgb(250, 204, 21)" />
                  <stop offset="50%" stopColor="rgb(209, 213, 219)" />
                </linearGradient>
              </defs>
              <path fill="url(#half-fill)" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          );
        } else {
          return (
            <svg key={i} className="w-4 h-4 text-gray-300 fill-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          );
        }
      })}
      <span className="text-xs text-gray-600 ml-1 font-medium">{safeScore.toFixed(1)}</span>
    </div>
  );
}

export default function IdeaList({ 
  initialRecords, 
  initialOffset, 
  onRefresh,
  currentUsername
}: IdeaListProps) {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<AirtableRecord[]>(initialRecords ?? []);
  const [offset, setOffset] = useState<string | undefined>(initialOffset);
  const [showMyIdeasOnly, setShowMyIdeasOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [selectedIdea, setSelectedIdea] = useState<AirtableRecord | null>(null);
  const [editingIdea, setEditingIdea] = useState<AirtableRecord | null>(null);
  const [deletingIdea, setDeletingIdea] = useState<AirtableRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hent flere ideer
  const loadMore = async () => {
    if (!offset || isLoading) return;
    setIsLoading(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/ideas?max=50&offset=${encodeURIComponent(offset)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setRecords(prev => [...prev, ...(data.records ?? [])]);
      setOffset(data.offset);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Oppdater etter redigering
  const handleIdeaUpdated = async (updatedIdea: AirtableRecord) => {
    setRecords(prev => prev.map(r => r.id === updatedIdea.id ? updatedIdea : r));
    setEditingIdea(null);
    if (selectedIdea?.id === updatedIdea.id) {
      setSelectedIdea(updatedIdea);
    }
    if (onRefresh) {
      await onRefresh();
    }
  };

  // Slett eller arkiver
  const handleDelete = async (archive: boolean) => {
    if (!deletingIdea) return;
    setIsDeleting(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(
        `${baseUrl}/api/ideas?id=${deletingIdea.id}&archive=${archive}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete');

      if (archive) {
        const updatedIdea = {
          ...deletingIdea,
          fields: {
            ...deletingIdea.fields,
            [FIELDS.STAGE]: 'Arkivert'
          }
        };
        setRecords(prev => prev.map(r => r.id === deletingIdea.id ? updatedIdea : r));
      } else {
        setRecords(prev => prev.filter(r => r.id !== deletingIdea.id));
      }

      setDeletingIdea(null);
      if (selectedIdea?.id === deletingIdea.id) setSelectedIdea(null);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Kunne ikke slette idé. Prøv igjen.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrering
  const filteredRecords = records.filter((record) => {
    const title = (record.fields[FIELDS.TITLE] ?? '').toString().toLowerCase();
    const description = (record.fields[FIELDS.DESCRIPTION] ?? '').toString().toLowerCase();

    const typeName = getSelectName(record.fields[FIELDS.TYPE]);
    const stageName = getSelectName(record.fields[FIELDS.STAGE]);

    const matchesSearch =
      !searchQuery ||
      title.includes(searchQuery.toLowerCase()) ||
      description.includes(searchQuery.toLowerCase());

    const matchesType = !typeFilter || typeName === typeFilter;
    const matchesStage = !stageFilter || stageName === stageFilter;

    if (showMyIdeasOnly && currentUsername) {
      const submitter = (record.fields[FIELDS.SUBMITTER] ?? '').toString().toLowerCase();
      const matchesSubmitter = submitter === currentUsername.toLowerCase();
      if (!matchesSubmitter) return false;
    }

    return matchesSearch && matchesType && matchesStage;
  });

  return (
    <>
      <div className="space-y-6">
        {/* Søk og filtre */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Søk */}
            <div>
              <label htmlFor="search" className="sr-only">Søk</label>
              <div className="relative">
                <input
                  id="search"
                  type="text"
                  placeholder="🔍 Søk etter tittel…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={commonInputClasses}
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label htmlFor="type-filter" className="sr-only">Type</label>
              <select
                id="type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={selectClasses}
              >
                <option value="">🏷️ Alle typer</option>
                <option value="Inspirasjon">💡 Inspirasjon</option>
                <option value="Ide klar for vurdering til innovasjonsporteføljen">
                  ⭐ Klar for vurdering
                </option>
              </select>
            </div>

            {/* Stage */}
            <div>
              <label htmlFor="stage-filter" className="sr-only">Stage</label>
              <select
                id="stage-filter"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className={selectClasses}
              >
                <option value="">📊 Alle stages</option>
                <option value="Idégenerering">Idégenerering</option>
                <option value="Idéutforsking">Idéutforsking</option>
                <option value="Problem/Løsning">Problem/Løsning</option>
                <option value="Produkt/Marked">Produkt/Marked</option>
                <option value="Skalering">Skalering</option>
                <option value="Arkivert">Arkivert</option>
              </select>
            </div>

            {/* "Mine ideer" toggle */}
            {currentUsername && (
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => setShowMyIdeasOnly(!showMyIdeasOnly)}
                  className={`w-full py-2.5 sm:py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    showMyIdeasOnly
                      ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-md'
                      : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{showMyIdeasOnly ? '✅' : '☐'}</span>
                  <span>Mine ideer</span>
                  {showMyIdeasOnly && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      {filteredRecords.length}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 sm:mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Viser {filteredRecords.length} av totalt {records.length} idéer
            </p>
            {(searchQuery || typeFilter || stageFilter || showMyIdeasOnly) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('');
                  setStageFilter('');
                  setShowMyIdeasOnly(false);
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Nullstill filtre
              </button>
            )}
          </div>
        </div>

        {/* Idéliste */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ingen idéer funnet</h3>
            <p className="text-gray-600">
              {searchQuery || typeFilter || stageFilter || showMyIdeasOnly
                ? 'Prøv å justere søkekriteriene dine'
                : 'Ingen idéer er registrert ennå'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filteredRecords.map((record) => (
              <IdeaCard
                key={record.id}
                idea={record}
                onClick={() => setSelectedIdea(record)}
                isAdmin={isAdmin}
                onEdit={() => { if (isAdmin) setEditingIdea(record); }}
                onDelete={() => { if (isAdmin) setDeletingIdea(record); }}
              />
            ))}
          </div>
        )}

        {/* Last mer */}
        {offset && !isLoading && (
          <div className="text-center">
            <button
              onClick={loadMore}
              className="px-4 py-2.5 sm:px-6 sm:py-3 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl font-medium text-gray-700 transition-all"
            >
              Last inn flere
            </button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin text-4xl">⏳</div>
            <p className="text-gray-600 mt-2">Laster flere idéer...</p>
          </div>
        )}
      </div>

      {/* Modaler */}
      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onEdit={() => {
            if (isAdmin) {
              setEditingIdea(selectedIdea);
              setSelectedIdea(null);
            }
          }}
          onDelete={() => {
            if (isAdmin) {
              setDeletingIdea(selectedIdea);
              setSelectedIdea(null);
            }
          }}
          isAdmin={isAdmin}
        />
      )}

      {editingIdea && isAdmin && (
        <IdeaEditModal
          idea={editingIdea}
          onClose={() => setEditingIdea(null)}
          onSuccess={handleIdeaUpdated}
        />
      )}

      {deletingIdea && isAdmin && (
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

// Idea Card
interface IdeaCardProps {
  idea: AirtableRecord;
  onClick: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

function IdeaCard({ idea, onClick, isAdmin = false, onEdit = () => {}, onDelete = () => {} }: IdeaCardProps) {
  const ideaFields = idea.fields;
  const images = ideaFields[FIELDS.IMAGE] || [];
  const firstImage = images[0];
  const imageUrl = firstImage?.thumbnails?.large?.url || firstImage?.url;

  const typeName = getSelectName(ideaFields[FIELDS.TYPE]);
  const stageName = getSelectName(ideaFields[FIELDS.STAGE]);
  const averageScore = toNumberOrNull(ideaFields[FIELDS.AVERAGE_SCORE]);

  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary-300 transition-all group"
    >
      {/* Admin actions */}
      {isAdmin && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 bg-white hover:bg-primary-600 text-gray-700 hover:text-white rounded-lg shadow-sm border border-gray-200 transition-all"
            aria-label="Rediger"
            title="Rediger"
          >
            ✏️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 bg-white hover:bg-red-600 text-gray-700 hover:text-white rounded-lg shadow-sm border border-gray-200 transition-all"
            aria-label="Slett"
            title="Slett"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Thumbnail */}
      {imageUrl && (
        <div className="relative w-full h-40 sm:h-48 bg-gray-100">
          <Image
            src={imageUrl}
            alt={ideaFields[FIELDS.TITLE] || 'Idé'}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={85}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2 group-hover:text-primary-600 transition-colors">
          {ideaFields[FIELDS.TITLE] || 'Uten tittel'}
        </h3>

        <p className="text-xs sm:text-sm text-gray-600 line-clamp-3">
          {ideaFields[FIELDS.DESCRIPTION] || 'Ingen beskrivelse'}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {typeName && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {typeName === 'Inspirasjon' ? '💡' : '⭐'} {typeName === 'Inspirasjon' ? 'Inspirasjon' : 'Vurdering'}
            </span>
          )}
          {stageName && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              {stageName}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {ideaFields[FIELDS.SUBMITTER] || 'Anonym'}
          </span>
          {averageScore && averageScore > 0 && <StarDisplay score={averageScore} />}
        </div>
      </div>
    </div>
  );
}

// Idea Detail Modal
interface IdeaDetailModalProps {
  idea: AirtableRecord;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}

function IdeaDetailModal({ idea, onClose, onEdit, onDelete, isAdmin }: IdeaDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const ideaFields = idea.fields;
  const images = ideaFields[FIELDS.IMAGE] || [];
  const currentImage = images[currentImageIndex];

  const typeName = getSelectName(ideaFields[FIELDS.TYPE]);
  const stageName = getSelectName(ideaFields[FIELDS.STAGE]);

  const strategicFit = toNumberOrNull(ideaFields[FIELDS.STRATEGIC_FIT]);
  const consumerNeed = toNumberOrNull(ideaFields[FIELDS.CONSUMER_NEED]);
  const businessPotential = toNumberOrNull(ideaFields[FIELDS.BUSINESS_POTENTIAL]);
  const feasibility = toNumberOrNull(ideaFields[FIELDS.FEASIBILITY]);
  const launchTime = toNumberOrNull(ideaFields[FIELDS.LAUNCH_TIME]);
  const averageScore = toNumberOrNull(ideaFields[FIELDS.AVERAGE_SCORE]);

  const hasRatings = strategicFit || consumerNeed || businessPotential || feasibility || launchTime;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {ideaFields[FIELDS.TITLE] || 'Uten tittel'}
          </h2>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={onEdit}
                  className="px-3 py-2 text-gray-700 hover:text-white hover:bg-primary-600 rounded-lg transition-all flex items-center gap-2"
                >
                  <span className="text-lg">✏️</span>
                  <span className="text-sm font-medium">Rediger</span>
                </button>
                <button
                  onClick={onDelete}
                  className="px-3 py-2 text-gray-700 hover:text-white hover:bg-red-600 rounded-lg transition-all flex items-center gap-2"
                >
                  <span className="text-lg">🗑️</span>
                  <span className="text-sm font-medium">Slett</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Bilder */}
        {images.length > 0 && (
          <div className="relative bg-gray-100">
            <div className="relative w-full h-96">
              <Image
                src={currentImage?.url || currentImage?.thumbnails?.large?.url}
                alt={ideaFields[FIELDS.TITLE] || 'Idé'}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 1024px"
              />
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex((currentImageIndex - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentImageIndex((currentImageIndex + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
                >
                  →
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImageIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? 'bg-white w-8' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Innhold */}
        <div className="p-6 space-y-6">
          {/* Tags og snitt */}
          <div className="flex flex-wrap items-center gap-2">
            {typeName && (
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {typeName}
              </span>
            )}
            {stageName && (
              <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {stageName}
              </span>
            )}
            {averageScore !== null && averageScore > 0 && (
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-full border border-yellow-200">
                <span className="text-sm font-medium text-gray-700">Snittscore:</span>
                <StarDisplay score={averageScore} />
              </div>
            )}
          </div>

          {/* Beskrivelse */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">💡 Beskrivelse</h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {ideaFields[FIELDS.DESCRIPTION] || 'Ingen beskrivelse'}
            </p>
          </div>

          {/* Målgruppe */}
          {ideaFields[FIELDS.TARGET_AUDIENCE] && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">🎯 Målgruppe</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {ideaFields[FIELDS.TARGET_AUDIENCE]}
              </p>
            </div>
          )}

          {/* Behov */}
          {ideaFields[FIELDS.NEEDS_PROBLEM] && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">❗ Behov / Problem</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {ideaFields[FIELDS.NEEDS_PROBLEM]}
              </p>
            </div>
          )}

          {/* Verdiforslag */}
          {ideaFields[FIELDS.VALUE_PROPOSITION] && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">💎 Verdiforslag</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {ideaFields[FIELDS.VALUE_PROPOSITION]}
              </p>
            </div>
          )}

          {/* Vurderinger */}
          {hasRatings && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">📊 Vurderinger</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {strategicFit && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">⚡ Strategisk fit</span>
                    <StarDisplay score={strategicFit} />
                  </div>
                )}
                {consumerNeed && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">👥 Forbrukerbehov</span>
                    <StarDisplay score={consumerNeed} />
                  </div>
                )}
                {businessPotential && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">💰 Forretningspotensial</span>
                    <StarDisplay score={businessPotential} />
                  </div>
                )}
                {feasibility && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">🔧 Gjennomførbarhet</span>
                    <StarDisplay score={feasibility} />
                  </div>
                )}
                {launchTime && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">🚀 Lanseringstid</span>
                    <StarDisplay score={launchTime} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-medium">Innsender:</span> {ideaFields[FIELDS.SUBMITTER] || 'Anonym'}
            </div>
            <div>
              {ideaFields[FIELDS.DATE_SUBMITTED] && (
                <>
                  <span className="font-medium">Dato:</span>{' '}
                  {new Date(ideaFields[FIELDS.DATE_SUBMITTED]).toLocaleDateString('no-NO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </>
              )}
            </div>
          </div>

          {!isAdmin && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">ℹ️ Info:</span> Kun administratorer kan redigere og slette ideer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}