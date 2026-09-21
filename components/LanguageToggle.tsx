'use client';

import React from 'react';
import { Locale } from '@/lib/i18n/translations';

export function LanguageToggle({ locale, setLocale, className = '' }: { locale: Locale; setLocale: (locale: Locale) => void; className?: string }) {
	return (
		<div className={`flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl border border-slate-200 ${className}`} title='Switch language'>
			<button
				onClick={() => setLocale('vi')}
				className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
					locale === 'vi' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
				}`}
			>
				VI
			</button>
			<button
				onClick={() => setLocale('en')}
				className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
					locale === 'en' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
				}`}
			>
				EN
			</button>
		</div>
	);
}
