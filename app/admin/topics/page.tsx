'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { IELTSSpeakingTopic } from '@/types/ielts';
import { UserSession } from '@/types';
import {
  ShieldAlert,
  Plus,
  Search,
  Edit2,
  Trash2,
  BookOpen,
  Sparkles,
  Layers,
  HelpCircle,
  FileText,
  X,
  Check,
  Loader2,
  AlertCircle,
  ChevronRight,
  Eye,
} from 'lucide-react';

export default function AdminTopicsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [topics, setTopics] = useState<IELTSSpeakingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<IELTSSpeakingTopic | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<IELTSSpeakingTopic | null>(null);
  const [previewTopic, setPreviewTopic] = useState<IELTSSpeakingTopic | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formPart1Questions, setFormPart1Questions] = useState<string[]>(['']);
  const [formPart2Title, setFormPart2Title] = useState('');
  const [formPart2PromptLead, setFormPart2PromptLead] = useState('You should say:');
  const [formPart2Bullets, setFormPart2Bullets] = useState<string[]>(['What it is', 'Where it took place', 'Who was involved']);
  const [formPart2FollowUp, setFormPart2FollowUp] = useState('');
  const [formPart3Questions, setFormPart3Questions] = useState<string[]>(['']);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Verify Admin Session
  useEffect(() => {
    async function checkAuth() {
      try {
        setAuthLoading(true);
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (data.isLoggedIn && data.user && (data.user.mezon_username === 'admin' || data.user.mezon_id === 'admin_sys_001')) {
          setUser(data.user);
          fetchTopics();
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Admin auth check error:', err);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Fetch Topics List
  const fetchTopics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/topics');
      const data = await res.json();
      if (data.success && data.topics) {
        setTopics(data.topics);
      }
    } catch (err) {
      console.error('Fetch admin topics error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingTopic(null);
    setFormTitle('');
    setFormCategory('General');
    setFormPart1Questions(['Do you work or are you a student?', 'What do you enjoy most about your daily routine?']);
    setFormPart2Title('Describe a memorable experience');
    setFormPart2PromptLead('You should say:');
    setFormPart2Bullets(['What the experience was', 'When and where it happened', 'Who you were with', 'And explain why it was memorable to you']);
    setFormPart2FollowUp('Do you often think back to this experience?');
    setFormPart3Questions(['Why do people value new experiences?', 'How do experiences influence personal growth?']);
    setErrorMsg('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (t: IELTSSpeakingTopic) => {
    setEditingTopic(t);
    setFormTitle(t.title);
    setFormCategory(t.category || 'General');
    setFormPart1Questions(t.part1_questions?.map((q) => q.question_text) || ['']);
    setFormPart2Title(t.part2_cue_card?.cue_card_title || t.title);
    setFormPart2PromptLead(t.part2_cue_card?.prompt_lead || 'You should say:');
    setFormPart2Bullets(t.part2_cue_card?.bullet_points || ['']);
    setFormPart2FollowUp(t.part2_cue_card?.follow_up_question || '');
    setFormPart3Questions(t.part3_questions?.map((q) => q.question_text) || ['']);
    setErrorMsg('');
    setIsCreateModalOpen(true);
  };

  // Submit Save Form (Create or Update)
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formTitle.trim() || !formCategory.trim()) {
      setErrorMsg('Topic title and category are required.');
      return;
    }

    setSaving(true);

    try {
      const topicPayload = {
        title: formTitle.trim(),
        category: formCategory.trim(),
        part1_questions: formPart1Questions
          .filter((q) => q.trim().length > 0)
          .map((q, idx) => ({
            id: `p1-${idx + 1}-${Date.now()}`,
            topic_title: formTitle.trim(),
            question_text: q.trim(),
          })),
        part2_cue_card: {
          id: `cue-${Date.now()}`,
          topic_title: formTitle.trim(),
          cue_card_title: formPart2Title.trim() || formTitle.trim(),
          prompt_lead: formPart2PromptLead.trim() || 'You should say:',
          bullet_points: formPart2Bullets.filter((b) => b.trim().length > 0),
          follow_up_question: formPart2FollowUp.trim() || undefined,
        },
        part3_questions: formPart3Questions
          .filter((q) => q.trim().length > 0)
          .map((q, idx) => ({
            id: `p3-${idx + 1}-${Date.now()}`,
            topic_title: formTitle.trim(),
            question_text: q.trim(),
          })),
      };

      const url = editingTopic ? `/api/admin/topics/${editingTopic.id}` : '/api/admin/topics';
      const method = editingTopic ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicPayload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save topic set.');
      }

      setIsCreateModalOpen(false);
      fetchTopics();
    } catch (err) {
      console.error('Save topic error:', err);
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Delete Topic
  const handleDeleteTopic = async () => {
    if (!deletingTopic) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/topics/${deletingTopic.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete topic');
      }
      setDeletingTopic(null);
      fetchTopics();
    } catch (err) {
      console.error('Delete topic error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Filtered Topics
  const categories = Array.from(new Set(topics.map((t) => t.category || 'General')));
  const filteredTopics = topics.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="text-sm font-medium text-slate-600">Verifying Admin Access...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              You must be logged in as an Administrator (`admin`) to access the IELTS Topic Management Portal.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-200"
            >
              Go to Login Page
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar user={user} />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-8">
        {/* Portal Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Admin Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">IELTS Test Set Management</h1>
            <p className="text-xs text-slate-600">
              Create, edit, and update IELTS Speaking test sets (Part 1, Part 2 Cue Cards, and Part 3 Questions).
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-purple-200 transition-all hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Test Set</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Total Test Sets</div>
              <div className="text-xl font-extrabold text-slate-900">{topics.length}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Part 1 Questions</div>
              <div className="text-xl font-extrabold text-slate-900">
                {topics.reduce((acc, t) => acc + (t.part1_questions?.length || 0), 0)}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Part 2 Cue Cards</div>
              <div className="text-xl font-extrabold text-slate-900">{topics.length}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Part 3 Questions</div>
              <div className="text-xl font-extrabold text-slate-900">
                {topics.reduce((acc, t) => acc + (t.part3_questions?.length || 0), 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics by title..."
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
              All ({topics.length})
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

        {/* Topics List Grid */}
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            <span>Loading test sets...</span>
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="py-16 text-center bg-white border border-slate-200 rounded-3xl p-8 space-y-3 shadow-sm">
            <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="text-slate-800 font-bold text-sm">No Test Sets Found</div>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              {searchQuery ? 'No topic matching your search criteria.' : 'Click "Create New Test Set" to add your first IELTS Speaking topic.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTopics.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-slate-200 hover:border-purple-300 rounded-3xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                      {t.category || 'General'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewTopic(t)}
                        className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                        title="Preview Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="p-2 text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all"
                        title="Edit Test Set"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingTopic(t)}
                        className="p-2 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                        title="Delete Test Set"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{t.title}</h3>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] text-slate-500">Part 1</div>
                    <div className="font-bold text-purple-700">{t.part1_questions?.length || 0} Questions</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] text-slate-500">Part 2</div>
                    <div className="font-bold text-pink-700 truncate max-w-full" title={t.part2_cue_card?.cue_card_title}>
                      1 Cue Card
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] text-slate-500">Part 3</div>
                    <div className="font-bold text-emerald-700">{t.part3_questions?.length || 0} Questions</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-50 text-purple-700 rounded-2xl border border-purple-200">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingTopic ? 'Edit IELTS Test Set' : 'Create New IELTS Test Set'}
                  </h2>
                  <p className="text-xs text-slate-500">Specify Title, Category, and Questions for Part 1, 2 & 3.</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveTopic} className="space-y-6 text-xs text-slate-700">
              {/* General Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-900 block">Topic Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Work and Studies, Technology in Daily Life"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-900 block">Category *</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. Daily Life, Education, Technology, Travel"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Part 1 Questions */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-700 text-sm">Part 1 Questions</span>
                  <button
                    type="button"
                    onClick={() => setFormPart1Questions([...formPart1Questions, ''])}
                    className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Question
                  </button>
                </div>

                {formPart1Questions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => {
                        const updated = [...formPart1Questions];
                        updated[idx] = e.target.value;
                        setFormPart1Questions(updated);
                      }}
                      placeholder={`Part 1 Question ${idx + 1}`}
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                    />
                    {formPart1Questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormPart1Questions(formPart1Questions.filter((_, i) => i !== idx))}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Part 2 Cue Card Details */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <span className="font-bold text-pink-700 text-sm block">Part 2 Cue Card</span>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">Cue Card Title</label>
                  <input
                    type="text"
                    value={formPart2Title}
                    onChange={(e) => setFormPart2Title(e.target.value)}
                    placeholder="e.g. Describe a website that you visit frequently"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 block">Prompt Lead</label>
                  <input
                    type="text"
                    value={formPart2PromptLead}
                    onChange={(e) => setFormPart2PromptLead(e.target.value)}
                    placeholder="e.g. You should say:"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800">Bullet Points</label>
                    <button
                      type="button"
                      onClick={() => setFormPart2Bullets([...formPart2Bullets, ''])}
                      className="text-[11px] text-pink-700 hover:text-pink-900 flex items-center gap-1 font-bold"
                    >
                      <Plus className="w-3 h-3" /> Add Bullet
                    </button>
                  </div>

                  {formPart2Bullets.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={b}
                        onChange={(e) => {
                          const updated = [...formPart2Bullets];
                          updated[idx] = e.target.value;
                          setFormPart2Bullets(updated);
                        }}
                        placeholder={`Bullet Point ${idx + 1}`}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                      />
                      {formPart2Bullets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormPart2Bullets(formPart2Bullets.filter((_, i) => i !== idx))}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="font-semibold text-slate-800 block">Follow-up Question (Optional)</label>
                  <input
                    type="text"
                    value={formPart2FollowUp}
                    onChange={(e) => setFormPart2FollowUp(e.target.value)}
                    placeholder="e.g. Do you recommend this website to others?"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Part 3 Questions */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-700 text-sm">Part 3 Discussion Questions</span>
                  <button
                    type="button"
                    onClick={() => setFormPart3Questions([...formPart3Questions, ''])}
                    className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Question
                  </button>
                </div>

                {formPart3Questions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => {
                        const updated = [...formPart3Questions];
                        updated[idx] = e.target.value;
                        setFormPart3Questions(updated);
                      }}
                      placeholder={`Part 3 Question ${idx + 1}`}
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none"
                    />
                    {formPart3Questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormPart3Questions(formPart3Questions.filter((_, i) => i !== idx))}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit Controls */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-md shadow-purple-200 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingTopic ? 'Update Test Set' : 'Create Test Set'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTopic && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Test Set?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              Are you sure you want to permanently delete <strong className="text-slate-900">"{deletingTopic.title}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingTopic(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTopic}
                disabled={saving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-200 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Set</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Details Modal */}
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
          </div>
        </div>
      )}
    </div>
  );
}
