'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Bot } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface ViewResultOnClanButtonProps {
	attemptId: string;
}

export const ViewResultOnClanButton: React.FC<ViewResultOnClanButtonProps> = ({ attemptId }) => {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const handleNotifyClan = async () => {
		setLoading(true);
		setErrorMsg(null);
		setSuccessMsg(null);

		try {
			const res = await fetch('/api/bot/notify-result', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ attemptId })
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(data.error || t('ielts.viewOnClan.errorDefault'));
			}

			setSuccessMsg(data.message || t('ielts.viewOnClan.successDefault'));
		} catch (err) {
			setErrorMsg((err as Error).message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-5 border border-purple-500/30 relative overflow-hidden'>
			<div className='absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-purple-500/20 rounded-full blur-3xl pointer-events-none' />

			{/* Header */}
			<div className='flex items-center space-x-3.5'>
				<div className='w-12 h-12 rounded-2xl bg-purple-500/20 backdrop-blur-md flex items-center justify-center text-purple-300 border border-purple-400/30'>
					<Bot className='w-6 h-6' />
				</div>
				<div>
					<span className='text-xs font-bold uppercase tracking-wider text-purple-300'>{t('ielts.viewOnClan.badge')}</span>
					<h3 className='text-xl sm:text-2xl font-extrabold text-white'>{t('ielts.viewOnClan.heading')}</h3>
				</div>
			</div>

			<p className='text-purple-100 text-sm sm:text-base leading-relaxed'>{t('ielts.viewOnClan.description')}</p>

			{/* Action Button */}
			<div className='pt-2 flex flex-col sm:flex-row items-center gap-3'>
				<button
					type='button'
					onClick={handleNotifyClan}
					disabled={loading}
					className='w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-white font-extrabold rounded-2xl shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 text-sm sm:text-base'
				>
					<Send className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
					<span>{loading ? t('ielts.viewOnClan.sendingButton') : t('ielts.viewOnClan.viewReportButton')}</span>
				</button>

				<span className='text-xs text-purple-200/70'>
					{t('ielts.viewOnClan.orTypePrefix')} <code className='bg-purple-950/70 px-2 py-1 rounded text-amber-300 font-mono'>*result</code>{' '}
					{t('ielts.viewOnClan.orTypeSuffix')}
				</span>
			</div>

			{/* Success Alert */}
			{successMsg && (
				<div className='p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-xs sm:text-sm flex items-start space-x-3 shadow-lg animate-fade-in'>
					<CheckCircle2 className='w-5 h-5 text-emerald-400 shrink-0 mt-0.5' />
					<span className='font-semibold leading-relaxed'>{successMsg}</span>
				</div>
			)}

			{/* Error Alert */}
			{errorMsg && (
				<div className='p-4 rounded-2xl bg-rose-500/25 border border-rose-400/40 text-rose-100 text-xs sm:text-sm flex items-start space-x-3 shadow-lg animate-fade-in'>
					<AlertCircle className='w-5 h-5 text-rose-300 shrink-0 mt-0.5' />
					<span className='font-medium leading-relaxed'>{errorMsg}</span>
				</div>
			)}
		</div>
	);
};
