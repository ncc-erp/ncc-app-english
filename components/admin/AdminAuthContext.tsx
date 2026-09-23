'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { UserSession } from '@/types';

const AdminUserContext = createContext<UserSession | null>(null);

export const AdminUserProvider: React.FC<{ user: UserSession; children: React.ReactNode }> = ({ user, children }) => (
	<AdminUserContext.Provider value={user}>{children}</AdminUserContext.Provider>
);

export function useAdminUser(): UserSession {
	const user = useContext(AdminUserContext);
	if (!user) {
		throw new Error('useAdminUser must be used within the /admin layout');
	}
	return user;
}

// Lets a page hide the shared admin sidebar for itself, e.g. while its own (stricter)
// authorization check is still pending or has failed, so it doesn't show navigation
// into a section the user isn't actually cleared for.
const AdminChromeContext = createContext<((visible: boolean) => void) | null>(null);

export const AdminChromeProvider: React.FC<{ setSidebarVisible: (visible: boolean) => void; children: React.ReactNode }> = ({
	setSidebarVisible,
	children
}) => <AdminChromeContext.Provider value={setSidebarVisible}>{children}</AdminChromeContext.Provider>;

export function useAdminSidebarVisible(visible: boolean) {
	const setSidebarVisible = useContext(AdminChromeContext);
	useEffect(() => {
		setSidebarVisible?.(visible);
		return () => setSidebarVisible?.(true);
	}, [setSidebarVisible, visible]);
}
