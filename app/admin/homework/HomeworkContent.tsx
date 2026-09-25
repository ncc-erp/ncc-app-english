'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { FormHomework } from '@/types';

interface Topic {
	id: string;
	title: string;
	description?: string;
}

interface HomeworkContentProps {
	onSelectTopics?: (topics: Topic[]) => void;
	selectedSkill?: string;
}

export default function HomeworkContent({ selectedSkill, onSelectTopics }: HomeworkContentProps) {
	const [topics, setTopics] = useState<Topic[]>([]);
	const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);

	const [showTopicPopup, setShowTopicPopup] = useState(false);
	const [search, setSearch] = useState('');
	const [mounted, setMounted] = useState(false);

	const [formHomework, setFormHomework] = useState<FormHomework>({
		name: '',
		dueDate: 0,
		description: '',
		startDate: 0,
		speaking: [],
		listening: [],
		reading: [],
		writing: []
	});

	useEffect(() => {
		setMounted(true);
	}, []);

	const fetchTopics = async () => {
		try {
			const res = await fetch('/api/admin/topics');

			if (res.status === 503) {
				return;
			}

			const data = await res.json();

			if (data.success && data.topics) {
				setTopics(data.topics);
			}
		} catch (err) {
			console.error('Fetch admin topics error:', err);
		} finally {
		}
	};

	useEffect(() => {
		fetchTopics();
	}, []);

	const handleToggleTopic = (topic: Topic) => {
		setSelectedTopics((current) => {
			const exists = current.some((item) => item.id === topic.id);

			const next = exists ? current.filter((item) => item.id !== topic.id) : [...current, topic];

			onSelectTopics?.(next);

			return next;
		});
	};

	const isSelected = (topicId: string) => {
		return selectedTopics.some((topic) => topic.id === topicId);
	};

	const unselectedTopics = topics.filter((topic) => !isSelected(topic.id));

	const searchedTopics = unselectedTopics.filter((topic) => {
		const keyword = search.trim().toLowerCase();

		if (!keyword) return true;

		return topic.title.toLowerCase().includes(keyword) || topic.description?.toLowerCase().includes(keyword);
	});

	return (
		<div className='min-h-full'>
			{/* Header */}
			<div className='mb-5 flex items-start justify-between gap-4'>
				<div>
					<p className='text-xs font-bold uppercase tracking-wider text-purple-600'>{selectedSkill}</p>

					<h3 className='mt-1 text-lg font-bold text-slate-900'>Choose Topics</h3>

					<p className='mt-1 text-sm text-slate-500'>Select one or more topics for this homework.</p>
				</div>

				<button
					type='button'
					onClick={() => setShowTopicPopup(true)}
					className='inline-flex shrink-0 items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-sm font-bold text-purple-600 transition hover:border-purple-300 hover:bg-purple-100'
				>
					<Plus className='h-4 w-4' />
					Add Topics
					{selectedTopics.length > 0 && (
						<span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[10px] font-bold text-white'>
							{selectedTopics.length}
						</span>
					)}
				</button>
			</div>

			{/* Selected topics */}
			{selectedTopics.length === 0 ? (
				<div className='flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center'>
					<div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-500'>
						<Plus className='h-6 w-6' />
					</div>

					<h4 className='mt-4 font-bold text-slate-800'>No topics selected</h4>

					<p className='mt-1 max-w-sm text-sm text-slate-400'>Click "Add Topics" to choose topics for this homework.</p>

					<button
						type='button'
						onClick={() => setShowTopicPopup(true)}
						className='mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700'
					>
						<Plus className='h-4 w-4' />
						Choose Topics
					</button>
				</div>
			) : (
				<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
					{selectedTopics.map((topic) => (
						<div key={topic.id} className='group relative rounded-2xl border border-purple-200 bg-purple-50 p-5 transition'>
							{/* Selected check */}
							<div className='absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white'>
								<Check className='h-3.5 w-3.5' />
							</div>

							<div className='pr-8'>
								<h4 className='font-bold text-slate-900'>{topic.title}</h4>

								{topic.description && <p className='mt-2 line-clamp-2 text-xs leading-5 text-slate-500'>{topic.description}</p>}
							</div>

							<button
								type='button'
								onClick={() => handleToggleTopic(topic)}
								className='mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-red-500'
							>
								<X className='h-3 w-3' />
								Remove
							</button>
						</div>
					))}
				</div>
			)}

			{/* Floating topic popup */}
			{showTopicPopup &&
				mounted &&
				createPortal(
					<div className='fixed inset-0 z-[9999]' onMouseDown={() => setShowTopicPopup(false)}>
						{/* Popup */}
						<div
							className='fixed right-6 top-1/2 flex w-[360px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.2)]'
							onMouseDown={(event) => event.stopPropagation()}
						>
							{/* Popup Header */}
							<div className='shrink-0 border-b border-slate-100 p-4'>
								<div className='flex items-start justify-between'>
									<div>
										<h4 className='font-bold text-slate-900'>Add Topics</h4>

										<p className='mt-0.5 text-xs text-slate-400'>Select topics for this homework</p>
									</div>

									<button
										type='button'
										onClick={() => setShowTopicPopup(false)}
										className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600'
									>
										<X className='h-4 w-4' />
									</button>
								</div>

								{/* Search */}
								<div className='relative mt-3'>
									<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />

									<input
										type='text'
										value={search}
										onChange={(event) => setSearch(event.target.value)}
										placeholder='Search topics...'
										className='h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100'
									/>
								</div>
							</div>

							{/* Topic List */}
							<div className='max-h-[420px] overflow-y-auto p-2'>
								{searchedTopics.length === 0 ? (
									<div className='flex min-h-[180px] flex-col items-center justify-center px-6 text-center'>
										<div className='flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-500'>
											<Check className='h-5 w-5' />
										</div>

										<p className='mt-3 text-sm font-semibold text-slate-700'>No topics available</p>

										<p className='mt-1 text-xs text-slate-400'>All matching topics have been selected.</p>
									</div>
								) : (
									<div className='space-y-1'>
										{searchedTopics.map((topic) => (
											<button
												key={topic.id}
												type='button'
												onClick={() => handleToggleTopic(topic)}
												className='group flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-purple-50'
											>
												<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition group-hover:bg-purple-100 group-hover:text-purple-600'>
													<Plus className='h-4 w-4' />
												</div>

												<div className='min-w-0 flex-1'>
													<p className='truncate text-sm font-semibold text-slate-700'>{topic.title}</p>

													{topic.description && <p className='mt-0.5 truncate text-[11px] text-slate-400'>{topic.description}</p>}
												</div>

												<Plus className='h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-purple-500' />
											</button>
										))}
									</div>
								)}
							</div>

							{/* Popup Footer */}
							<div className='flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3'>
								<div>
									<p className='text-xs font-semibold text-slate-600'>{selectedTopics.length} selected</p>

									<p className='text-[10px] text-slate-400'>{unselectedTopics.length} remaining</p>
								</div>

								<button
									type='button'
									onClick={() => setShowTopicPopup(false)}
									className='rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800'
								>
									Done
								</button>
							</div>
						</div>
					</div>,
					document.body
				)}
		</div>
	);
}
