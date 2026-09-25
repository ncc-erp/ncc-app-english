'use client';

import { useState } from 'react';
import { Calendar, FileText, X } from 'lucide-react';

type FormHomework = {
	name: string;
	startDate: Date | null;
	dueDate: Date | null;
	description: string;
};

type HomeworkGeneralModalProps = {
	onClose: () => void;
};

export default function HomeworkGeneralModal({ onClose }: HomeworkGeneralModalProps) {
	const [formHomework, setFormHomework] = useState<FormHomework>({
		name: '',
		startDate: null,
		dueDate: null,
		description: ''
	});

	const [submitting, setSubmitting] = useState(false);

	const handleNameChange = (value: string) => {
		setFormHomework((prev) => ({
			...prev,
			name: value
		}));
	};

	const handleStartDateChange = (value: string) => {
		setFormHomework((prev) => ({
			...prev,
			startDate: value ? new Date(value) : null
		}));
	};

	const handleDueDateChange = (value: string) => {
		setFormHomework((prev) => ({
			...prev,
			dueDate: value ? new Date(value) : null
		}));
	};

	const handleDescriptionChange = (value: string) => {
		setFormHomework((prev) => ({
			...prev,
			description: value
		}));
	};

	const formatDateTime = (date: Date | null) => {
		if (!date) return '';

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');

		return `${year}-${month}-${day}T${hours}:${minutes}`;
	};

	const handleSubmit = async () => {
		if (!formHomework.name.trim()) return;
		if (!formHomework.startDate) return;
		if (!formHomework.dueDate) return;

		if (formHomework.startDate > formHomework.dueDate) {
			return;
		}

		try {
			setSubmitting(true);

			const response = await fetch('/api/admin/homework', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: formHomework.name.trim(),
					startDate: formHomework.startDate,
					dueDate: formHomework.dueDate,
					description: formHomework.description.trim()
				})
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.error || 'Failed to create homework');
			}

			onClose();
		} catch (error) {
			console.error('[Create Homework Error]:', error);
		} finally {
			setSubmitting(false);
		}
	};

	const startDateValue = formatDateTime(formHomework.startDate);
	const dueDateValue = formatDateTime(formHomework.dueDate);

	const isInvalidDate = formHomework.startDate !== null && formHomework.dueDate !== null && formHomework.startDate > formHomework.dueDate;

	const isSubmitDisabled = !formHomework.name.trim() || !formHomework.startDate || !formHomework.dueDate || isInvalidDate || submitting;

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm'>
			<div className='w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl'>
				{/* Header */}
				<div className='flex items-center justify-between border-b border-slate-100 px-6 py-5'>
					<div>
						<h2 className='text-xl font-bold text-slate-900'>Create Homework</h2>

						<p className='mt-1 text-sm text-slate-500'>Add the basic information for your homework.</p>
					</div>

					<button
						type='button'
						onClick={onClose}
						disabled={submitting}
						className='flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
					>
						<X size={20} />
					</button>
				</div>

				{/* Content */}
				<div className='max-h-[70vh] overflow-y-auto px-6 py-6'>
					<div className='space-y-6'>
						{/* Homework Name */}
						<div className='space-y-2'>
							<label htmlFor='homework-name' className='text-sm font-semibold text-slate-700'>
								Homework Name
								<span className='ml-1 text-red-500'>*</span>
							</label>

							<input
								id='homework-name'
								type='text'
								value={formHomework.name}
								onChange={(e) => handleNameChange(e.target.value)}
								placeholder='e.g. IELTS Practice Homework #01'
								className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10'
							/>
						</div>

						{/* Start Date */}
						<div className='space-y-2'>
							<label htmlFor='homework-start-date' className='text-sm font-semibold text-slate-700'>
								Start Date
								<span className='ml-1 text-red-500'>*</span>
							</label>

							<div className='relative'>
								<Calendar size={18} className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400' />

								<input
									id='homework-start-date'
									type='datetime-local'
									value={startDateValue}
									max={dueDateValue || undefined}
									onChange={(e) => handleStartDateChange(e.target.value)}
									className={`w-full rounded-xl border py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:ring-4 ${
										isInvalidDate
											? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
											: 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/10'
									}`}
								/>
							</div>

							<p className='text-xs text-slate-400'>The homework becomes available from this date.</p>
						</div>

						{/* Due Date */}
						<div className='space-y-2'>
							<label htmlFor='homework-due-date' className='text-sm font-semibold text-slate-700'>
								Due Date
								<span className='ml-1 text-red-500'>*</span>
							</label>

							<div className='relative'>
								<Calendar size={18} className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400' />

								<input
									id='homework-due-date'
									type='datetime-local'
									value={dueDateValue}
									min={startDateValue || undefined}
									onChange={(e) => handleDueDateChange(e.target.value)}
									className={`w-full rounded-xl border py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:ring-4 ${
										isInvalidDate
											? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
											: 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/10'
									}`}
								/>
							</div>

							{isInvalidDate ? (
								<p className='text-xs text-red-500'>Due Date must be after Start Date.</p>
							) : (
								<p className='text-xs text-slate-400'>The deadline for completing this homework.</p>
							)}
						</div>

						{/* Description */}
						<div className='space-y-2'>
							<label htmlFor='homework-description' className='text-sm font-semibold text-slate-700'>
								Description
							</label>

							<div className='relative'>
								<FileText size={18} className='pointer-events-none absolute left-4 top-4 text-slate-400' />

								<textarea
									id='homework-description'
									value={formHomework.description}
									onChange={(e) => handleDescriptionChange(e.target.value)}
									placeholder='Describe what students need to complete...'
									rows={5}
									className='w-full resize-none rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10'
								/>
							</div>

							<p className='text-xs text-slate-400'>You can provide additional instructions for students.</p>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className='flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4'>
					<button
						type='button'
						onClick={onClose}
						disabled={submitting}
						className='rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
					>
						Cancel
					</button>

					<button
						type='button'
						onClick={handleSubmit}
						disabled={isSubmitDisabled}
						className='rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'
					>
						{submitting ? 'Creating...' : 'Create Homework'}
					</button>
				</div>
			</div>
		</div>
	);
}
