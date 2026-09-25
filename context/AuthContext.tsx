'use client';

import { createContext, use, useState, type ReactNode } from 'react';
import type { UserSession } from '@/types';

interface AuthContextValue {
	user: UserSession | null;
	isAuthenticated: boolean;
	login: (user: UserSession) => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<UserSession | null>(null);

	const login = (user: UserSession) => {
		setUser(user);
		localStorage.setItem('user', JSON.stringify(user));
	};

	const logout = () => {
		setUser(null);
		localStorage.removeItem('user');
	};

	const value: AuthContextValue = {
		user,
		isAuthenticated: user !== null,
		login,
		logout
	};

	return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
	const context = use(AuthContext);

	if (context === null) {
		throw new Error('useAuth must be used within AuthProvider');
	}

	return context;
}
