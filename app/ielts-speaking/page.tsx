'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sparkles, Layers, Search, BookOpen, Eye, ChevronLeft, ChevronRight, Play, X, AlertCircle, Lock } from 'lucide-react';
import { IELTSSpeakingTopic } from '@/types/ielts';
import { useTranslation } from '@/lib/i18n/LanguageContext';

const ITEMS_PER_PAGE = 6;

export default function IELTSSpeakingPortalPage() {
	const { t } = useTranslation();
	const router = useRouter();
	const [topics, setTopics] = useState<IELTSSpeakingTopic[]>([]);
	const [loading, setLoading] = useState(true);
	const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Private topic access state (?token=...)
	const [privateTopic, setPrivateTopic] = useState<IELTSSpeakingTopic | null>(null);
	const [privateToken, setPrivateToken] = useState<string | null>(null);
	const [tokenError, setTokenError] = useState<string | null>(null);

	// Search & Filter state
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('all');

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);

	// Preview Modal state
	const [previewTopic, setPreviewTopic] = useState<IELTSSpeakingTopic | null>(null);

	useEffect(() => {
		const token = new URLSearchParams(window.location.search).get('token');
		if (token) {
			setPrivateToken(token);
			loadPrivateTopic(token);
		}
		loadTopics();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function loadPrivateTopic(token: string) {
		try {
			const res = await fetch(`/api/ielts/start?token=${encodeURIComponent(token)}`);
			const data = await res.json();
			if (data.success && data.topic) {
				setPrivateTopic(data.topic);
			} else {
				setTokenError(data.error || t('ielts.topics.invalidTokenDesc'));
			}
		} catch (err) {
			console.error('Failed to load private IELTS topic:', err);
			setTokenError(t('ielts.topics.invalidTokenDesc'));
		}
	}

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
			setError(t('ielts.topics.loadTopicsError'));
		} finally {
			setLoading(false);
		}
	}

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

	// After login we land on /ielts-speaking?start=<topicId>: start that topic immediately
	useEffect(() => {
		if (loading) return;
		const topicId = new URLSearchParams(window.location.search).get('start');
		if (!topicId) return;
		window.history.replaceState(null, '', '/ielts-speaking');
		handleStartTest(topicId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading]);

	const handleStartTest = async (topicId: string, customToken?: string) => {
		try {
			setStartingTopicId(topicId);
			setError(null);
			const tokenToUse = customToken || privateToken || undefined;
			const res = await fetch('/api/ielts/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ topicId, token: tokenToUse })
			});
			const data = await res.json();

			if (!res.ok || !data.success) {
				if (res.status === 401) {
					// Come back here with ?token=<token> or ?start=<topicId> so the test begins right after login
					const redirectUrl = tokenToUse
						? `/ielts-speaking?token=${encodeURIComponent(tokenToUse)}`
						: `/ielts-speaking?start=${encodeURIComponent(topicId)}`;
					router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
					return;
				}
				throw new Error(data.error || t('ielts.topics.startTestError'));
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
		<div className='min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans'>
			<Navbar />

			<main className='flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-10'>
				{/* Hero Banner Header */}
				<div className='relative overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 text-white rounded-3xl p-8 md:p-10 shadow-xl'>
					<div className='max-w-2xl space-y-3'>
						<div className='inline-flex items-center gap-2 px-3.5 py-1 bg-white/20 border border-white/30 text-white text-xs font-bold rounded-full uppercase tracking-wider'>
							<Sparkles className='w-3.5 h-3.5 text-amber-300' />
							<span>{t('ielts.topics.heroBadge')}</span>
						</div>

						<h1 className='text-3xl md:text-4xl font-extrabold tracking-tight leading-tight'>
							{t('ielts.topics.heroTitlePrefix')} <span className='text-amber-300'>{t('ielts.topics.heroTitleHighlight')}</span>
						</h1>

						<p className='text-purple-100 text-sm leading-relaxed'>{t('ielts.topics.heroSubtitle')}</p>
					</div>
				</div>

				{/* Token Error Notice */}
				{tokenError && (
					<div className='p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-3xl text-xs space-y-1 shadow-sm'>
						<div className='flex items-center gap-2 font-bold'>
							<AlertCircle className='w-4 h-4 text-amber-600 shrink-0' />
							<span>{t('ielts.topics.invalidTokenTitle')}</span>
						</div>
						<p className='text-slate-600 pl-6'>{tokenError}</p>
					</div>
				)}

				{/* Private Topic Access Banner */}
				{privateTopic && (
					<div className='relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-3xl p-6 md:p-8 shadow-xl space-y-4'>
						<div className='flex items-center justify-between gap-2 flex-wrap'>
							<div className='inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 border border-white/30 text-white text-xs font-bold rounded-full uppercase tracking-wider'>
								<Lock className='w-3.5 h-3.5 text-amber-200' />
								<span>{t('ielts.topics.privateBadge')}</span>
							</div>
							{/* <button
								onClick={() => setPreviewTopic(privateTopic)}
								className='px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all'
							>
								<Eye className='w-4 h-4' />
								<span>{t('ielts.topics.previewButton')}</span>
							</button> */}
						</div>

						<div className='space-y-1.5'>
							<h2 className='text-2xl md:text-3xl font-extrabold tracking-tight'>{privateTopic.title}</h2>
							<p className='text-amber-100 text-xs md:text-sm leading-relaxed max-w-3xl'>
								{privateTopic.description || t('ielts.topics.privateNoticeDesc')}
							</p>
						</div>

						<div className='pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/20'>
							<div className='flex items-center gap-2 text-xs'>
								<span className='px-2.5 py-1 bg-white/20 rounded-lg font-medium'>Part 1: {privateTopic.part1_questions?.length || 0} Qs</span>
								<span className='px-2.5 py-1 bg-white/20 rounded-lg font-medium'>Part 2: 1 Cue Card</span>
								<span className='px-2.5 py-1 bg-white/20 rounded-lg font-medium'>Part 3: {privateTopic.part3_questions?.length || 0} Qs</span>
							</div>

							<button
								onClick={() => handleStartTest(privateTopic.id, privateToken || undefined)}
								disabled={startingTopicId === privateTopic.id}
								className='w-full sm:w-auto px-6 py-3 bg-white text-amber-900 hover:bg-amber-50 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50'
							>
								{startingTopicId === privateTopic.id ? (
									<>
										<div className='w-4 h-4 border-2 border-amber-900 border-t-transparent rounded-full animate-spin'></div>
										<span>{t('common.preparingExam')}</span>
									</>
								) : (
									<>
										<Play className='w-4 h-4 fill-amber-900 text-amber-900' />
										<span>{t('ielts.topics.startPrivateExam')}</span>
									</>
								)}
							</button>
						</div>
					</div>
				)}

				{error && (
					<div className='p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-medium flex items-center gap-2'>
						<AlertCircle className='w-4 h-4 shrink-0' />
						<span>{error}</span>
					</div>
				)}

				{/* Search & Category Filters */}
				<div className='space-y-4'>
					<div className='flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm'>
						<div className='relative w-full sm:w-80'>
							<Search className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2' />
							<input
								type='text'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={t('ielts.topics.searchPlaceholder')}
								className='w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white'
							/>
						</div>

						<div className='flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0'>
							<button
								onClick={() => setSelectedCategory('all')}
								className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
									selectedCategory === 'all'
										? 'bg-purple-600 text-white shadow-sm'
										: 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
								}`}
							>
								{t('ielts.topics.allTopics', { count: topics.length })}
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
					<div className='flex items-center justify-between mb-4'>
						<h2 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
							<BookOpen className='w-5 h-5 text-purple-600' />
							<span>{t('ielts.topics.availableTestSets', { count: filteredTopics.length })}</span>
						</h2>
						{filteredTopics.length > 0 && (
							<span className='text-xs text-slate-500'>{t('ielts.topics.pageOf', { current: currentPage, total: totalPages })}</span>
						)}
					</div>

					{loading ? (
						<div className='py-16 text-center text-slate-500 text-xs flex items-center justify-center space-x-2'>
							<div className='w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin'></div>
							<span>{t('ielts.topics.loading')}</span>
						</div>
					) : filteredTopics.length === 0 ? (
						<div className='py-16 text-center bg-white border border-slate-200 rounded-3xl p-8 space-y-3 shadow-sm'>
							<BookOpen className='w-10 h-10 text-slate-400 mx-auto' />
							<div className='text-slate-800 font-bold text-sm'>{t('ielts.topics.noResultsHeading')}</div>
							<p className='text-slate-500 text-xs max-w-sm mx-auto'>{t('ielts.topics.noResultsDescription')}</p>
						</div>
					) : (
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
							{paginatedTopics.map((topic) => (
								<div
									key={topic.id}
									className='bg-white border border-slate-200 hover:border-purple-300 rounded-3xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-5'
								>
									<div className='space-y-3'>
										<div className='flex items-center justify-between gap-2'>
											<span className='px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase tracking-wider'>
												{topic.category || t('ielts.topics.generalCategory')}
											</span>
											<button
												onClick={() => setPreviewTopic(topic)}
												className='p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold'
												title={t('ielts.topics.viewDetailsTitle')}
											>
												<Eye className='w-4 h-4' />
												<span>{t('ielts.topics.previewButton')}</span>
											</button>
										</div>

										<h3 className='text-base font-bold text-slate-900 leading-snug line-clamp-2'>{topic.title}</h3>

										{topic.description && (
											<div className='bg-slate-50 p-3 rounded-2xl border border-slate-100 overflow-hidden'>
												<p className='text-xs text-slate-600 line-clamp-2 leading-relaxed overflow-hidden text-ellipsis'>{topic.description}</p>
											</div>
										)}
									</div>

									<div className='space-y-3 pt-3 border-t border-slate-100'>
										<div className='grid grid-cols-3 gap-1.5 text-center text-[11px]'>
											<div className='bg-purple-50/70 p-2 rounded-xl border border-purple-100'>
												<div className='text-slate-500 text-[10px]'>{t('ielts.topics.part1Short')}</div>
												<div className='font-bold text-purple-700'>
													{t('ielts.topics.questionsCount', { count: topic.part1_questions?.length || 0 })}
												</div>
											</div>
											<div className='bg-pink-50/70 p-2 rounded-xl border border-pink-100'>
												<div className='text-slate-500 text-[10px]'>{t('ielts.topics.part2Short')}</div>
												<div className='font-bold text-pink-700'>{t('ielts.topics.oneCard')}</div>
											</div>
											<div className='bg-emerald-50/70 p-2 rounded-xl border border-emerald-100'>
												<div className='text-slate-500 text-[10px]'>{t('ielts.topics.part3Short')}</div>
												<div className='font-bold text-emerald-700'>
													{t('ielts.topics.questionsCount', { count: topic.part3_questions?.length || 0 })}
												</div>
											</div>
										</div>

										<button
											onClick={() => handleStartTest(topic.id)}
											disabled={startingTopicId === topic.id}
											className='w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-purple-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50'
										>
											{startingTopicId === topic.id ? (
												<>
													<div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
													<span>{t('common.preparingExam')}</span>
												</>
											) : (
												<>
													<Play className='w-4 h-4 fill-white' />
													<span>{t('ielts.topics.startTestSet')}</span>
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
					<div className='flex items-center justify-between border-t border-slate-200 pt-6'>
						<div className='text-xs text-slate-500 font-medium'>
							{t('ielts.topics.showingPrefix')} <span className='font-bold text-slate-900'>{startIndex + 1}</span> {t('ielts.topics.showingTo')}{' '}
							<span className='font-bold text-slate-900'>{Math.min(startIndex + ITEMS_PER_PAGE, filteredTopics.length)}</span>{' '}
							{t('ielts.topics.showingOf')} <span className='font-bold text-slate-900'>{filteredTopics.length}</span>{' '}
							{t('ielts.topics.showingSuffix')}
						</div>

						<div className='flex items-center gap-2'>
							<button
								onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
								disabled={currentPage === 1}
								className='px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-40 disabled:hover:bg-white'
							>
								<ChevronLeft className='w-4 h-4' />
								<span>{t('ielts.topics.previous')}</span>
							</button>

							<div className='flex items-center gap-1'>
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
								className='px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-40 disabled:hover:bg-white'
							>
								<span>{t('ielts.topics.next')}</span>
								<ChevronRight className='w-4 h-4' />
							</button>
						</div>
					</div>
				)}

				{/* 3 Parts Structure Explainer */}
				<div className='bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6'>
					<h2 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
						<Layers className='w-5 h-5 text-purple-600' />
						<span>{t('ielts.topics.overviewHeading')}</span>
					</h2>

					<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
						<div className='p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2'>
							<div className='w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm'>01</div>
							<h3 className='font-bold text-slate-900 text-sm'>{t('ielts.topics.part1Title')}</h3>
							<p className='text-xs text-slate-600 leading-relaxed'>{t('ielts.topics.part1Description')}</p>
						</div>

						<div className='p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2'>
							<div className='w-9 h-9 rounded-xl bg-pink-100 text-pink-700 font-bold flex items-center justify-center text-sm'>02</div>
							<h3 className='font-bold text-slate-900 text-sm'>{t('ielts.topics.part2Title')}</h3>
							<p className='text-xs text-slate-600 leading-relaxed'>{t('ielts.topics.part2Description')}</p>
						</div>

						<div className='p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2'>
							<div className='w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm'>03</div>
							<h3 className='font-bold text-slate-900 text-sm'>{t('ielts.topics.part3Title')}</h3>
							<p className='text-xs text-slate-600 leading-relaxed'>{t('ielts.topics.part3Description')}</p>
						</div>
					</div>
				</div>
			</main>

			{/* Preview Topic Details Modal */}
			{previewTopic && (
				<div className='fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm'>
					<div className='bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto space-y-5 shadow-2xl text-slate-900'>
						<div className='flex items-center justify-between border-b border-slate-100 pb-3'>
							<div>
								<span className='text-[10px] font-bold text-purple-600 uppercase tracking-wider'>{previewTopic.category}</span>
								<h2 className='text-lg font-bold text-slate-900'>{previewTopic.title}</h2>
							</div>
							<button onClick={() => setPreviewTopic(null)} className='p-1.5 text-slate-400 hover:text-slate-700 rounded-lg'>
								<X className='w-5 h-5' />
							</button>
						</div>

						<div className='space-y-4 text-xs'>
							{/* Part 1 */}
							<div className='space-y-2'>
								<span className='font-bold text-purple-700 uppercase text-[11px] block'>
									{t('ielts.topics.part1QuestionsCount', { count: previewTopic.part1_questions?.length || 0 })}
								</span>
								<div className='space-y-1.5'>
									{previewTopic.part1_questions?.map((q, i) => (
										<div key={i} className='p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 flex items-start gap-2'>
											<ChevronRight className='w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5' />
											<span>{q.question_text}</span>
										</div>
									))}
								</div>
							</div>

							{/* Part 2 */}
							<div className='space-y-2 pt-2 border-t border-slate-100'>
								<span className='font-bold text-pink-700 uppercase text-[11px] block'>{t('ielts.topics.part2CueCardLabel')}</span>
								<div className='p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2'>
									<div className='font-bold text-slate-900 text-sm'>{previewTopic.part2_cue_card?.cue_card_title}</div>
									<div className='text-slate-600 italic'>{previewTopic.part2_cue_card?.prompt_lead}</div>
									<ul className='list-disc pl-5 space-y-1 text-slate-700'>
										{previewTopic.part2_cue_card?.bullet_points.map((b, i) => (
											<li key={i}>{b}</li>
										))}
									</ul>
								</div>
							</div>

							{/* Part 3 */}
							<div className='space-y-2 pt-2 border-t border-slate-100'>
								<span className='font-bold text-emerald-700 uppercase text-[11px] block'>
									{t('ielts.topics.part3QuestionsCount', { count: previewTopic.part3_questions?.length || 0 })}
								</span>
								<div className='space-y-1.5'>
									{previewTopic.part3_questions?.map((q, i) => (
										<div key={i} className='p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 flex items-start gap-2'>
											<ChevronRight className='w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5' />
											<span>{q.question_text}</span>
										</div>
									))}
								</div>
							</div>
						</div>

						<div className='pt-4 border-t border-slate-100 flex items-center justify-end gap-3'>
							<button
								onClick={() => setPreviewTopic(null)}
								className='px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl'
							>
								{t('ielts.topics.closeButton')}
							</button>
							<button
								onClick={() => {
									const topicId = previewTopic.id;
									setPreviewTopic(null);
									handleStartTest(topicId);
								}}
								className='px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-200'
							>
								<Play className='w-3.5 h-3.5 fill-white' />
								<span>{t('ielts.topics.startWithThisSet')}</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
