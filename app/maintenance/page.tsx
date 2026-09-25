'use client';

import React from 'react';
import { Wrench, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function MaintenancePage() {
	const { t, locale, setLocale } = useTranslation();
	const contactUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL;

	return (
		<div className='min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden'>
			<div className='absolute top-4 right-4'>
				<LanguageToggle locale={locale} setLocale={setLocale} />
			</div>

			<div className='max-w-md w-full text-center'>
				<div className='mx-auto mb-6 w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center'>
					<Wrench className='w-8 h-8 text-purple-400' />
				</div>
				<span className='inline-block mb-4 px-3 py-1 text-xs font-bold rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30'>
					{t('maintenance.badge')}
				</span>
				<h1 className='text-3xl font-bold mb-3'>{t('maintenance.title')}</h1>
				<p className='text-slate-400 mb-8'>{t('maintenance.subtitle')}</p>

				<div className='flex items-center justify-center gap-3'>
					<button
						onClick={() => window.location.assign('/')}
						className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-sm transition-colors'
					>
						<RefreshCw className='w-4 h-4' />
						{t('maintenance.retry')}
					</button>
					{contactUrl && (
						<a
							href={contactUrl}
							target='_blank'
							rel='noopener noreferrer'
							className='px-5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 font-semibold text-sm transition-colors'
						>
							{t('maintenance.contact')}
						</a>
					)}
				</div>
			</div>
		</div>
	);
}
