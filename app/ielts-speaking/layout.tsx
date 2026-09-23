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
