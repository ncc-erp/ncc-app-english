'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations, Locale } from './translations';

interface LanguageContextValue {
	locale: Locale;
	setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'ncc_app_locale';
const DEFAULT_LOCALE: Locale = 'vi';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

	useEffect(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored === 'vi' || stored === 'en') {
				setLocaleState(stored);
			}
		} catch {
			// localStorage unavailable (private browsing, SSR, etc.)
		}
	}, []);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// ignore
		}
	}, []);

	const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolvePath(obj: any, path: string): unknown {
	return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

export function useTranslation() {
	const ctx = useContext(LanguageContext);
	if (!ctx) {
		throw new Error('useTranslation must be used within a LanguageProvider');
	}
	const { locale, setLocale } = ctx;

	const t = useCallback(
		(key: string, vars?: Record<string, string | number>): string => {
			const value = resolvePath(translations[locale], key);
			let result = typeof value === 'string' ? value : key;
			if (vars) {
				Object.entries(vars).forEach(([k, v]) => {
					if (v === undefined) return;
					result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
				});
			}
			return result;
		},
		[locale]
	);

	const tArray = useCallback(
		(key: string): string[] => {
			const value = resolvePath(translations[locale], key);
			return Array.isArray(value) ? (value as string[]) : [];
		},
		[locale]
	);

	// For arrays of objects (e.g. feature cards with title/desc) that don't fit the
	// plain string lookup of `t`/`tArray`.
	const tList = useCallback(
		<T,>(key: string): T[] => {
			const value = resolvePath(translations[locale], key);
			return Array.isArray(value) ? (value as T[]) : [];
		},
		[locale]
	);

	return { t, tArray, tList, locale, setLocale };
}
