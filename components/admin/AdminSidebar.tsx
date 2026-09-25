'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { School, FileText, BookOpen, Video, Clock } from 'lucide-react';

interface SidebarItem {
	label: string;
	href: string;
	icon: React.ElementType;
	disabled?: boolean;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
	{ label: 'Class Management', href: '/admin', icon: School },
	{ label: 'Homework Management', href: '/admin/homework', icon: FileText },
	{ label: 'Mock Test Management', href: '/admin/topics', icon: BookOpen },
	{ label: 'Meeting Management', href: '/admin/meetings', icon: Video }
];

export const AdminSidebar: React.FC = () => {
	const pathname = usePathname();

	return (
		<aside className='w-full lg:w-64 shrink-0'>
			{/* Sticky positioning lives on this plain wrapper, separate from the card below that
			    carries the border-radius/shadow — keeps the sticky box from re-rasterizing the
			    rounded/shadowed paint and causing a 1px jump right as it locks in place. */}
			<div className='lg:sticky lg:top-24'>
				<nav className='bg-white border border-slate-200 rounded-3xl p-3 shadow-sm space-y-1'>
					{SIDEBAR_ITEMS.map((item) => {
						const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
						const Icon = item.icon;

						if (item.disabled) {
							return (
								<div
									key={item.href}
									title='Coming soon'
									className='w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-400 cursor-not-allowed'
								>
									<div className='flex items-center gap-2.5'>
										<Icon className='w-4 h-4 shrink-0' />
										<span>{item.label}</span>
									</div>
									<Clock className='w-3.5 h-3.5 shrink-0' />
								</div>
							);
						}

						return (
							<Link
								key={item.href}
								href={item.href}
								className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
									isActive
										? 'bg-purple-600 text-white shadow-md shadow-purple-200'
										: 'text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200'
								}`}
							>
								<Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-purple-600'}`} />
								<span>{item.label}</span>
							</Link>
						);
					})}
				</nav>
			</div>
		</aside>
	);
};
