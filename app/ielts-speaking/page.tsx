'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  Mic,
  Clock,
  Sparkles,
  Award,
  ArrowRight,
  Layers,
  Search,
  BookOpen,
  Eye,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  AlertCircle,
} from 'lucide-react';
import { IELTSSpeakingTopic } from '@/types/ielts';

const ITEMS_PER_PAGE = 6;

export default function IELTSSpeakingPortalPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<IELTSSpeakingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Preview Modal state
  const [previewTopic, setPreviewTopic] = useState<IELTSSpeakingTopic | null>(null);

  useEffect(() => {
    async function loadTopics() {
      try {
        setLoading(true);
        const res = await fetch('/api/ielts/start');
        const data = await res.json();
        if (data.success && Array.isArray(data.topics)) {
          setTopics(data.topics);
        } else if (data.success && data.topic) {
          setTopics([data.topic]);
        }
      } catch (err) {
        console.error('Failed to load IELTS topics:', err);
        setError('Failed to load test sets. Please try refreshing.');
      } finally {
        setLoading(false);
      }
    }
    loadTopics();
  }, []);

  // Filter topics based on search & category
  const categories = Array.from(new Set(topics.map((t) => t.category).filter(Boolean)));

  const filteredTopics = topics.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Reset to page 1 when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTopics.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTopics = filteredTopics.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleStartTest = async (topicId: string) => {
    try {
      setStartingTopicId(topicId);
      setError(null);
      const res = await fetch('/api/ielts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(data.error || 'Failed to start IELTS test');
      }

      router.push(`/ielts-speaking/test/${data.attempt.id}`);
    } catch (err) {
      console.error('Start test error:', err);
      setError((err as Error).message);
    } finally {
      setStartingTopicId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-10">
        {/* Hero Banner Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 text-white rounded-3xl p-8 md:p-10 shadow-xl">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-white/20 border border-white/30 text-white text-xs font-bold rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Full 3-Part Exam Simulator</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              IELTS Speaking <span className="text-amber-300">Test Bank</span>
            </h1>

            <p className="text-purple-100 text-sm leading-relaxed">
              Select any test set below to practice with our AI examiner. Each set includes Part 1 interview questions, Part 2 cue card with 60s prep countdown, and Part 3 abstract discussion questions.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search & Category Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search test sets by title or topic..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                All Topics ({topics.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Topics Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <span>Available Test Sets ({filteredTopics.length})</span>
            </h2>
            {filteredTopics.length > 0 && (
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading IELTS test sets...</span>
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-3xl p-8 space-y-3 shadow-sm">
              <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-slate-800 font-bold text-sm">No Test Sets Match Your Criteria</div>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                Try resetting your search query or selecting a different category filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedTopics.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border border-slate-200 hover:border-purple-300 rounded-3xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                        {t.category || 'General'}
                      </span>
                      <button
                        onClick={() => setPreviewTopic(t)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold"
                        title="View Topic Details"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Preview</span>
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">{t.title}</h3>

                    {t.description && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 overflow-hidden">
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed overflow-hidden text-ellipsis">
                          {t.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                      <div className="bg-purple-50/70 p-2 rounded-xl border border-purple-100">
                        <div className="text-slate-500 text-[10px]">Part 1</div>
                        <div className="font-bold text-purple-700">{t.part1_questions?.length || 0} Qs</div>
                      </div>
                      <div className="bg-pink-50/70 p-2 rounded-xl border border-pink-100">
                        <div className="text-slate-500 text-[10px]">Part 2</div>
                        <div className="font-bold text-pink-700">1 Card</div>
                      </div>
                      <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
                        <div className="text-slate-500 text-[10px]">Part 3</div>
                        <div className="font-bold text-emerald-700">{t.part3_questions?.length || 0} Qs</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartTest(t.id)}
                      disabled={startingTopicId === t.id}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-purple-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {startingTopicId === t.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Preparing Exam...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          <span>Start Test Set</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredTopics.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-6">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-900">
                {Math.min(startIndex + ITEMS_PER_PAGE, filteredTopics.length)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{filteredTopics.length}</span> test sets
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-40 disabled:hover:bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-40 disabled:hover:bg-white"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3 Parts Structure Explainer */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" />
            <span>IELTS Speaking Exam Overview</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                01
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Part 1: Introduction & Interview</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Answer short questions on everyday subjects (work, study, hobbies, technology).
              </p>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-700 font-bold flex items-center justify-center text-sm">
                02
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Part 2: Cue Card & Long Turn</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                1-minute countdown to prepare notes on a cue card, followed by 2 minutes speech recording.
              </p>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">
                03
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Part 3: Discussion</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Discuss abstract issues and broader societal questions related to Part 2.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Preview Topic Details Modal */}
      {previewTopic && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto space-y-5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{previewTopic.category}</span>
                <h2 className="text-lg font-bold text-slate-900">{previewTopic.title}</h2>
              </div>
              <button onClick={() => setPreviewTopic(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Part 1 */}
              <div className="space-y-2">
                <span className="font-bold text-purple-700 uppercase text-[11px] block">Part 1 Questions ({previewTopic.part1_questions?.length || 0})</span>
                <div className="space-y-1.5">
                  {previewTopic.part1_questions?.map((q, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>{q.question_text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part 2 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-bold text-pink-700 uppercase text-[11px] block">Part 2 Cue Card</span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 text-sm">{previewTopic.part2_cue_card?.cue_card_title}</div>
                  <div className="text-slate-600 italic">{previewTopic.part2_cue_card?.prompt_lead}</div>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700">
                    {previewTopic.part2_cue_card?.bullet_points.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Part 3 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-bold text-emerald-700 uppercase text-[11px] block">Part 3 Questions ({previewTopic.part3_questions?.length || 0})</span>
                <div className="space-y-1.5">
                  {previewTopic.part3_questions?.map((q, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{q.question_text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setPreviewTopic(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const topicId = previewTopic.id;
                  setPreviewTopic(null);
                  handleStartTest(topicId);
                }}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-200"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Exam With This Set</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
