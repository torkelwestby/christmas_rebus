'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from './Logo';

export default function Header() {
  const { isAuthenticated, username, logout, userStats, refreshStats, isAdmin } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Refresher når menyen åpnes
  useEffect(() => {
    if (showDropdown) refreshStats?.();
  }, [showDropdown, refreshStats]);

  // Lukker ved klikk utenfor
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  if (!isAuthenticated) return null;

  const initial = (username?.charAt(0) || '?').toUpperCase();

  return (
    <header className="bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto container-padding">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity mr-auto">
            <div className="w-24 h-10 relative">
              <Logo className="w-full h-full object-contain" />
            </div>
            <div className="h-8 w-px bg-gray-300 hidden sm:block" />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-primary-600">Idébank</p>
              <p className="text-xs text-gray-500">Innovasjon starter her</p>
            </div>
          </Link>

          {/* Navigasjon */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/" className="px-3 sm:px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-white hover:bg-primary-600 rounded-xl transition-all flex items-center gap-2 group">
              <span className="text-base group-hover:scale-110 transition-transform">➕</span>
              <span className="hidden sm:inline">Send inn</span>
            </Link>
            <Link href="/ideas" className="px-3 sm:px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-white hover:bg-primary-600 rounded-xl transition-all flex items-center gap-2 group">
              <span className="text-base group-hover:scale-110 transition-transform">📋</span>
              <span className="hidden sm:inline">Oversikt</span>
            </Link>
            <Link href="/kanban" className="px-3 sm:px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-white hover:bg-primary-600 rounded-xl transition-all flex items-center gap-2 group">
              <span className="text-base group-hover:scale-110 transition-transform">🎯</span>
              <span className="hidden sm:inline">Trakt</span>
            </Link>

            {/* Brukermeny */}
            <div className="ml-3 sm:ml-2 pl-3 sm:pl-2 border-l border-gray-300 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all group"
                aria-haspopup="menu"
                aria-expanded={showDropdown}
                aria-label="Brukermeny"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm group-hover:scale-105 transition-transform">
                  {initial}
                </div>
                <span className="hidden md:inline text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {username || 'Ukjent bruker'}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Header */}
                  <div className="bg-gradient-to-br from-primary-50 to-blue-50 p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {initial}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{username || 'Ukjent bruker'}</p>
                        <p className="text-xs text-gray-600">{isAdmin ? '👑 Administrator' : '👤 Bruker'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats samlet i én blokk */}
                  <div className="p-4 space-y-3">
                    {/* Rolle */}
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isAdmin
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                          : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{isAdmin ? '👑' : '👤'}</span>
                        <div>
                          <span className="text-xs font-medium text-gray-700">Din rolle</span>
                          <p className="text-sm font-semibold text-gray-900">{isAdmin ? 'Administrator' : 'Bruker'}</p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {isAdmin ? 'Full tilgang' : 'Begrenset tilgang'}
                      </span>
                    </div>

                    {/* Dine ideer */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">💡</span>
                        <span className="text-sm font-medium text-gray-700">Dine ideer</span>
                      </div>
                      {userStats?.loading ? (
                        <span className="text-sm text-gray-500 animate-pulse">...</span>
                      ) : (
                        <span className="text-2xl font-bold text-primary-700">{userStats?.ideasSubmitted ?? 0}</span>
                      )}
                    </div>

                    {/* Hint basert på antall
                    {(userStats?.ideasSubmitted ?? 0) > 0 ? (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                        <div className="flex items-start gap-2">
                          <span className="text-xl">🌟</span>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-700 mb-1">Din påvirkning</p>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {userStats!.ideasSubmitted === 1
                                ? 'God start. Del mer når du er klar.'
                                : userStats!.ideasSubmitted < 5
                                ? 'Du er i gang. Fortsett.'
                                : userStats!.ideasSubmitted < 10
                                ? 'Sterkt bidrag.'
                                : 'Toppbidragsyter.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                          <span className="text-xl">🚀</span>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-700 mb-1">Kom i gang</p>
                            <p className="text-xs text-gray-600 leading-relaxed">Send inn din første idé.</p>
                          </div>
                        </div>
                      </div>
                    )} */}
                  </div>

                  {/* Actions */}
                  <div className="p-3 border-t border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDropdown(false);
                        logout();
                      }}
                      className="w-full px-4 py-2.5 bg-white hover:bg-red-50 border-2 border-gray-200 hover:border-red-300 text-gray-700 hover:text-red-700 rounded-lg font-medium transition-all flex items-center justify-center gap-2 group"
                    >
                      <span className="group-hover:scale-110 transition-transform">🚪</span>
                      <span>Logg ut</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
