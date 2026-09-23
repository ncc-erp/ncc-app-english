'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

export default function LoginLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { login, user } = useAuth();

	useEffect(() => {
		const hashData = new URLSearchParams(window.location.search).get('data');
		if (!hashData) return;
		fetch('/api/auth/mezon-hash', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ hashData })
		})
			.then(async (response) => {
				const data = await response.json();
				if (data?.success && data?.user?.mezon_id && data?.user?.isLoggedIn) {
					login(data?.user);
				}
				return data;
			})
			.catch((err) => {
				console.error('Hash auth error:', err);
			});
	}, []);

	useEffect(() => {
		// Đã login rồi thì không cần check và không show loading
		if (user) {
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
			}
		};

		checkLogin();
	}, [user, login]);

	return <>{children}</>;
}
