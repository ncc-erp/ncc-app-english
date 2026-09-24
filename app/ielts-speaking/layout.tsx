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
	const [storedUser] = useState(() => {
		if (typeof window === 'undefined') {
			return null;
		}

		return window.localStorage.getItem('user');
	});
	const [loading, setLoading] = useState(!user && !!storedUser);

	useEffect(() => {
		if (user) {
			setLoading(false);
			return;
		}

		const checkAuth = async () => {
			setLoading(true);

			try {
				const hashData = new URLSearchParams(window.location.search).get('data');

				if (hashData) {
					const response = await fetch('/api/auth/mezon-hash', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ hashData })
					});

					const data = await response.json();

					if (data?.success && data?.user?.mezon_id && data?.user?.isLoggedIn) {
						login(data.user);
					}

					return;
				}

				const response = await fetch('/api/auth/me');
				const data = await response.json();

				if (data?.isLoggedIn && data?.user) {
					login(data.user);
				}
			} catch (error) {
				console.error('Auth error:', error);
			} finally {
				setLoading(false);
			}
		};

		checkAuth();
	}, [user, login]);

	if (loading && !user && !!storedUser) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-background'>
				<div className='relative flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 shadow-sm'>
					<div className='absolute inset-0 animate-ping rounded-2xl bg-primary/10' />
					<LoaderCircle className='relative h-7 w-7 animate-spin text-primary' />
				</div>
			</div>
		);
	}
	return <>{children}</>;
}
