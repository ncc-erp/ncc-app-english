'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { IELTSSpeakingAttempt } from '@/types/ielts';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { History, Award, Calendar, Clock, ArrowRight, Mic, Sparkles, CheckCircle2, ChevronRight, BarChart3 } from 'lucide-react';

export default function IELTSSpeakingHistoryPage() {
	const { t } = useTranslation();
	const router = useRouter();
	const [attempts, setAttempts] = useState<IELTSSpeakingAttempt[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchHistory() {
			try {
				setLoading(true);
				const res = await fetch('/api/ielts/history');
				const data = await res.json();

				if (!res.ok || !data.success) {
					if (res.status === 401) {
						router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
						return;
					}
					throw new Error(data.error || t('ielts.history.loadError'));
				}

				setAttempts(data.attempts || []);
			} catch (err) {
				console.error('Fetch history error:', err);
				setError((err as Error).message);
			} finally {
				setLoading(false);
			}
		}

		fetchHistory();
	}, [router]);

	// Compute statistics
	const completedAttempts = attempts.filter((a) => a.band_score !== undefined && a.band_score > 0);
	const totalTests = attempts.length;
	const highestBand =
		completedAttempts.length > 0 ? Math.max(...completedAttempts.map((a) => a.band_score!)).toFixed(1) : t('ielts.history.notAvailable');
	const averageBand =
		completedAttempts.length > 0
			? (completedAttempts.reduce((sum, a) => sum + a.band_score!, 0) / completedAttempts.length).toFixed(1)
			: t('ielts.history.notAvailable');

	const formatDate = (isoString: string) => {
		try {
			const date = new Date(isoString);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return isoString;
		}
	};

	return (
		<div className='min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans'>
			<Navbar />

			<main className='flex-1 max-w-6xl mx-auto px-4 py-10 w-full space-y-8'>
				{/* Header Hero Section */}
				<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm'>
					<div className='space-y-1'>
						<div className='inline-flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-full uppercase tracking-wider'>
							<History className='w-3.5 h-3.5' />
							<span>{t('ielts.history.badge')}</span>
						</div>
						<h1 className='text-2xl sm:text-3xl font-extrabold text-slate-900'>{t('ielts.history.heading')}</h1>
						<p className='text-slate-600 text-sm'>{t('ielts.history.subtitle')}</p>
					</div>

					<Link
						href='/ielts-speaking'
						className='inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-purple-200 shrink-0'
					>
						<Mic className='w-4 h-4' />
						<span>{t('ielts.history.startNewTest')}</span>
					</Link>
				</div>

				{error && <div className='p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-medium'>{error}</div>}

				{/* Statistics Metric Overview Cards */}
				<div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
					<div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4'>
						<div className='w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center font-bold'>
							<BarChart3 className='w-6 h-6' />
						</div>
						<div>
							<div className='text-xs uppercase font-bold text-slate-500 tracking-wider'>{t('ielts.history.totalTests')}</div>
							<div className='text-3xl font-extrabold text-slate-900 font-mono mt-0.5'>{totalTests}</div>
						</div>
					</div>

					<div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4'>
						<div className='w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center font-bold'>
							<Award className='w-6 h-6' />
						</div>
						<div>
							<div className='text-xs uppercase font-bold text-slate-500 tracking-wider'>{t('ielts.history.highestBand')}</div>
							<div className='text-3xl font-extrabold text-amber-600 font-mono mt-0.5'>{highestBand}</div>
						</div>
					</div>

					<div className='bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4'>
						<div className='w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold'>
							<Sparkles className='w-6 h-6' />
						</div>
						<div>
							<div className='text-xs uppercase font-bold text-slate-500 tracking-wider'>{t('ielts.history.averageBand')}</div>
							<div className='text-3xl font-extrabold text-indigo-600 font-mono mt-0.5'>{averageBand}</div>
						</div>
					</div>
				</div>

				{/* Attempts List Section */}
				<div className='bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6'>
					<h2 className='text-xl font-bold text-slate-900 flex items-center gap-2'>
						<History className='w-5 h-5 text-purple-600' />
						<span>{t('ielts.history.pastAttempts', { count: attempts.length })}</span>
					</h2>

					{loading ? (
						<div className='py-12 flex flex-col items-center justify-center space-y-3'>
							<div className='w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin' />
							<p className='text-slate-500 text-sm font-medium'>{t('ielts.history.loadingList')}</p>
						</div>
					) : attempts.length === 0 ? (
						<div className='py-16 text-center space-y-4'>
							<div className='w-16 h-16 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto'>
								<Mic className='w-8 h-8' />
							</div>
							<div className='space-y-1'>
								<h3 className='text-lg font-bold text-slate-900'>{t('ielts.history.emptyHeading')}</h3>
								<p className='text-slate-500 text-sm max-w-md mx-auto'>{t('ielts.history.emptyDescription')}</p>
							</div>
							<Link
								href='/ielts-speaking'
								className='inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-purple-200'
							>
								<span>{t('ielts.history.startFirstTest')}</span>
								<ArrowRight className='w-4 h-4' />
							</Link>
						</div>
					) : (
						<div className='space-y-4'>
							{attempts.map((attempt) => {
								const isCompleted = attempt.status === 'submitted' || (attempt.band_score !== undefined && attempt.band_score > 0);
								const isCancelled = attempt.status === 'cancelled';

								return (
									<div
										key={attempt.id}
										className='p-5 border border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 hover:border-purple-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'
									>
										<div className='space-y-2'>
											<div className='flex items-center gap-2.5'>
												<span
													className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
														isCompleted
															? 'bg-emerald-50 text-emerald-700 border-emerald-200'
															: isCancelled
																? 'bg-rose-50 text-rose-700 border-rose-200'
																: 'bg-amber-50 text-amber-800 border-amber-200'
													}`}
												>
													{isCompleted
														? t('ielts.history.statusCompleted')
														: isCancelled
															? t('ielts.history.statusCancelled')
															: t('ielts.history.statusInProgress')}
												</span>

												<span className='text-xs text-slate-500 flex items-center gap-1'>
													<Calendar className='w-3.5 h-3.5' />
													<span>{formatDate(attempt.started_at)}</span>
												</span>
											</div>

											<h3 className='text-lg font-bold text-slate-900'>{attempt.topic_title}</h3>
										</div>

										{/* Right Info & Actions */}
										<div className='flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0'>
											{isCompleted && attempt.band_score ? (
												<div className='flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl'>
													<Award className='w-4 h-4 text-amber-600' />
													<span className='text-xs font-bold text-amber-800 uppercase'>{t('ielts.history.bandLabel')}</span>
													<span className='text-xl font-extrabold font-mono text-amber-700'>{attempt.band_score.toFixed(1)}</span>
												</div>
											) : isCancelled ? (
												<div className='text-xs text-rose-600 font-semibold px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg'>
													{t('ielts.history.notScoredCancelled')}
												</div>
											) : (
												<div className='text-xs text-slate-400 font-semibold px-3 py-1.5 bg-slate-200/60 rounded-lg'>
													{t('ielts.history.notScoredYet')}
												</div>
											)}

											{isCompleted ? (
												<Link
													href={`/ielts-speaking/result/${attempt.id}`}
													className='flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-200 transition-all'
												>
													<span>{t('ielts.history.reviewReport')}</span>
													<ChevronRight className='w-4 h-4' />
												</Link>
											) : isCancelled ? (
												<span className='px-4 py-2 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl border border-slate-200'>
													{t('ielts.history.statusCancelled')}
												</span>
											) : (
												<Link
													href={`/ielts-speaking/test/${attempt.id}`}
													className='flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm shadow-amber-200 transition-all'
												>
													<span>{t('common.continueTest')}</span>
													<ChevronRight className='w-4 h-4' />
												</Link>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
