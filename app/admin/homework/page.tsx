'use client';

import { Calendar, Clock, MoreHorizontal, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CreateHomeworkDetailModal } from './CreateHomeWorkModal';

type Homework = {
	id: string;
	name: string;
	startDate: Date;
	dueDate: Date;
	description: string;
};

type HomeworkApiResponse = {
	id: string;
	name: string;
	start_date: string;
	due_date: string;
	description: string;
	created_at: string;
	updated_at: string;
};

const mockHomeworks: Homework[] = [
	{
		id: 'mock-1',
		name: 'IELTS Speaking Practice #01',
		startDate: new Date('2026-09-20T08:00'),
		dueDate: new Date('2026-09-28T23:59'),
		description: 'Practice IELTS Speaking Part 1 and Part 2.'
	},
	{
		id: 'mock-2',
		name: 'IELTS Reading Homework',
		startDate: new Date('2026-09-22T08:00'),
		dueDate: new Date('2026-10-02T23:59'),
		description: 'Complete the assigned reading passages.'
	},
	{
		id: 'mock-3',
		name: 'Weekly IELTS Practice',
		startDate: new Date('2026-09-15T08:00'),
		dueDate: new Date('2026-09-24T23:59'),
		description: 'Complete all assigned IELTS exercises.'
	}
];

const formatDate = (date: Date) => {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(date);
};

const getStatus = (startDate: Date, dueDate: Date) => {
	const now = new Date();

	if (now < startDate) {
		return {
			label: 'Upcoming',
			className: 'bg-blue-50 text-blue-600'
		};
	}

	if (now > dueDate) {
		return {
			label: 'Expired',
			className: 'bg-slate-100 text-slate-500'
		};
	}

	return {
		label: 'Active',
		className: 'bg-emerald-50 text-emerald-600'
	};
};

export default function AdminHomeworkPage() {
	const [search, setSearch] = useState('');
	const [homeworks, setHomeworks] = useState<Homework[]>(mockHomeworks);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchListHomework = async () => {
			try {
				setLoading(true);

				const response = await fetch('/api/admin/homework', {
					method: 'GET',
					cache: 'no-store'
				});

				const data = await response.json();

				if (!response.ok || !data.success) {
					throw new Error(data.error || 'Failed to fetch homework');
				}

				const apiHomeworks: Homework[] = (data.homeworks as HomeworkApiResponse[]).map((homework) => ({
					id: homework.id,
					name: homework.name,
					startDate: new Date(homework.start_date),
					dueDate: new Date(homework.due_date),
					description: homework.description
				}));

				setHomeworks([...mockHomeworks, ...apiHomeworks]);
			} catch (error) {
				console.error('[Fetch Homework Error]:', error);

				setHomeworks(mockHomeworks);
			} finally {
				setLoading(false);
			}
		};

		fetchListHomework();
	}, []);

	const filteredHomeworks = useMemo(() => {
		const keyword = search.trim().toLowerCase();

		if (!keyword) {
			return homeworks;
		}

		return homeworks.filter((homework) => homework.name.toLowerCase().includes(keyword) || homework.description.toLowerCase().includes(keyword));
	}, [search, homeworks]);

	const [openDetail, setOpenDetail] = useState(false);

	return (
		<>
			<div className='min-h-[calc(100vh-80px)] bg-slate-50 px-6 py-8'>
				<div className='mx-auto w-full max-w-7xl space-y-6'>
					<div className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
						{/* Toolbar */}
						<div className='flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between'>
							<div className='relative w-full md:max-w-sm'>
								<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />

								<input
									type='text'
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder='Search homework...'
									className='h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10'
								/>
							</div>

							<div className='text-sm text-slate-500'>
								<span className='font-semibold text-slate-800'>{filteredHomeworks.length}</span> homework
								{filteredHomeworks.length !== 1 ? 's' : ''}
							</div>
						</div>

						{/* Loading */}
						{loading ? (
							<div className='flex items-center justify-center px-6 py-16'>
								<div className='flex items-center gap-3 text-sm text-slate-500'>
									<div className='h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-purple-600' />
									Loading homework...
								</div>
							</div>
						) : (
							/* Table */
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[900px]'>
									<thead>
										<tr className='border-b border-slate-200 bg-slate-50/70'>
											<th className='px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>Homework</th>

											<th className='px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>Start Date</th>

											<th className='px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>Due Date</th>

											<th className='px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500'>Status</th>

											<th className='px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500'>Actions</th>
										</tr>
									</thead>

									<tbody className='divide-y divide-slate-100'>
										{filteredHomeworks.length > 0 ? (
											filteredHomeworks.map((homework) => {
												const status = getStatus(homework.startDate, homework.dueDate);

												return (
													<tr key={homework.id} className='group transition hover:bg-slate-50/70'>
														<td className='px-6 py-5'>
															<div className='flex items-start gap-3'>
																<div className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600'>
																	<Calendar className='h-5 w-5' />
																</div>

																<div className='min-w-0'>
																	<p className='truncate font-semibold text-slate-900'>{homework.name}</p>

																	<p className='mt-1 max-w-md truncate text-sm text-slate-500'>{homework.description}</p>
																</div>
															</div>
														</td>

														<td className='px-6 py-5'>
															<div className='flex items-center gap-2 text-sm text-slate-600'>
																<Clock className='h-4 w-4 text-slate-400' />

																{formatDate(homework.startDate)}
															</div>
														</td>

														<td className='px-6 py-5'>
															<div className='flex items-center gap-2 text-sm text-slate-600'>
																<Clock className='h-4 w-4 text-slate-400' />

																{formatDate(homework.dueDate)}
															</div>
														</td>

														<td className='px-6 py-5'>
															<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
																{status.label}
															</span>
														</td>

														<td className='px-6 py-5 text-right'>
															<button
																type='button'
																onClick={() => setOpenDetail(true)}
																className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700'
															>
																<MoreHorizontal className='h-5 w-5' />
															</button>
														</td>
													</tr>
												);
											})
										) : (
											<tr>
												<td colSpan={5} className='px-6 py-16 text-center'>
													<div className='mx-auto flex max-w-sm flex-col items-center'>
														<div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100'>
															<Search className='h-6 w-6 text-slate-400' />
														</div>

														<h3 className='mt-4 font-semibold text-slate-900'>No homework found</h3>

														<p className='mt-1 text-sm text-slate-500'>Try changing your search keyword.</p>
													</div>
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</div>
			{openDetail && <CreateHomeworkDetailModal onClose={() => setOpenDetail(false)} />}
		</>
	);
}
