'use client';

import { useAdminUser, useAdminSidebarVisible } from '@/components/admin/AdminAuthContext';
import { ShieldAlert, Video, Construction } from 'lucide-react';
import { HeaderTitle } from '../HeaderTitle';

export default function AdminMeetingsPage() {
	const user = useAdminUser();
	const isAuthorized = user.role === 'admin';
	useAdminSidebarVisible(isAuthorized);

	if (!isAuthorized) {
		return (
			<div className='bg-white border border-slate-200 rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 shadow-xl'>
				<div className='w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200'>
					<ShieldAlert className='w-7 h-7' />
				</div>
				<h1 className='text-xl font-bold text-slate-900'>Access Denied</h1>
				<p className='text-xs text-slate-600 leading-relaxed'>
					You must be logged in as an Administrator (`admin`) to access the Meeting Management Portal.
				</p>
			</div>
		);
	}

	return (
		<div className='space-y-7'>
			<HeaderTitle description='Schedule and manage clan meetings.' title='Meeting Management' />

			<div className='bg-white border border-slate-200 rounded-3xl p-12 shadow-sm flex flex-col items-center justify-center text-center space-y-4'>
				<div className='w-14 h-14 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100'>
					<Construction className='w-7 h-7' />
				</div>
				<div className='space-y-1'>
					<h2 className='text-sm font-extrabold text-slate-900 flex items-center justify-center gap-2'>
						<Video className='w-4 h-4 text-purple-600' />
						<span>Under Construction</span>
					</h2>
					<p className='text-xs text-slate-500 max-w-sm'>Meeting management is being built. Check back soon.</p>
				</div>
			</div>
		</div>
	);
}
