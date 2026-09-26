'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAdminUser, useAdminSidebarVisible } from '@/components/admin/AdminAuthContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import type { BatchJobState } from '@/lib/admin/batch-scoring';
import { ShieldAlert, Loader2, Play, ArrowLeft, CheckCircle2, XCircle, MinusCircle, Clock, Sparkles, AlertCircle } from 'lucide-react';

const POLL_MS = 3000;

function formatElapsed(startedAt: string | null, finishedAt: string | null): string {
	if (!startedAt) return '—';
	const start = new Date(startedAt).getTime();
	const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
	const secs = Math.max(0, Math.floor((end - start) / 1000));
	const m = Math.floor(secs / 60);
	const s = secs % 60;
	return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AdminScoringPage() {
	const { t } = useTranslation();
	const user = useAdminUser();
	const isAuthorized = user.role === 'admin';
	useAdminSidebarVisible(isAuthorized);

	const [job, setJob] = useState<BatchJobState | null>(null);
	const [pendingCount, setPendingCount] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [starting, setStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [, setTick] = useState(0); // re-render to refresh elapsed timer

	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchStatus = async () => {
		try {
			const res = await fetch('/api/admin/scoring', { cache: 'no-store' });
			const data = await res.json();
			if (res.ok && data.success) {
				setJob(data.job);
				if (typeof data.pendingCount === 'number') setPendingCount(data.pendingCount);
			} else {
				setError(data.error || 'Failed to load batch scoring status');
			}
		} catch (e) {
			console.error('Fetch scoring status error:', e);
			setError('Failed to load batch scoring status');
		} finally {
			setLoading(false);
		}
	};

	// Session is verified by the /admin layout; only the admin role is checked here.
	useEffect(() => {
		if (isAuthorized) fetchStatus();
		else setLoading(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAuthorized]);

	// Poll while running; stop otherwise.
	useEffect(() => {
		if (job?.status === 'running') {
			if (!pollRef.current) pollRef.current = setInterval(fetchStatus, POLL_MS);
		} else if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [job?.status]);

	// 1s ticker to keep the elapsed clock live while running.
	useEffect(() => {
		if (job?.status !== 'running') return;
		const t = setInterval(() => setTick((n) => n + 1), 1000);
		return () => clearInterval(t);
	}, [job?.status]);

	useEffect(() => {
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	const handleStart = async () => {
		if (starting) return;
		try {
			setStarting(true);
			setError(null);
			const res = await fetch('/api/admin/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
			const data = await res.json();
			if (res.ok && data.success) {
				setJob(data.job);
				if (data.job?.status === 'running' && !pollRef.current) {
					pollRef.current = setInterval(fetchStatus, POLL_MS);
				}
			} else {
				setError(data.error || 'Failed to start batch scoring');
			}
		} catch (e) {
			console.error('Start batch scoring error:', e);
			setError('Failed to start batch scoring');
		} finally {
			setStarting(false);
		}
	};

	if (!isAuthorized) {
		return (
			<div className='bg-white border border-slate-200 rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 shadow-xl'>
				<div className='w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200'>
					<ShieldAlert className='w-7 h-7' />
				</div>
				<h1 className='text-xl font-bold text-slate-900'>{t('common.adminAccess.accessDeniedTitle')}</h1>
				<p className='text-xs text-slate-600 leading-relaxed'>{t('common.adminAccess.scoringDeniedMessage')}</p>
			</div>
		);
	}

	const running = job?.status === 'running';
	const total = job?.total ?? 0;
	const done = job?.done ?? 0;
	const pct = total > 0 ? Math.round((done / total) * 100) : 0;
	const nothingToDo = (pendingCount ?? 0) === 0 && (job?.status === 'idle' || !job);

	return (
		<div className='max-w-4xl space-y-6'>
			{/* Header */}
			<div className='bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-4'>
				<div className='flex items-start justify-between gap-4'>
					<div className='space-y-1.5'>
						<div className='inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold rounded-full uppercase tracking-wider'>
							<Sparkles className='w-3.5 h-3.5 text-purple-600' />
							<span>Admin Portal</span>
						</div>
						<h1 className='text-2xl md:text-3xl font-extrabold text-slate-900'>Chấm điểm hàng loạt</h1>
						<p className='text-xs text-slate-600 max-w-2xl leading-relaxed'>
							Chấm AI cho tất cả bài IELTS Speaking đã nộp (submitted) nhưng chưa có kết quả. Quá trình chạy nền trên server, chấm lần lượt từng bài
							— bạn có thể đóng tab rồi quay lại.
						</p>
					</div>
					<Link
						href='/admin'
						className='inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all shrink-0'
					>
						<ArrowLeft className='w-3.5 h-3.5' />
						<span>Back</span>
					</Link>
				</div>

				<div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3'>
					<button
						onClick={handleStart}
						disabled={running || starting || nothingToDo}
						className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{running || starting ? <Loader2 className='w-4 h-4 animate-spin' /> : <Play className='w-4 h-4' />}
						<span>{running ? 'Đang chấm...' : starting ? 'Đang khởi động...' : 'Chấm tất cả bài chưa chấm'}</span>
					</button>

					<div className='text-xs text-slate-600'>
						{loading ? (
							<span className='inline-flex items-center gap-2'>
								<Loader2 className='w-3.5 h-3.5 animate-spin text-purple-600' /> Đang tải...
							</span>
						) : nothingToDo ? (
							<span className='inline-flex items-center gap-2 text-emerald-700 font-medium'>
								<CheckCircle2 className='w-4 h-4' /> Không có bài nào cần chấm.
							</span>
						) : (
							<span>
								Đang chờ chấm: <strong className='text-slate-900'>{pendingCount ?? 0}</strong> bài
							</span>
						)}
					</div>
				</div>

				{error && (
					<div className='p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-2'>
						<AlertCircle className='w-4 h-4 text-rose-600 shrink-0' />
						<span className='font-medium'>{error}</span>
					</div>
				)}
			</div>

			{error && job?.status === 'error' && (
				<div className='p-4 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-900'>
					<strong className='font-bold'>Job error:</strong> {job.error}
				</div>
			)}

			{/* Progress */}
			{job && job.status !== 'idle' && (
				<div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4'>
					<div className='flex items-center justify-between'>
						<h2 className='text-sm font-extrabold text-slate-900 flex items-center gap-2'>
							{running ? <Loader2 className='w-4 h-4 animate-spin text-purple-600' /> : <CheckCircle2 className='w-4 h-4 text-emerald-600' />}
							<span>{running ? 'Đang xử lý' : 'Hoàn tất'}</span>
						</h2>
						<span className='inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500'>
							<Clock className='w-3.5 h-3.5' />
							{formatElapsed(job.started_at, job.finished_at)}
						</span>
					</div>

					<div className='w-full h-2.5 bg-slate-100 rounded-full overflow-hidden'>
						<div className={`h-full rounded-full transition-all ${running ? 'bg-purple-600' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
					</div>

					<div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-center'>
						<div className='bg-slate-50 border border-slate-200 rounded-xl p-3'>
							<div className='text-[10px] text-slate-500 font-bold uppercase'>Tiến độ</div>
							<div className='text-lg font-extrabold text-slate-900'>
								{done}/{total}
							</div>
						</div>
						<div className='bg-emerald-50 border border-emerald-200 rounded-xl p-3'>
							<div className='text-[10px] text-emerald-600 font-bold uppercase'>Thành công</div>
							<div className='text-lg font-extrabold text-emerald-700'>{job.succeeded}</div>
						</div>
						<div className='bg-rose-50 border border-rose-200 rounded-xl p-3'>
							<div className='text-[10px] text-rose-600 font-bold uppercase'>Thất bại</div>
							<div className='text-lg font-extrabold text-rose-700'>{job.failed}</div>
						</div>
						<div className='bg-purple-50 border border-purple-200 rounded-xl p-3'>
							<div className='text-[10px] text-purple-600 font-bold uppercase'>Tổng</div>
							<div className='text-lg font-extrabold text-purple-700'>{total}</div>
						</div>
					</div>

					{running && job.current_attempt_id && (
						<p className='text-[11px] text-slate-500 font-medium'>
							Đang chấm: <span className='font-mono'>{job.current_attempt_id}</span>
						</p>
					)}
				</div>
			)}

			{/* Result log */}
			{job && job.results.length > 0 && (
				<div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3'>
					<h2 className='text-sm font-extrabold text-slate-900'>Log ({job.results.length})</h2>
					<div className='max-h-96 overflow-auto space-y-2 pr-1'>
						{job.results.map((r) => (
							<div
								key={r.attempt_id}
								className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs ${
									r.status === 'success'
										? 'bg-emerald-50 border-emerald-200'
										: r.status === 'skipped'
											? 'bg-slate-50 border-slate-200'
											: 'bg-rose-50 border-rose-200'
								}`}
							>
								<div className='flex items-center gap-2 min-w-0'>
									{r.status === 'success' ? (
										<CheckCircle2 className='w-4 h-4 text-emerald-600 shrink-0' />
									) : r.status === 'skipped' ? (
										<MinusCircle className='w-4 h-4 text-slate-400 shrink-0' />
									) : (
										<XCircle className='w-4 h-4 text-rose-600 shrink-0' />
									)}
									<span className='font-mono text-slate-700 truncate'>{r.attempt_id}</span>
								</div>
								<div className='text-right shrink-0'>
									{r.status === 'success' ? (
										<span className='font-bold text-emerald-700'>Band {r.overall_band?.toFixed(1)}</span>
									) : (
										<span className={r.status === 'skipped' ? 'text-slate-500' : 'text-rose-700'}>{r.error}</span>
									)}
									{typeof r.duration_ms === 'number' && (
										<span className='block text-[10px] text-slate-400'>{(r.duration_ms / 1000).toFixed(1)}s</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
