'use client';

import { Clock3, Sparkles } from 'lucide-react';

export default function AdminHomeworkPage() {
	return (
		<div className='min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-12'>
			<div className='w-full max-w-2xl text-center'>
				{/* Icon */}
				<div className='relative mx-auto mb-8 flex h-24 w-24 items-center justify-center'>
					<div className='absolute inset-0 rounded-3xl bg-purple-100 animate-pulse' />

					<div className='relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-xl shadow-purple-200'>
						<Clock3 className='h-10 w-10 text-white' strokeWidth={1.8} />
					</div>

					<div className='absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-amber-400 shadow-md'>
						<Sparkles className='h-4 w-4 text-white' />
					</div>
				</div>

				{/* Content */}
				<div className='space-y-4'>
					<div className='inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700'>
						Coming Soon
					</div>

					<h1 className='text-3xl font-bold tracking-tight text-slate-900 md:text-4xl'>Homework Management</h1>

					<p className='mx-auto max-w-lg text-base leading-7 text-slate-500 md:text-lg'>
						We&apos;re working on something great. The homework management feature is currently under development and will be available soon.
					</p>
				</div>

				{/* Progress */}
				<div className='mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
					<div className='mb-3 flex items-center justify-between text-sm'>
						<span className='font-medium text-slate-700'>Development</span>
						<span className='font-semibold text-purple-600'>In progress</span>
					</div>

					<div className='h-2 overflow-hidden rounded-full bg-slate-100'>
						<div className='h-full w-[65%] rounded-full bg-gradient-to-r from-purple-500 to-indigo-500' />
					</div>
				</div>
			</div>
		</div>
	);
}
