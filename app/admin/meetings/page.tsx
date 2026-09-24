'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAdminUser, useAdminSidebarVisible } from '@/components/admin/AdminAuthContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, RefreshCw, ShieldAlert, Sparkles, Video, X } from 'lucide-react';
import { Meeting, MeetingParticipant, MeetingRoomOption, MeetingRosterMember } from '@/types/meeting';

const button = 'rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed';
const primary = `${button} bg-purple-600 text-white hover:bg-purple-700 border-purple-600`;
const input = 'w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-purple-600';
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourSlots = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minuteSlots = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));

function localDateValue(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDateTimeValue(date: Date) {
	return `${localDateValue(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatMeetingDateTime(value: string | Date, locale: string) {
	const date = typeof value === 'string' ? new Date(value) : value;
	const language = locale === 'vi' ? 'vi-VN' : 'en-US';
	return `${date.toLocaleDateString(language)} ${date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function TimeWheel({ label, values, value, disabled, onChange }: { label: string; values: string[]; value: string; disabled: boolean; onChange: (value: string) => void }) {
	const listRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		listRef.current?.querySelector(`[data-time-value='${value}']`)?.scrollIntoView({ block: 'center' });
	}, [value]);
	const move = (direction: number) => {
		const index = Math.max(0, values.indexOf(value));
		onChange(values[Math.min(values.length - 1, Math.max(0, index + direction))]);
	};
	return (
		<label className='block text-xs font-bold text-slate-700'>
			{label}
			<div
				ref={listRef}
				onWheel={(event) => {
					event.preventDefault();
					if (!disabled) move(event.deltaY > 0 ? 1 : -1);
				}}
				className='mt-1 h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-inner'
			>
				{values.map((item) => (
					<button
						key={item}
						type='button'
						data-time-value={item}
						disabled={disabled}
						onClick={() => onChange(item)}
						className={`block w-full rounded-lg py-1.5 text-sm font-semibold transition-colors ${item === value ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-purple-100'}`}
					>
						{item}
					</button>
				))}
			</div>
		</label>
	);
}

function MeetingDateTimePicker({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
	const { t, locale } = useTranslation();
	const selected = value ? new Date(value) : null;
	const [month, setMonth] = useState(() => new Date(selected || new Date()));
	const [isOpen, setIsOpen] = useState(false);
	useEffect(() => {
		if (selected) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
	}, [value]);
	const year = month.getFullYear();
	const monthNumber = month.getMonth();
	const firstDay = new Date(year, monthNumber, 1).getDay();
	const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();
	const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => (index < firstDay ? null : index - firstDay + 1));
	const selectedDate = selected ? localDateValue(selected) : '';
	const selectedHour = selected ? String(selected.getHours()).padStart(2, '0') : '';
	const selectedMinute = selected ? String(selected.getMinutes()).padStart(2, '0') : '';
	const selectDay = (day: number) => {
		const current = selected || new Date(year, monthNumber, day, 9, 0);
		onChange(localDateTimeValue(new Date(year, monthNumber, day, current.getHours(), current.getMinutes())));
	};
	const setTimePart = (hour: number, minute: number) => {
		if (!selected) return;
		onChange(localDateTimeValue(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), hour, minute)));
	};
	return (
		<div className='space-y-2'>
			<button type='button' className={`${input} flex items-center justify-between text-left font-semibold`} aria-expanded={isOpen} disabled={disabled} onClick={() => setIsOpen((open) => !open)}>
				<span>{selected ? formatMeetingDateTime(selected, locale) : t('meeting.chooseDateTime')}</span>
				<CalendarDays className='h-5 w-5 shrink-0 text-purple-600' />
			</button>
			{isOpen && <div className='w-full space-y-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
				<div className='grid gap-3 md:grid-cols-2'>
					<div className='w-full space-y-1.5'>
						<div className='flex items-center justify-between gap-2'>
							<button type='button' className='rounded-lg border border-slate-200 p-1.5 hover:bg-purple-50 disabled:opacity-50' aria-label={t('meeting.previousMonth')} disabled={disabled} onClick={() => setMonth(new Date(year, monthNumber - 1, 1))}><ChevronLeft className='h-4 w-4' /></button>
							<p className='text-sm font-bold text-slate-900'>{month.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', year: 'numeric' })}</p>
							<button type='button' className='rounded-lg border border-slate-200 p-1.5 hover:bg-purple-50 disabled:opacity-50' aria-label={t('meeting.nextMonth')} disabled={disabled} onClick={() => setMonth(new Date(year, monthNumber + 1, 1))}><ChevronRight className='h-4 w-4' /></button>
						</div>
						<div className='grid grid-cols-7 gap-px text-center'>
							{weekdays.map((day) => <span key={day} className='py-0.5 text-[9px] font-bold text-slate-400'>{day.slice(0, 1)}</span>)}
							{cells.map((day, index) => day === null ? <span key={`empty-${index}`} /> : <button key={day} type='button' disabled={disabled} onClick={() => selectDay(day)} className={`aspect-square rounded text-[11px] font-semibold transition-colors ${selectedDate === localDateValue(new Date(year, monthNumber, day)) ? 'bg-purple-600 text-white' : 'text-slate-700 hover:bg-purple-50'}`}>{day}</button>)}
						</div>
					</div>
					<div className='space-y-2 border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0'>
						<p className='text-sm font-bold text-slate-800'>{t('meeting.time')}</p>
						<p className='min-h-4 text-xs text-slate-500'>{!selected ? t('meeting.chooseDateFirst') : ''}</p>
						<div className='grid grid-cols-2 gap-2'>
							<TimeWheel label={t('meeting.hour')} values={hourSlots} value={selectedHour} disabled={disabled || !selected} onChange={(hour) => setTimePart(Number(hour), selected?.getMinutes() || 0)} />
							<TimeWheel label={t('meeting.minute')} values={minuteSlots} value={selectedMinute} disabled={disabled || !selected} onChange={(minute) => setTimePart(selected?.getHours() || 0, Number(minute))} />
						</div>
						<div className='flex justify-end'><button type='button' className='rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50' disabled={disabled || !selected} onClick={() => setIsOpen(false)}>{t('meeting.done')}</button></div>
					</div>
				</div>
			</div>}
		</div>
	);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`/api/admin/meetings${path}`, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json' } });
	const data = await response.json().catch(() => null);
	if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to complete the request. Please try again.');
	return data as T;
}

function Avatar({ person }: { person: MeetingParticipant }) {
	const [failed, setFailed] = useState(false);
	return (
		<span
			title={person.display_name}
			className='inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-purple-100 text-xs font-bold text-purple-700'
		>
			{person.avatar_url && !failed ? (
				<img src={person.avatar_url} alt={person.display_name} className='h-full w-full object-cover' onError={() => setFailed(true)} />
			) : (
				person.display_name.slice(0, 2).toUpperCase()
			)}
		</span>
	);
}

function Modal({ title, children, onClose, busy, compact = false, tall = false }: { title: string; children: ReactNode; onClose: () => void; busy: boolean; compact?: boolean; tall?: boolean }) {
	const { t } = useTranslation();
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null;
		ref.current?.showModal();
		return () => {
			previous?.focus();
		};
	}, []);
	return (
		<dialog
			ref={ref}
			aria-label={title}
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) onClose();
			}}
			className={`w-[calc(100%-2rem)] ${compact ? 'max-w-xl' : 'max-w-2xl'} rounded-3xl p-0 shadow-xl backdrop:bg-slate-900/50`}
		>
			<div className={`${tall ? 'max-h-[96vh]' : 'max-h-[85vh]'} overflow-y-auto p-6 space-y-5`}>
				<div className='flex items-center justify-between gap-4'>
					<h2 className='text-lg font-extrabold text-slate-900'>{title}</h2>
					<button type='button' className={button} aria-label={t('meeting.close')} disabled={busy} onClick={onClose}>
						<X className='h-4 w-4' />
					</button>
				</div>
				{children}
			</div>
		</dialog>
	);
}

export default function AdminMeetingsPage() {
	const { t, locale } = useTranslation();
	const user = useAdminUser();
	const isAuthorized = user.role === 'admin';
	useAdminSidebarVisible(isAuthorized);
	const [meetings, setMeetings] = useState<Meeting[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [search, setSearch] = useState('');
	const [modal, setModal] = useState<'create' | 'edit' | 'detail' | 'assign' | 'delete' | null>(null);
	const [selected, setSelected] = useState<Meeting | null>(null);
	const [title, setTitle] = useState('');
	const [scheduledAt, setScheduledAt] = useState('');
	const [busy, setBusy] = useState(false);
	const [modalLoading, setModalLoading] = useState(false);
	const [modalError, setModalError] = useState('');
	const [optionsReady, setOptionsReady] = useState(false);
	const [rooms, setRooms] = useState<MeetingRoomOption[]>([]);
	const [roster, setRoster] = useState<MeetingParticipant[]>([]);
	const [people, setPeople] = useState<string[]>([]);
	const [roomId, setRoomId] = useState('');
	const [peopleSearch, setPeopleSearch] = useState('');
	const [syncingOptions, setSyncingOptions] = useState(false);
	const [syncNotice, setSyncNotice] = useState('');
	const generation = useRef(0);
	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			setMeetings((await request<{ meetings: Meeting[] }>('')).meetings);
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		if (isAuthorized) void load();
		else setLoading(false);
	}, [isAuthorized, load]);
	function close() {
		generation.current++;
		setModal(null);
		setSelected(null);
		setModalError('');
		setSyncNotice('');
	}
	async function open(mode: 'detail' | 'assign', meeting: Meeting) {
		const version = ++generation.current;
		setSelected(null);
		setModal(mode);
		setModalLoading(true);
		setModalError('');
		setSyncNotice('');
		setPeopleSearch('');
		setOptionsReady(false);
		try {
			const detail = await request<{ meeting: Meeting }>(`/${encodeURIComponent(meeting.id)}`);
			if (version !== generation.current) return;
			setSelected(detail.meeting);
			if (mode === 'assign') {
				const [roomData, rosterData] = await Promise.all([
					request<{ rooms: MeetingRoomOption[] }>('/rooms'),
					request<{ roster: MeetingRosterMember[] }>('/roster')
				]);
				if (version !== generation.current) return;
				setRooms(roomData.rooms);
				setRoster(rosterData.roster);
				const availablePeople = new Set(rosterData.roster.map((person) => person.mezon_id));
				setPeople(detail.meeting.participants.map((person) => person.mezon_id).filter((id) => availablePeople.has(id)));
				setRoomId(detail.meeting.room_id || '');
				setOptionsReady(true);
			}
		} catch (error) {
			if (version === generation.current) setModalError((error as Error).message);
		} finally {
			if (version === generation.current) setModalLoading(false);
		}
	}
	async function syncAssignmentOptions() {
		if (!selected || syncingOptions) return;
		setSyncingOptions(true);
		setModalError('');
		setSyncNotice('');
		try {
			const data = await request<{ rooms: MeetingRoomOption[]; roster: MeetingRosterMember[] }>('/sync', { method: 'POST' });
			setRooms(data.rooms);
			setRoster(data.roster);
			const availablePeople = new Set(data.roster.map((person) => person.mezon_id));
			setPeople((current) => current.filter((id) => availablePeople.has(id)));
			setSyncNotice(t('meeting.syncComplete', { rooms: data.rooms.length, people: data.roster.length }));
		} catch (error) {
			setModalError((error as Error).message);
		} finally {
			setSyncingOptions(false);
		}
	}
	function edit(meeting?: Meeting) {
		setSelected(meeting || null);
		setTitle(meeting?.title || '');
		setModalError('');
		if (meeting) setScheduledAt(localDateTimeValue(new Date(meeting.scheduled_at)));
		else setScheduledAt('');
		setModal(meeting ? 'edit' : 'create');
	}
	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setModalError('');
		try {
			if (modal === 'create' || modal === 'edit') {
				await request(selected ? `/${encodeURIComponent(selected.id)}` : '', {
					method: selected ? 'PATCH' : 'POST',
					body: JSON.stringify({ title: title.trim(), scheduled_at: new Date(scheduledAt).toISOString() })
				});
			} else if (modal === 'assign' && selected) {
				await request(`/${encodeURIComponent(selected.id)}/assign`, {
					method: 'POST',
					body: JSON.stringify({
						participants: roster.filter((p) => people.includes(p.mezon_id)),
						replace_participants: true,
						room_id: roomId,
						room_name: rooms.find((r) => r.room_id === roomId)?.room_name || (roomId === selected.room_id ? selected.room_name : '')
					})
				});
			} else if (modal === 'delete' && selected) {
				await request(`/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
			}
			setNotice(modal === 'delete' ? t('meeting.deleted') : t('meeting.saved'));
			close();
			await load();
		} catch (error) {
			setModalError((error as Error).message);
		} finally {
			setBusy(false);
		}
	}
	if (!isAuthorized)
		return (
			<div className='mx-auto max-w-md rounded-3xl border bg-white p-8 text-center space-y-4'>
				<ShieldAlert className='mx-auto text-rose-600' />
				<h1 className='text-xl font-bold'>{t('meeting.accessDenied')}</h1>
				<p className='text-sm text-slate-600'>{t('meeting.accessDeniedDescription')}</p>
			</div>
		);
	return (
		<div className='space-y-7'>
			<div className='flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:p-8'>
				<div className='space-y-2'>
					<span className='inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold uppercase text-purple-700'>
						<Sparkles className='h-3.5 w-3.5' /> {t('meeting.adminPortal')}
					</span>
					<h1 className='text-3xl font-extrabold text-slate-900'>{t('meeting.managementTitle')}</h1>
					<p className='text-xs text-slate-600'>{t('meeting.managementDescription')}</p>
				</div>
				<button className={`${primary} inline-flex items-center justify-center gap-2`} onClick={() => edit()}>
					<Plus className='h-4 w-4' /> {t('meeting.create')}
				</button>
			</div>
			{notice && (
				<p role='status' className='text-sm text-emerald-700'>
					{notice}
				</p>
			)}
			{error && (
				<div role='alert' className='rounded-xl bg-rose-50 p-4 text-sm text-rose-700'>
					{error}{' '}
					<button className={button} onClick={() => void load()}>
						{t('meeting.retry')}
					</button>
				</div>
			)}
			<label className='block'>
				<span className='sr-only'>{t('meeting.search')}</span>
				<input aria-label={t('meeting.search')} className={input} placeholder={t('meeting.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
			</label>
			{loading ? (
				<p role='status' className='p-8 text-center text-sm text-slate-500'>
					{t('meeting.loading')}
				</p>
			) : (
				!error && (
					<div className='space-y-4'>
						{meetings
							.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
							.map((meeting) => (
								<article key={meeting.id} className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
									<div className='flex flex-wrap items-start justify-between gap-4'>
										<div className='min-w-0 space-y-2'>
											<button
												className='break-words text-left text-lg font-extrabold text-slate-900 hover:text-purple-700'
												onClick={() => void open('detail', meeting)}
											>
												{meeting.title}
											</button>
											<p className='text-sm text-slate-500'>{formatMeetingDateTime(meeting.scheduled_at, locale)}</p>
											<p className='flex items-center gap-2 text-xs text-slate-500'>
												<Video className='h-4 w-4' />
												{meeting.room_name || t('meeting.noRoom')}
											</p>
										</div>
										<div className='flex flex-wrap gap-2'>
											<button className={button} onClick={() => void open('detail', meeting)}>
												{t('meeting.details')}
											</button>
											<button className={button} onClick={() => void open('assign', meeting)}>
												{t('meeting.assignPeopleRoom')}
											</button>
											<button className={button} onClick={() => edit(meeting)}>
												{t('meeting.edit')}
											</button>
											<button
												className={`${button} text-rose-600`}
												onClick={() => {
													setSelected(meeting);
													setModalError('');
													setModal('delete');
												}}
											>
												{t('meeting.delete')}
											</button>
										</div>
									</div>
									<div className='mt-4 flex flex-wrap items-center gap-3'>
										<div className='flex -space-x-2'>
											{meeting.participants.slice(0, 10).map((p) => (
												<Avatar key={p.mezon_id} person={p} />
											))}
										</div>
										{meeting.participant_count > 10 && (
											<button
											aria-label={t('meeting.viewAllParticipants', { count: meeting.participant_count })}
												className={button}
												onClick={() => void open('detail', meeting)}
											>
												+{meeting.participant_count - 10} …
											</button>
										)}
										<span className='text-xs text-slate-500'>{t('meeting.participants', { count: meeting.participant_count })}</span>
									</div>
								</article>
							))}
						{!meetings.some((m) => m.title.toLowerCase().includes(search.toLowerCase())) && (
							<div className='rounded-3xl border bg-white p-12 text-center text-sm text-slate-500'>
								{search ? t('meeting.noSearchResults') : t('meeting.noMeetings')}
							</div>
						)}
					</div>
				)
			)}
			{modal && (
				<Modal
					title={{ create: t('meeting.create'), edit: t('meeting.edit'), detail: t('meeting.details'), assign: t('meeting.assign'), delete: t('meeting.delete') }[modal]}
					onClose={close}
					busy={busy}
					compact={modal === 'create' || modal === 'edit'}
					tall={modal === 'create' || modal === 'edit'}
				>
					{modalError && (
						<p role='alert' className='rounded-xl bg-rose-50 p-3 text-sm text-rose-700'>
							{modalError}
						</p>
					)}
					{modalLoading && (modal === 'detail' || modal === 'assign') ? (
						<p role='status'>{t('meeting.loading')}</p>
					) : (
						<>
							{modal === 'detail' && selected && (
								<div className='space-y-4'>
									<h3 className='break-words font-bold'>{selected.title}</h3>
									<p className='text-sm'>{formatMeetingDateTime(selected.scheduled_at, locale)}</p>
									<p className='text-sm'>{t('meeting.room')}: {selected.room_name || t('meeting.noRoom')}</p>
									<h4 className='font-bold'>{t('meeting.participantDetails', { count: selected.participant_count })}</h4>
									{!selected.participants.length && <p className='text-sm text-slate-500'>{t('meeting.noParticipants')}</p>}
									<ul className='space-y-2'>
										{selected.participants.map((p) => (
											<li className='flex items-center gap-3' key={p.mezon_id}>
												<Avatar person={p} />
												<span className='break-words text-sm'>{p.display_name}</span>
												<span className='text-xs capitalize text-slate-500'>{p.role}</span>
											</li>
										))}
									</ul>
								</div>
							)}
							{modal !== 'detail' && (
								<form onSubmit={save} className='space-y-5'>
									{(modal === 'create' || modal === 'edit') && (
										<>
											<label className='block space-y-2 text-sm font-bold'>
											{t('meeting.meetingTitle')}
												<input
													autoFocus
													required
													maxLength={200}
													className={input}
													value={title}
													onChange={(e) => setTitle(e.target.value)}
													disabled={busy}
												/>
											</label>
											<div className='space-y-2'>
												<p className='flex items-center gap-2 text-sm font-bold'><CalendarDays className='h-4 w-4 text-purple-600' />{t('meeting.scheduledTime')}</p>
												<MeetingDateTimePicker value={scheduledAt} onChange={setScheduledAt} disabled={busy} />
											</div>
											<p className='text-xs text-slate-500'>
												{t('meeting.timeZone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
											</p>
										</>
									)}
									{modal === 'assign' && selected && optionsReady && (
										<>
											<div className='flex flex-wrap items-center justify-between gap-3'>
												<p className='font-bold'>{selected.title}</p>
												<button type='button' className={`${button} inline-flex items-center gap-2`} disabled={busy || syncingOptions} onClick={() => void syncAssignmentOptions()}>
													<RefreshCw className={`h-4 w-4 ${syncingOptions ? 'animate-spin' : ''}`} />
													{syncingOptions ? t('meeting.syncingClan') : t('meeting.syncClan')}
												</button>
											</div>
											{syncNotice && <p role='status' className='text-xs text-emerald-700'>{syncNotice}</p>}
											<label className='block space-y-2 text-sm font-bold'>
												{t('meeting.room')}
												<div className='relative'>
													<select className={`${input} appearance-none pr-11`} value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={busy}>
														<option value=''>{t('meeting.noRoom')}</option>
														{selected.room_id && !rooms.some((r) => r.room_id === selected.room_id) && (
															<option value={selected.room_id}>{selected.room_name || selected.room_id}</option>
														)}
														{rooms.map((r) => (
															<option key={r.room_id} value={r.room_id}>
																{r.room_name}
															</option>
														))}
													</select>
													<ChevronDown aria-hidden className='pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-700' />
												</div>
											</label>
											{!rooms.length && <p className='text-xs text-slate-500'>{t('meeting.noSyncedRooms')}</p>}
											<fieldset disabled={busy} className='space-y-3'>
												<legend className='text-sm font-bold'>{t('meeting.participants', { count: people.length })} · {t('meeting.selected', { count: people.length })}</legend>
												<input
													aria-label={t('meeting.searchPeople')}
													className={input}
													placeholder={t('meeting.searchPeople')}
													value={peopleSearch}
													onChange={(e) => setPeopleSearch(e.target.value)}
												/>
												<div className='max-h-64 overflow-y-auto space-y-2'>
													{roster
														.filter((p) => `${p.display_name} ${p.username || ''}`.toLowerCase().includes(peopleSearch.toLowerCase()))
														.map((p) => (
															<label className='flex cursor-pointer items-center gap-3 rounded-xl border p-2' key={p.mezon_id}>
																<input
																	type='checkbox'
																	checked={people.includes(p.mezon_id)}
																	onChange={(e) =>
																		setPeople((current) => (e.target.checked ? [...current, p.mezon_id] : current.filter((id) => id !== p.mezon_id)))
																	}
																/>
																<Avatar person={p} />
																<span className='text-sm'>{p.display_name}</span>
																<span className='ml-auto text-xs capitalize text-slate-500'>{p.role}</span>
															</label>
														))}
												</div>
											{!roster.length && <p className='text-xs text-slate-500'>{t('meeting.noSyncedPeople')}</p>}
											</fieldset>
										</>
									)}
									{modal === 'delete' && (
										<p className='text-sm'>{t('meeting.deleteConfirmation', { title: selected?.title || '' })}</p>
									)}
									<div className='flex justify-end gap-2'>
										<button type='button' className={button} disabled={busy} onClick={close}>
											{t('meeting.cancel')}
										</button>
										<button
											type='submit'
											className={primary}
												disabled={busy || (modal === 'assign' && !optionsReady) || ((modal === 'create' || modal === 'edit') && (!title.trim() || !scheduledAt))}
										>
											{busy ? t('meeting.saving') : modal === 'delete' ? t('meeting.delete') : t('meeting.save')}
										</button>
									</div>
								</form>
							)}
						</>
					)}
				</Modal>
			)}
		</div>
	);
}
