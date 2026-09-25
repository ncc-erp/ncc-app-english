'use client';

import { useState } from 'react';
import { BookOpen, Check, Headphones, Mic2, PenLine, Plus, X } from 'lucide-react';
import HomeworkContent from './HomeworkContent';

interface CreateHomeworkModalProps {
	onClose: () => void;
}

const IELTS_SKILLS = [
	{
		id: 'speaking',
		title: 'Speaking',
		description: 'Practice speaking skills',
		icon: Mic2
	},
	{
		id: 'writing',
		title: 'Writing',
		description: 'Practice writing skills',
		icon: PenLine
	},
	{
		id: 'listening',
		title: 'Listening',
		description: 'Practice listening skills',
		icon: Headphones
	},
	{
		id: 'reading',
		title: 'Reading',
		description: 'Practice reading skills',
		icon: BookOpen
	}
];

export default function CreateHomeworkButton() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<button
				type='button'
				onClick={() => setIsOpen(true)}
				className='inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-purple-200 transition-all hover:scale-105 hover:bg-purple-700'
			>
				<Plus className='h-4 w-4' />
				<span>Create New Homework</span>
			</button>

			{isOpen && <CreateHomeworkModal onClose={() => setIsOpen(false)} />}
		</>
	);
}

function CreateHomeworkModal({ onClose }: CreateHomeworkModalProps) {
	const [selectedSkill, setSelectedSkill] = useState('speaking');
	const [selectedPart, setSelectedPart] = useState<number | null>(null);

	const handleSelectSkill = (skill: string) => {
		setSelectedSkill(skill);
		setSelectedPart(null);
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm' onClick={onClose}>
			<div
				className='flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl'
				onClick={(event) => event.stopPropagation()}
			>
				{/* Header */}
				<div className='flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4'>
					<div className='inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600'>IELTS Homework</div>

					<button
						type='button'
						onClick={onClose}
						className='flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600'
					>
						<X className='h-5 w-5' />
					</button>
				</div>

				{/* Body */}
				<div className='flex min-h-0 flex-1'>
					{/* Sidebar */}
					<div className='w-56 shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/70 p-4'>
						<p className='mb-3 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400'>IELTS Skills</p>

						<div className='space-y-1.5'>
							{IELTS_SKILLS.map((skill) => {
								const Icon = skill.icon;
								const isActive = selectedSkill === skill.id;

								return (
									<button
										key={skill.id}
										type='button'
										onClick={() => handleSelectSkill(skill.id)}
										className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
											isActive ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70'
										}`}
									>
										<div
											className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
												isActive ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'
											}`}
										>
											<Icon className='h-4 w-4' />
										</div>

										<div className='min-w-0'>
											<p className='text-sm font-bold'>{skill.title}</p>

											<p className='mt-0.5 text-[10px] text-slate-400'>{skill.description}</p>
										</div>

										{isActive && <div className='absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-purple-600' />}
									</button>
								);
							})}
						</div>
					</div>

					{/* Content */}
					<div className='min-h-0 min-w-0 flex-1 overflow-y-auto p-6'>
						<HomeworkContent selectedSkill={selectedSkill} />
					</div>
				</div>

				{/* Footer */}
				<div className='flex h-20 shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4'>
					<p className='text-xs text-slate-400'>
						{selectedSkill === 'speaking' && selectedPart ? `Speaking · Part ${selectedPart}` : `Create ${selectedSkill} homework`}
					</p>

					<div className='flex gap-3'>
						<button
							type='button'
							onClick={onClose}
							className='rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100'
						>
							Cancel
						</button>

						<button
							type='button'
							disabled={true}
							className='inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40'
						>
							<Check className='h-4 w-4' />
							Continue
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
