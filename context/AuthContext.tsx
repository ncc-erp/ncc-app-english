'use client';

import { UserSession } from '@/types';
import { createContext, useContext, useState, type ReactNode } from 'react';

interface AuthContextValue {
	user: UserSession | null;
	isAuthenticated: boolean;
	login: (user: UserSession) => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

	return (
		<AuthContext.Provider
			value={{
				user,
				isAuthenticated: !!user,
				login,
				logout
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error('useAuth must be used within AuthProvider');
	}

	return context;
}
