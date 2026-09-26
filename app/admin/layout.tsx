'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminUserProvider, AdminChromeProvider } from '@/components/admin/AdminAuthContext';
import { UserSession } from '@/types';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { ShieldAlert, Loader2, AlertCircle } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const { t } = useTranslation();
	const [user, setUser] = useState<UserSession | null>(null);
	const [loading, setLoading] = useState(true);
	// /api/auth/me answers 503 when the admin role can't be verified right now (e.g. Mezon down).
	const [verificationError, setVerificationError] = useState(false);
	const [sidebarVisible, setSidebarVisible] = useState(true);

	useEffect(() => {
		let isMounted = true;
		async function checkAuth() {
			try {
				const res = await fetch('/api/auth/me', { cache: 'no-store' });
				if (res.status === 503) {
					if (isMounted) setVerificationError(true);
					return;
				}
				const data = await res.json();
				if (isMounted) {
					setUser(data.isLoggedIn && data.user ? data.user : null);
				}
			} catch (err) {
				console.error('Admin auth check error:', err);
				if (isMounted) setVerificationError(true);
			} finally {
				if (isMounted) setLoading(false);
			}
		}
		checkAuth();
		return () => {
			isMounted = false;
		};
	}, []);

	if (loading) {
		return (
			<div className='min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center'>
				<div className='flex items-center space-x-3'>
					<Loader2 className='w-6 h-6 animate-spin text-purple-600' />
					<span className='text-sm font-medium text-slate-600'>{t('common.adminAccess.verifying')}</span>
				</div>
			</div>
		);
	}

	if (verificationError) {
		return (
			<div className='min-h-screen bg-slate-50 text-slate-900 flex flex-col'>
				<Navbar />
				<main className='flex-1 flex items-center justify-center p-4'>
					<div className='bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4'>
						<AlertCircle className='w-8 h-8 text-amber-600 mx-auto' />
						<h1 className='text-xl font-bold'>{t('common.adminAccess.verificationUnavailableTitle')}</h1>
						<p role='alert' className='text-sm text-slate-600'>
							{t('common.adminAccess.verificationUnavailableMessage')}
						</p>
						<button onClick={() => window.location.reload()} className='w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl'>
							{t('common.adminAccess.retry')}
						</button>
					</div>
				</main>
			</div>
		);
	}

	if (!user) {
		return (
			<div className='min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans'>
				<Navbar />
				<main className='flex-1 flex items-center justify-center p-4'>
					<div className='bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl'>
						<div className='w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200'>
							<ShieldAlert className='w-7 h-7' />
						</div>
						<h1 className='text-xl font-bold text-slate-900'>{t('common.adminAccess.accessDeniedTitle')}</h1>
						<p className='text-xs text-slate-600 leading-relaxed'>{t('common.adminAccess.loginRequiredMessage')}</p>
						<button
							onClick={() => router.push('/login')}
							className='w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-200'
						>
							{t('common.adminAccess.goToLogin')}
						</button>
					</div>
				</main>
			</div>
		);
	}

	return (
		<AdminUserProvider user={user}>
			<AdminChromeProvider setSidebarVisible={setSidebarVisible}>
				<div className='min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans'>
					<Navbar user={user} containerClassName='max-w-[1600px]' />

					<div className='flex-1 max-w-[1600px] mx-auto px-4 py-8 w-full flex flex-col lg:flex-row gap-6'>
						{sidebarVisible && <AdminSidebar />}
						<main className='flex-1 w-full min-w-0'>{children}</main>
					</div>
				</div>
			</AdminChromeProvider>
		</AdminUserProvider>
	);
}
