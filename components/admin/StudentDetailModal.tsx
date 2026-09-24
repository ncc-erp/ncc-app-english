'use client';

import React, { useEffect, useState } from 'react';
import {
	X,
	Mic,
	Award,
	Clock,
	Sparkles,
	ChevronDown,
	ChevronUp,
	ChevronLeft,
	ChevronRight,
	AlertCircle,
	Loader2,
	CheckCircle2,
	Calendar,
	Layers,
	GraduationCap,
	Volume2,
	Download
} from 'lucide-react';
import { IELTSSpeakingAttempt, IELTSPerQuestionAnalysis, IELTSSpeakingResponse } from '@/types/ielts';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface StudentProfile {
	mezon_id: string;
	username: string;
	display_name: string;
	avatar_url?: string;
}

interface StudentStats {
	total_speaking_attempts: number;
	average_speaking_band: number | null;
	highest_speaking_band: number | null;
	latest_attempt_at: string | null;
}

interface StudentDetailModalProps {
	studentId: string | null;
	onClose: () => void;
}

interface QuestionReviewItem {
	id: string;
	partTitle: string;
	questionText: string;
	bulletPoints?: string[];
	response?: IELTSSpeakingResponse;
	analysis?: IELTSPerQuestionAnalysis;
}

function extractAttemptQuestions(att: IELTSSpeakingAttempt): QuestionReviewItem[] {
	const items: QuestionReviewItem[] = [];
	const responses = att.responses || att.score_result?.responses || {};
	const perQuestion = att.score_result?.per_question_analysis;

	const getAnalysis = (qid: string, idx: number): IELTSPerQuestionAnalysis | undefined => {
		if (!perQuestion) return undefined;
		if (Array.isArray(perQuestion)) {
			return (perQuestion as any[]).find((p: any) => p?.question_id === qid) || (perQuestion as any[])[idx];
		}
		if (typeof perQuestion === 'object') {
			return (perQuestion as Record<string, IELTSPerQuestionAnalysis>)[qid];
		}
		return undefined;
	};

	let globalIdx = 0;

	// 1. Part 1 Questions
	const part1 = att.score_result?.part1_questions;
	if (part1 && Array.isArray(part1)) {
		part1.forEach((q, idx) => {
			items.push({
				id: q.id,
				partTitle: `Part 1 • Question ${idx + 1}`,
				questionText: q.question_text,
				response: responses[q.id],
				analysis: getAnalysis(q.id, globalIdx++)
			});
		});
	}

	// 2. Part 2 Cue Card
	const part2 = att.score_result?.part2_cue_card;
	if (part2) {
		items.push({
			id: part2.id,
			partTitle: 'Part 2 • Cue Card (Long Turn)',
			questionText: part2.prompt_lead || part2.cue_card_title || 'Describe a topic',
			bulletPoints: part2.bullet_points,
			response: responses[part2.id],
			analysis: getAnalysis(part2.id, globalIdx++)
		});
	}

	// 3. Part 3 Questions
	const part3 = att.score_result?.part3_questions;
	if (part3 && Array.isArray(part3)) {
		part3.forEach((q, idx) => {
			items.push({
				id: q.id,
				partTitle: `Part 3 • Discussion ${idx + 1}`,
				questionText: q.question_text,
				response: responses[q.id],
				analysis: getAnalysis(q.id, globalIdx++)
			});
		});
	}

	// Fallback if structured part questions were not saved on score_result:
	// inspect responses or per_question_analysis keys directly
	if (items.length === 0) {
		const allKeys = Array.from(new Set([...Object.keys(responses), ...(perQuestion && !Array.isArray(perQuestion) ? Object.keys(perQuestion) : [])]));

		allKeys.forEach((qid, idx) => {
			const resp = responses[qid];
			const ana = getAnalysis(qid, idx);
			items.push({
				id: qid,
				partTitle: resp?.part ? `${resp.part.toUpperCase()} • Question ${idx + 1}` : `Question ${idx + 1}`,
				questionText: ana?.question_text || `Question ${idx + 1}`,
				bulletPoints: undefined,
				response: resp,
				analysis: ana
			});
		});
	}

	return items;
}

const AttemptQuestionViewer: React.FC<{ questions: QuestionReviewItem[] }> = ({ questions }) => {
	const { t } = useTranslation();
	const [currentIndex, setCurrentIndex] = useState(0);

	if (!questions || questions.length === 0) return null;

	const safeIndex = Math.min(Math.max(0, currentIndex), questions.length - 1);
	const qItem = questions[safeIndex];

	const [audioError, setAudioError] = useState(false);
	const [audioKey, setAudioKey] = useState(0);

	useEffect(() => {
		setAudioError(false);
	}, [safeIndex]);

	const rawAudioUrl = qItem.response?.audio_url;
	const storagePath = qItem.response?.audio_storage_path;
	let audioSrc: string | undefined = undefined;

	if (storagePath) {
		audioSrc = `/api/admin/audio?path=${encodeURIComponent(storagePath)}`;
	} else if (rawAudioUrl) {
		if (rawAudioUrl.startsWith('/api/admin/audio')) {
			audioSrc = rawAudioUrl;
		} else {
			const match = rawAudioUrl.match(/(?:ielts-recordings|ielts-speaking-recordings)\/([^?#]+)/);
			if (match?.[1]) {
				audioSrc = `/api/admin/audio?path=${encodeURIComponent(decodeURIComponent(match[1]))}`;
			} else {
				audioSrc = rawAudioUrl;
			}
		}
	}

	const handlePrev = () => {
		setCurrentIndex((prev) => Math.max(0, prev - 1));
	};

	const handleNext = () => {
		setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
	};

	return (
		<div className='space-y-3 pt-2'>
			{/* Top Header & Prev/Next Navigation */}
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80'>
				<div className='flex items-center gap-2'>
					<div className='w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0'>
						<Volume2 className='w-4 h-4' />
					</div>
					<div>
						<div className='text-[11px] font-bold text-slate-800 uppercase tracking-wider'>Question-by-Question Evaluation & Audio Playback</div>
						<div className='text-[10px] text-slate-500 font-medium'>
							Question <span className='font-bold text-purple-700'>{safeIndex + 1}</span> of{' '}
							<span className='font-bold text-slate-700'>{questions.length}</span>
						</div>
					</div>
				</div>

				{/* Top Prev / Next Buttons */}
				<div className='flex items-center gap-2 self-end sm:self-auto'>
					<button
						type='button'
						onClick={handlePrev}
						disabled={safeIndex === 0}
						className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
							safeIndex === 0
								? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
								: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-purple-700 active:scale-95 shadow-sm'
						}`}
					>
						<ChevronLeft className='w-3.5 h-3.5' />
						<span>Back</span>
					</button>

					<button
						type='button'
						onClick={handleNext}
						disabled={safeIndex === questions.length - 1}
						className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
							safeIndex === questions.length - 1
								? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
								: 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 active:scale-95 shadow-sm'
						}`}
					>
						<span>Next</span>
						<ChevronRight className='w-3.5 h-3.5' />
					</button>
				</div>
			</div>

			{/* Quick Jump Buttons (Numbered Pills) */}
			<div className='flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin'>
				{questions.map((q, idx) => {
					const isActive = idx === safeIndex;
					const hasAudio = Boolean(q.response?.audio_url || q.response?.audio_storage_path);
					return (
						<button
							key={q.id || idx}
							type='button'
							onClick={() => setCurrentIndex(idx)}
							title={`${q.partTitle}: ${q.questionText}`}
							className={`relative shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
								isActive
									? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-300 ring-offset-1'
									: 'bg-white text-slate-600 border border-slate-200 hover:bg-purple-50 hover:text-purple-700'
							}`}
						>
							<span>Q{idx + 1}</span>
							{hasAudio && <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-purple-200' : 'bg-purple-500'}`} title='Audio available' />}
						</button>
					);
				})}
			</div>

			{/* Active Question Detail Card */}
			<div className='bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs transition-all'>
				{/* Question Header & Prompt */}
				<div className='space-y-1.5'>
					<div className='flex items-center justify-between gap-2 flex-wrap'>
						<span className='text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200'>
							{qItem.partTitle}
						</span>
						<span className='text-[11px] text-slate-400 font-medium'>
							Question {safeIndex + 1} of {questions.length}
						</span>
					</div>

					<div className='text-sm font-bold text-slate-900 pt-0.5 leading-snug'>{qItem.questionText}</div>

					{/* Part 2 Cue Card Bullets */}
					{qItem.bulletPoints && qItem.bulletPoints.length > 0 && (
						<ul className='list-disc pl-5 text-xs text-slate-600 space-y-0.5 pt-1'>
							{qItem.bulletPoints.map((bp, bIdx) => (
								<li key={bIdx}>{bp}</li>
							))}
						</ul>
					)}
				</div>

				{/* Student Audio Recording Player */}
				{audioSrc ? (
					<div className='p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-2'>
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
							<div className='flex items-center gap-2 text-xs font-bold text-purple-900 shrink-0'>
								<Volume2 className='w-4 h-4 text-purple-600' />
								<span>Student Recording</span>
								{qItem.response?.duration_seconds ? (
									<span className='text-[11px] text-purple-700 font-mono font-normal'>({Math.round(qItem.response.duration_seconds)}s)</span>
								) : null}
							</div>

							<div className='flex items-center gap-2'>
								<a
									href={audioSrc}
									target='_blank'
									rel='noopener noreferrer'
									download={`recording-${qItem.id}.webm`}
									className='px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-xs'
									title='Open or download recording directly'
								>
									<Download className='w-3.5 h-3.5' />
									<span>Download</span>
								</a>
							</div>
						</div>

						<audio
							key={`${qItem.id}-${audioKey}`}
							controls
							src={audioSrc}
							className='w-full h-8 accent-purple-600 rounded-lg'
							preload='metadata'
							onError={() => setAudioError(true)}
						/>

						{audioError && (
							<div className='flex items-center justify-between gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs'>
								<div className='flex items-center gap-1.5'>
									<AlertCircle className='w-3.5 h-3.5 shrink-0 text-rose-600' />
									<span>Audio file could not be played directly by the browser.</span>
								</div>
								<div className='flex items-center gap-2 shrink-0'>
									<button
										type='button'
										onClick={() => {
											setAudioError(false);
											setAudioKey((k) => k + 1);
										}}
										className='underline text-xs font-bold hover:text-rose-900'
									>
										Retry
									</button>
									<a href={audioSrc} target='_blank' rel='noopener noreferrer' className='underline text-xs font-bold hover:text-rose-900'>
										Open directly
									</a>
								</div>
							</div>
						)}
					</div>
				) : (
					<div className='text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100'>
						No audio recording available for this question.
					</div>
				)}

				{/* Student Transcript */}
				{(qItem.response?.transcript || qItem.analysis?.live_stt_transcript || qItem.analysis?.ai_generated_transcript) && (
					<div className='space-y-1'>
						<span className='text-[10px] font-bold text-slate-500 uppercase tracking-wider'>Student Transcript:</span>
						<p className='p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-800 italic leading-relaxed whitespace-pre-wrap break-words'>
							"{qItem.response?.transcript || qItem.analysis?.live_stt_transcript || qItem.analysis?.ai_generated_transcript}"
						</p>
					</div>
				)}

				{/* AI Examiner Feedback on this specific answer */}
				{qItem.analysis?.feedback && (
					<div className='space-y-1'>
						<span className='text-[10px] font-bold text-indigo-700 uppercase tracking-wider'>Examiner Feedback:</span>
						<p className='text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words'>{qItem.analysis.feedback}</p>
					</div>
				)}

				{/* Suggested Answers */}
				{(qItem.analysis?.academic_answer || qItem.analysis?.natural_answer || qItem.analysis?.improved_version) && (
					<div className='p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1'>
						<div className='text-[10px] font-extrabold text-emerald-800 uppercase flex items-center gap-1'>
							<CheckCircle2 className='w-3.5 h-3.5 text-emerald-600' />
							<span>{t('ielts.audioReviewer.modelResponseLabel')}:</span>
						</div>
						{(qItem.analysis.academic_answer || qItem.analysis.improved_version) && (
							<p className='text-xs text-emerald-950 font-medium leading-relaxed whitespace-pre-wrap break-words'>
								<strong>{t('ielts.audioReviewer.academicAnswerLabel')}:</strong> {qItem.analysis.academic_answer || qItem.analysis.improved_version}
							</p>
						)}
						{qItem.analysis.natural_answer && (
							<p className='text-xs text-emerald-950 font-medium leading-relaxed whitespace-pre-wrap break-words'>
								<strong>{t('ielts.audioReviewer.naturalAnswerLabel')}:</strong> {qItem.analysis.natural_answer}
							</p>
						)}
					</div>
				)}

				{/* Grammar Corrections */}
				{qItem.analysis?.grammar_corrections && qItem.analysis.grammar_corrections.length > 0 && (
					<div className='space-y-1 pt-1'>
						<span className='text-[10px] font-bold text-rose-600 uppercase tracking-wider'>Grammar Corrections:</span>
						<ul className='list-disc pl-5 text-xs text-rose-950 space-y-0.5'>
							{qItem.analysis.grammar_corrections.map((gc, gcIdx) => (
								<li key={gcIdx} className='whitespace-pre-wrap break-words'>
									{gc}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Bottom Prev / Next Navigation Footer */}
				<div className='pt-3 border-t border-slate-100 flex items-center justify-between gap-3'>
					<button
						type='button'
						onClick={handlePrev}
						disabled={safeIndex === 0}
						className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
							safeIndex === 0
								? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
								: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-purple-700 active:scale-95 shadow-sm'
						}`}
					>
						<ChevronLeft className='w-3.5 h-3.5' />
						<span>Previous Question</span>
					</button>

					<span className='text-[11px] text-slate-400 font-medium hidden sm:inline-block'>
						{safeIndex + 1} / {questions.length}
					</span>

					<button
						type='button'
						onClick={handleNext}
						disabled={safeIndex === questions.length - 1}
						className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
							safeIndex === questions.length - 1
								? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
								: 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 active:scale-95 shadow-sm'
						}`}
					>
						<span>Next Question</span>
						<ChevronRight className='w-3.5 h-3.5' />
					</button>
				</div>
			</div>
		</div>
	);
};

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ studentId, onClose }) => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [student, setStudent] = useState<StudentProfile | null>(null);
	const [stats, setStats] = useState<StudentStats | null>(null);
	const [attempts, setAttempts] = useState<IELTSSpeakingAttempt[]>([]);
	const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

	useEffect(() => {
		if (!studentId) return;

		let isMounted = true;
		async function fetchStudentAttempts() {
			try {
				setLoading(true);
				setError('');
				const res = await fetch(`/api/admin/students/${studentId}/attempts`);
				const data = await res.json();

				if (isMounted) {
					if (data.success) {
						setStudent(data.student);
						setStats(data.stats);
						setAttempts(data.attempts || []);
						// Auto-expand the most recent attempt by default
						if (data.attempts && data.attempts.length > 0) {
							setExpandedAttemptId(data.attempts[0].id);
						}
					} else {
						setError(data.error || 'Failed to load student details.');
					}
				}
			} catch (err) {
				if (isMounted) {
					console.error('Fetch student attempts error:', err);
					setError('Network error occurred while loading student details.');
				}
			} finally {
				if (isMounted) setLoading(false);
			}
		}

		fetchStudentAttempts();

		return () => {
			isMounted = false;
		};
	}, [studentId]);

	if (!studentId) return null;

	const toggleAttempt = (id: string) => {
		setExpandedAttemptId((prev) => (prev === id ? null : id));
	};

	const getBandBadgeColor = (band?: number | null) => {
		if (!band) return 'bg-slate-100 text-slate-700 border-slate-200';
		if (band >= 7.5) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
		if (band >= 6.5) return 'bg-indigo-50 text-indigo-700 border-indigo-300';
		if (band >= 5.5) return 'bg-purple-50 text-purple-700 border-purple-300';
		if (band >= 4.5) return 'bg-amber-50 text-amber-700 border-amber-300';
		return 'bg-rose-50 text-rose-700 border-rose-300';
	};

	return (
		<div className='fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto'>
			<div className='bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-200'>
				{/* Modal Header */}
				<div className='flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70 shrink-0'>
					<div className='flex items-center space-x-3.5'>
						<div className='w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-200'>
							<GraduationCap className='w-6 h-6' />
						</div>
						<div>
							<div className='flex items-center gap-2'>
								<h2 className='text-lg font-bold text-slate-900'>{student?.display_name || student?.username || 'Student Details'}</h2>
								<span className='px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200'>
									Role: Student
								</span>
							</div>
							<p className='text-xs text-slate-500 font-mono'>
								@{student?.username || 'user'} • Mezon ID: {student?.mezon_id}
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className='p-2 text-slate-400 hover:text-slate-700 rounded-2xl hover:bg-slate-200/60 transition-colors'
						title='Close'
					>
						<X className='w-5 h-5' />
					</button>
				</div>

				{/* Modal Body */}
				<div className='flex-1 overflow-y-auto p-6 space-y-6'>
					{loading ? (
						<div className='py-20 flex flex-col items-center justify-center space-y-3 text-slate-500'>
							<Loader2 className='w-8 h-8 animate-spin text-purple-600' />
							<p className='text-xs font-medium'>Loading speaking test history and evaluations...</p>
						</div>
					) : error ? (
						<div className='p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-3'>
							<AlertCircle className='w-5 h-5 shrink-0' />
							<span>{error}</span>
						</div>
					) : (
						<>
							{/* Speaking Analytics Metric Cards */}
							<div className='grid grid-cols-2 sm:grid-cols-4 gap-3.5'>
								<div className='bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-sm'>
									<div className='w-10 h-10 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center shrink-0'>
										<Mic className='w-5 h-5' />
									</div>
									<div>
										<div className='text-[11px] text-slate-500 font-medium'>Speaking Tests Taken</div>
										<div className='text-xl font-extrabold text-slate-900'>{stats?.total_speaking_attempts || 0}</div>
									</div>
								</div>

								<div className='bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-sm'>
									<div className='w-10 h-10 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0'>
										<Sparkles className='w-5 h-5' />
									</div>
									<div>
										<div className='text-[11px] text-slate-500 font-medium'>Average Band</div>
										<div className='text-xl font-extrabold text-indigo-700'>
											{stats?.average_speaking_band ? `Band ${stats.average_speaking_band}` : 'N/A'}
										</div>
									</div>
								</div>

								<div className='bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-sm'>
									<div className='w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0'>
										<Award className='w-5 h-5' />
									</div>
									<div>
										<div className='text-[11px] text-slate-500 font-medium'>Highest Band</div>
										<div className='text-xl font-extrabold text-emerald-700'>
											{stats?.highest_speaking_band ? `Band ${stats.highest_speaking_band}` : 'N/A'}
										</div>
									</div>
								</div>

								<div className='bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-sm'>
									<div className='w-10 h-10 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center shrink-0'>
										<Clock className='w-5 h-5' />
									</div>
									<div>
										<div className='text-[11px] text-slate-500 font-medium'>Latest Attempt</div>
										<div className='text-xs font-bold text-slate-800 truncate max-w-[130px]' title={stats?.latest_attempt_at || ''}>
											{stats?.latest_attempt_at
												? new Date(stats.latest_attempt_at).toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric',
														year: 'numeric'
													})
												: 'N/A'}
										</div>
									</div>
								</div>
							</div>

							{/* Detailed Speaking Attempts List */}
							<div className='space-y-4 pt-2'>
								<div className='flex items-center justify-between'>
									<h3 className='text-sm font-extrabold text-slate-900 flex items-center gap-2'>
										<Layers className='w-4 h-4 text-purple-600' />
										<span>Speaking Test History & Evaluations ({attempts.length})</span>
									</h3>
								</div>

								{attempts.length === 0 ? (
									<div className='py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-6 space-y-2'>
										<Mic className='w-8 h-8 text-slate-400 mx-auto' />
										<p className='text-xs font-bold text-slate-700'>No Speaking tests recorded yet</p>
										<p className='text-[11px] text-slate-500 max-w-sm mx-auto'>
											When this student completes an IELTS Speaking mock test on the platform or through the Mezon bot, their scores and detailed
											examiner feedback will appear here.
										</p>
									</div>
								) : (
									<div className='space-y-3.5'>
										{attempts.map((att, index) => {
											const isExpanded = expandedAttemptId === att.id;
											const band = att.band_score ?? att.score_result?.overall_band;
											const criteria = att.score_result?.criteria_scores || [];
											const overallFeedback = att.score_result?.summary_feedback || (att.score_result as any)?.general_feedback || '';
											const strengths = att.score_result?.strengths || [];
											const areasForImprovement = att.score_result?.areas_for_improvement || [];
											const criterionFeedback = att.score_result?.criterion_feedback;
											const questionItems = isExpanded ? extractAttemptQuestions(att) : [];

											return (
												<div
													key={att.id}
													className='bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-purple-300'
												>
													{/* Attempt Header Card */}
													<div
														onClick={() => toggleAttempt(att.id)}
														className='p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors'
													>
														<div className='flex items-center gap-3.5'>
															<div className='w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-purple-200'>
																#{attempts.length - index}
															</div>
															<div className='space-y-0.5'>
																<div className='text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap'>
																	<span>{att.topic_title || 'IELTS Speaking Test'}</span>
																	<span className='text-[10px] text-slate-400 font-mono font-normal'>ID: {att.id}</span>
																</div>
																<div className='text-[11px] text-slate-500 flex items-center gap-3 flex-wrap'>
																	<span className='flex items-center gap-1'>
																		<Calendar className='w-3 h-3 text-slate-400' />
																		{new Date(att.submitted_at || att.started_at).toLocaleString('en-US', {
																			dateStyle: 'medium',
																			timeStyle: 'short'
																		})}
																	</span>
																	<span className='capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600'>
																		{att.status === 'submitted' ? 'Submitted' : att.status || 'Completed'}
																	</span>
																</div>
															</div>
														</div>

														<div className='flex items-center justify-between sm:justify-end gap-3 shrink-0'>
															<div className={`px-3 py-1.5 rounded-xl border font-black text-xs ${getBandBadgeColor(band)}`}>
																{band !== undefined && band !== null ? `Band ${band}` : 'Pending'}
															</div>

															<button
																type='button'
																className='p-1 text-slate-400 hover:text-slate-700 rounded-lg'
																aria-label={isExpanded ? 'Collapse attempt details' : 'Expand attempt details'}
															>
																{isExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
															</button>
														</div>
													</div>

													{/* Expanded Details Panel */}
													{isExpanded && (
														<div className='px-5 pb-5 pt-3 border-t border-slate-100 space-y-6 bg-slate-50/40'>
															{/* 1. 4 Scoring Criteria Breakdown (Full text visible) */}
															{criteria.length > 0 && (
																<div className='space-y-2'>
																	<div className='text-[11px] font-bold text-slate-500 uppercase tracking-wider'>
																		IELTS Scoring Criteria Breakdown
																	</div>
																	<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
																		{criteria.map((c) => (
																			<div key={c.code} className='bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-2'>
																				<div className='flex items-center justify-between'>
																					<span className='text-xs font-extrabold text-slate-800'>
																						{c.code} - {c.name}
																					</span>
																					<span className='text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200'>
																						Band {c.score}
																					</span>
																				</div>
																				{/* Full summary text without any line clamping */}
																				<p className='text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words'>{c.summary}</p>
																				{/* Full key observations list if present */}
																				{c.key_observations && c.key_observations.length > 0 && (
																					<div className='pt-2 border-t border-slate-100 space-y-1'>
																						<span className='text-[10px] font-bold text-slate-500 uppercase'>Observations:</span>
																						<ul className='list-disc pl-4 text-xs text-slate-600 space-y-1'>
																							{c.key_observations.map((obs, obsIdx) => (
																								<li key={obsIdx} className='whitespace-pre-wrap break-words'>
																									{obs}
																								</li>
																							))}
																						</ul>
																					</div>
																				)}
																			</div>
																		))}
																	</div>
																</div>
															)}

															{/* 2. AI Examiner Overall Feedback (Full text visible) */}
															{overallFeedback && (
																<div className='space-y-2'>
																	<div className='text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5'>
																		<Sparkles className='w-3.5 h-3.5 text-purple-600' />
																		<span>AI Examiner Overall Feedback</span>
																	</div>
																	<div className='p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl text-xs sm:text-sm text-slate-800 leading-relaxed'>
																		<p className='whitespace-pre-wrap break-words'>{overallFeedback}</p>
																	</div>
																</div>
															)}

															{/* 3. Detailed Criterion Feedback (Full text visible) */}
															{criterionFeedback && (
																<div className='space-y-2'>
																	<div className='text-[11px] font-bold text-slate-500 uppercase tracking-wider'>Detailed Criterion Analysis</div>
																	<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
																		{criterionFeedback.fluency && (
																			<div className='p-3.5 bg-white border border-slate-200 rounded-xl space-y-1'>
																				<span className='text-[11px] font-bold text-indigo-700 uppercase'>Fluency & Coherence</span>
																				<p className='text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words'>
																					{criterionFeedback.fluency}
																				</p>
																			</div>
																		)}
																		{criterionFeedback.vocabulary && (
																			<div className='p-3.5 bg-white border border-slate-200 rounded-xl space-y-1'>
																				<span className='text-[11px] font-bold text-purple-700 uppercase'>Lexical Resource</span>
																				<p className='text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words'>
																					{criterionFeedback.vocabulary}
																				</p>
																			</div>
																		)}
																		{criterionFeedback.grammar && (
																			<div className='p-3.5 bg-white border border-slate-200 rounded-xl space-y-1'>
																				<span className='text-[11px] font-bold text-amber-700 uppercase'>Grammatical Range & Accuracy</span>
																				<p className='text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words'>
																					{criterionFeedback.grammar}
																				</p>
																			</div>
																		)}
																		{criterionFeedback.pronunciation && (
																			<div className='p-3.5 bg-white border border-slate-200 rounded-xl space-y-1'>
																				<span className='text-[11px] font-bold text-emerald-700 uppercase'>Pronunciation</span>
																				<p className='text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words'>
																					{criterionFeedback.pronunciation}
																				</p>
																			</div>
																		)}
																	</div>
																</div>
															)}

															{/* 4. Key Strengths & Areas for Improvement (Full text visible) */}
															{(strengths.length > 0 || areasForImprovement.length > 0) && (
																<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
																	{strengths.length > 0 && (
																		<div className='p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2'>
																			<div className='text-[11px] font-extrabold text-emerald-800 uppercase flex items-center gap-1.5'>
																				<CheckCircle2 className='w-4 h-4 text-emerald-600' />
																				<span>Key Strengths</span>
																			</div>
																			<ul className='list-disc pl-5 text-xs text-emerald-950 space-y-1.5 leading-relaxed'>
																				{strengths.map((item, sIdx) => (
																					<li key={sIdx} className='whitespace-pre-wrap break-words'>
																						{item}
																					</li>
																				))}
																			</ul>
																		</div>
																	)}

																	{areasForImprovement.length > 0 && (
																		<div className='p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2'>
																			<div className='text-[11px] font-extrabold text-amber-800 uppercase flex items-center gap-1.5'>
																				<AlertCircle className='w-4 h-4 text-amber-600' />
																				<span>Areas for Improvement</span>
																			</div>
																			<ul className='list-disc pl-5 text-xs text-amber-950 space-y-1.5 leading-relaxed'>
																				{areasForImprovement.map((item, aIdx) => (
																					<li key={aIdx} className='whitespace-pre-wrap break-words'>
																						{item}
																					</li>
																				))}
																			</ul>
																		</div>
																	)}
																</div>
															)}

															{/* 5. Question-by-Question Evaluation & Audio Playback (Paginated with Next / Back) */}
															{questionItems.length > 0 && <AttemptQuestionViewer questions={questionItems} />}
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
};
