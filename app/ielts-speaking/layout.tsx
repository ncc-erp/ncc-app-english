'use client';

import { useAuth } from '@/context/AuthContext';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function LoginLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { login, user } = useAuth();
	const [checking, setChecking] = useState(!user);

	useEffect(() => {
		// Đã login rồi thì không cần check và không show loading
		if (user) {
			setChecking(false);
			return;
		}

		const checkLogin = async () => {
			try {
				const res = await fetch('/api/auth/me');
				const data = await res.json();

				if (data.isLoggedIn && data.user) {
					login(data.user);
				}
			} catch (error) {
				console.error('Check login error:', error);
			} finally {
				setChecking(false);
			}
		};

		checkLogin();
	}, [user, login]);

	if (user) {
		return <>{children}</>;
	}

	if (checking) {
		return (
			<div className='flex min-h-screen items-center justify-center'>
				<div className='flex items-center gap-3 text-muted-foreground'>
					<LoaderCircle className='h-5 w-5 animate-spin' />
					<span className='text-sm'>Đang xác thực...</span>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
