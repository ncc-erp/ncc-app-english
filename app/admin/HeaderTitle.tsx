import { Sparkles } from 'lucide-react';
import { ReactNode } from 'react';

interface HeaderTitleProps {
	title: string;
	description: string;
	action?: ReactNode;
}

export function HeaderTitle({ title, description, action }: HeaderTitleProps) {
	return (
		<div className='flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm'>
			<div className='space-y-1.5'>
				<div className='flex items-center gap-2 flex-wrap'>
					<div className='inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold rounded-full uppercase tracking-wider'>
						<Sparkles className='w-3.5 h-3.5 text-purple-600' />
						<span>Admin Clan Portal</span>
					</div>

					<span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200'>
						Category: LỚP HỌC
					</span>
				</div>

				<h1 className='text-2xl md:text-3xl font-extrabold text-slate-900'>{title}</h1>

				<p className='text-xs text-slate-600 max-w-2xl leading-relaxed'>{description}</p>
			</div>

			{action && <div className='flex items-center gap-2.5 shrink-0'>{action}</div>}
		</div>
	);
}
