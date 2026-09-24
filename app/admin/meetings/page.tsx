'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAdminUser, useAdminSidebarVisible } from '@/components/admin/AdminAuthContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, GraduationCap, Plus, RefreshCw, ShieldAlert, Sparkles, User, Video, X } from 'lucide-react';
import { Meeting, MeetingParticipant, MeetingRoomOption, MeetingRosterMember, MeetingClassOption } from '@/types/meeting';

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

// "24/09/2026 17:00–18:00" when an end time is set; legacy meetings saved before this field
// existed just show the start time on its own.
function formatMeetingTimeRange(meeting: { scheduled_at: string; ended_at?: string }, locale: string) {
	if (!meeting.ended_at) return formatMeetingDateTime(meeting.scheduled_at, locale);
	const end = new Date(meeting.ended_at);
	const language = locale === 'vi' ? 'vi-VN' : 'en-US';
	const endTime = end.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hour12: false });
	return `${formatMeetingDateTime(meeting.scheduled_at, locale)}–${endTime}`;
}

// Default end time when a start time is (re)picked and there's no valid existing end: an hour
// later, clamped to the same day since a meeting's end time never crosses into the next day.
function defaultEndTime(start: Date): Date {
	const endOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59);
	return new Date(Math.min(start.getTime() + 60 * 60 * 1000, endOfDay.getTime()));
}

// A native <select> here renders its dropdown with all 24/60 options at full height (no way to
// cap that cross-browser), so this is a small custom combobox instead: a select-styled trigger
// button opening a short, scrollable floating panel.
function TimeWheel({
	label,
	values,
	value,
	disabled,
	min,
	onChange
}: {
	label: string;
	values: string[];
	value: string;
	disabled: boolean;
	min?: string;
	onChange: (value: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (isOpen) listRef.current?.querySelector(`[data-time-value='${value}']`)?.scrollIntoView({ block: 'center' });
	}, [isOpen, value]);
	return (
		<div>
			<p className='text-xs font-bold text-slate-700'>{label}</p>
			<div className='relative'>
				<button
					type='button'
					aria-label={label}
					aria-expanded={isOpen}
					className={`${input} mt-1 flex items-center justify-between py-2 pr-3 text-sm text-slate-700`}
					disabled={disabled}
					onClick={() => setIsOpen((open) => !open)}
				>
					<span>{value || '--'}</span>
					<ChevronDown aria-hidden className='h-4 w-4 text-slate-500' />
				</button>
				{isOpen && (
					<div ref={listRef} className='absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg'>
						{values.map((item) => {
							const itemDisabled = min !== undefined && item < min;
							return (
								<button
									key={item}
									type='button'
									data-time-value={item}
									disabled={itemDisabled}
									onClick={() => {
										onChange(item);
										setIsOpen(false);
									}}
									className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition-colors ${
										item === value ? 'bg-purple-600 text-white' : itemDisabled ? 'text-slate-300' : 'text-slate-600 hover:bg-purple-50'
									}`}
								>
									{item}
								</button>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

// Single picker for the whole schedule: one calendar (the end time always shares the start's
// day - a meeting doesn't span midnight) plus a start and an end Giờ/Phút row, all in one
// dropdown instead of two separate buttons/panels that don't line up with each other.
function MeetingSchedulePicker({
	startValue,
	endValue,
	onChange,
	disabled
}: {
	startValue: string;
	endValue: string;
	onChange: (startValue: string, endValue: string) => void;
	disabled: boolean;
}) {
	const { t, locale } = useTranslation();
	const start = startValue ? new Date(startValue) : null;
	const end = endValue ? new Date(endValue) : null;
	const [month, setMonth] = useState(() => new Date(start || new Date()));
	const [isOpen, setIsOpen] = useState(false);
	useEffect(() => {
		if (start) setMonth(new Date(start.getFullYear(), start.getMonth(), 1));
	}, [startValue]);
	const year = month.getFullYear();
	const monthNumber = month.getMonth();
	const firstDay = new Date(year, monthNumber, 1).getDay();
	const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();
	const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => (index < firstDay ? null : index - firstDay + 1));
	const selectedDate = start ? localDateValue(start) : '';
	const startHour = start ? String(start.getHours()).padStart(2, '0') : '';
	const startMinute = start ? String(start.getMinutes()).padStart(2, '0') : '';
	const endHour = end ? String(end.getHours()).padStart(2, '0') : '';
	const endMinute = end ? String(end.getMinutes()).padStart(2, '0') : '';
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const isToday = selectedDate === localDateValue(now);
	const nowHourStr = String(now.getHours()).padStart(2, '0');
	const nowMinuteStr = String(now.getMinutes()).padStart(2, '0');
	const startMinHour = isToday ? nowHourStr : undefined;
	const startMinMinute = isToday && startHour === nowHourStr ? nowMinuteStr : undefined;
	const endMinHour = start ? startHour : undefined;
	const endMinMinute = start && endHour === startHour ? String(start.getMinutes() + 1).padStart(2, '0') : undefined;
	// Picking a day keeps both times' hour/minute but moves them onto that day, clamping the
	// start forward if it'd land in the past and re-defaulting the end if it'd no longer be
	// strictly after the (possibly clamped) start.
	const selectDay = (day: number) => {
		const baseStart = start || new Date(year, monthNumber, day, 9, 0);
		let nextStart = new Date(year, monthNumber, day, baseStart.getHours(), baseStart.getMinutes());
		if (nextStart < now) nextStart = new Date(year, monthNumber, day, now.getHours(), now.getMinutes());
		let nextEnd = end ? new Date(year, monthNumber, day, end.getHours(), end.getMinutes()) : null;
		if (!nextEnd || nextEnd <= nextStart) nextEnd = defaultEndTime(nextStart);
		onChange(localDateTimeValue(nextStart), localDateTimeValue(nextEnd));
	};
	const setStartTimePart = (hour: number, minute: number) => {
		if (!start) return;
		let nextStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, minute);
		if (nextStart < now) nextStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), now.getHours(), now.getMinutes());
		const nextEnd = !end || end <= nextStart ? defaultEndTime(nextStart) : end;
		onChange(localDateTimeValue(nextStart), localDateTimeValue(nextEnd));
	};
	const setEndTimePart = (hour: number, minute: number) => {
		if (!start) return;
		const nextEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, minute);
		onChange(localDateTimeValue(start), localDateTimeValue(nextEnd));
	};
	return (
		<div className='space-y-2'>
			<button
				type='button'
				className={`${input} flex items-center justify-between text-left`}
				aria-expanded={isOpen}
				disabled={disabled}
				onClick={() => setIsOpen((open) => !open)}
			>
				<span>{start ? `${formatMeetingDateTime(start, locale)}${end ? `–${endHour}:${endMinute}` : ''}` : t('meeting.chooseDateTime')}</span>
				<CalendarDays className='h-5 w-5 shrink-0 text-purple-600' />
			</button>
			{isOpen && (
				<div className='w-full space-y-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
					<div className='grid gap-3 md:grid-cols-2'>
						<div className='w-full space-y-1.5'>
							<div className='flex items-center justify-between gap-2'>
								<button type='button' className='rounded-lg border border-slate-200 p-1.5 hover:bg-purple-50 disabled:opacity-50' aria-label={t('meeting.previousMonth')} disabled={disabled} onClick={() => setMonth(new Date(year, monthNumber - 1, 1))}><ChevronLeft className='h-4 w-4' /></button>
								<p className='text-sm font-bold text-slate-900'>{month.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', year: 'numeric' })}</p>
								<button type='button' className='rounded-lg border border-slate-200 p-1.5 hover:bg-purple-50 disabled:opacity-50' aria-label={t('meeting.nextMonth')} disabled={disabled} onClick={() => setMonth(new Date(year, monthNumber + 1, 1))}><ChevronRight className='h-4 w-4' /></button>
							</div>
							<div className='grid grid-cols-7 gap-px text-center'>
								{weekdays.map((day) => <span key={day} className='py-0.5 text-[9px] font-bold text-slate-400'>{day.slice(0, 1)}</span>)}
								{cells.map((day, index) => {
									if (day === null) return <span key={`empty-${index}`} />;
									const cellDate = new Date(year, monthNumber, day);
									const isPast = cellDate < todayStart;
									const isSelected = selectedDate === localDateValue(cellDate);
									return (
										<button
											key={day}
											type='button'
											disabled={disabled || isPast}
											onClick={() => selectDay(day)}
											className={`aspect-square rounded text-[11px] font-semibold transition-colors ${
												isSelected ? 'bg-purple-600 text-white' : isPast ? 'text-slate-300' : 'text-slate-700 hover:bg-purple-50'
											}`}
										>
											{day}
										</button>
									);
								})}
							</div>
						</div>
						<div className='space-y-3 border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0'>
							<div className='space-y-1.5'>
								<p className='text-sm font-bold text-slate-800'>{t('meeting.scheduledTime')}</p>
								<p className='min-h-4 text-xs text-slate-500'>{!start ? t('meeting.chooseDateFirst') : ''}</p>
								<div className='grid grid-cols-2 gap-2'>
									<TimeWheel label={t('meeting.hour')} values={hourSlots} value={startHour} disabled={disabled || !start} min={startMinHour} onChange={(hour) => setStartTimePart(Number(hour), start?.getMinutes() || 0)} />
									<TimeWheel label={t('meeting.minute')} values={minuteSlots} value={startMinute} disabled={disabled || !start} min={startMinMinute} onChange={(minute) => setStartTimePart(start?.getHours() || 0, Number(minute))} />
								</div>
							</div>
							<div className='space-y-1.5 border-t border-slate-100 pt-3'>
								<p className='text-sm font-bold text-slate-800'>{t('meeting.endTime')}</p>
								<div className='grid grid-cols-2 gap-2'>
									<TimeWheel label={t('meeting.hour')} values={hourSlots} value={endHour} disabled={disabled || !start} min={endMinHour} onChange={(hour) => setEndTimePart(Number(hour), end?.getMinutes() ?? 0)} />
									<TimeWheel label={t('meeting.minute')} values={minuteSlots} value={endMinute} disabled={disabled || !start} min={endMinMinute} onChange={(minute) => setEndTimePart(end?.getHours() ?? 0, Number(minute))} />
								</div>
							</div>
							<div className='flex justify-end'><button type='button' className='rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50' disabled={disabled || !start} onClick={() => setIsOpen(false)}>{t('meeting.done')}</button></div>
						</div>
					</div>
				</div>
			)}
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

function Modal({
	title,
	children,
	footer,
	onClose,
	busy,
	compact = false,
	tall = false
}: {
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	onClose: () => void;
	busy: boolean;
	compact?: boolean;
	tall?: boolean;
}) {
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
			className={`!fixed !top-1/2 !left-1/2 !bottom-auto !m-0 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] ${compact ? 'max-w-xl' : 'max-w-2xl'} rounded-3xl p-0 shadow-xl backdrop:bg-slate-900/50`}
		>
			{/* Header and footer sit outside the scroll region (not just sticky within it), so the
			    scrollbar itself is confined to the middle content area instead of running the full
			    height of the dialog. */}
			<div className={`flex flex-col ${tall ? 'h-[85vh]' : 'max-h-[85vh]'}`}>
				<div className='flex shrink-0 items-center justify-between gap-4 rounded-t-3xl border-b border-slate-100 bg-white px-6 py-4'>
					<h2 className='text-lg font-extrabold text-slate-900'>{title}</h2>
					<button type='button' className={button} aria-label={t('meeting.close')} disabled={busy} onClick={onClose}>
						<X className='h-4 w-4' />
					</button>
				</div>
				<div className='flex-1 space-y-5 overflow-y-auto p-6'>{children}</div>
				{footer && <div className='flex shrink-0 justify-end gap-2 rounded-b-3xl border-t border-slate-100 bg-white px-6 py-4'>{footer}</div>}
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
	const [modal, setModal] = useState<'create' | 'edit' | 'detail' | 'delete' | null>(null);
	const [selected, setSelected] = useState<Meeting | null>(null);
	const [title, setTitle] = useState('');
	const [scheduledAt, setScheduledAt] = useState('');
	const [endedAt, setEndedAt] = useState('');
	const [busy, setBusy] = useState(false);
	const [modalLoading, setModalLoading] = useState(false);
	const [modalError, setModalError] = useState('');
	const [optionsReady, setOptionsReady] = useState(false);
	const [rooms, setRooms] = useState<MeetingRoomOption[]>([]);
	const [roster, setRoster] = useState<MeetingParticipant[]>([]);
	const [people, setPeople] = useState<string[]>([]);
	const [roomId, setRoomId] = useState('');
	const [teacherId, setTeacherId] = useState('');
	const [peopleSearch, setPeopleSearch] = useState('');
	const [syncingOptions, setSyncingOptions] = useState(false);
	const [syncNotice, setSyncNotice] = useState('');
	const [classes, setClasses] = useState<MeetingClassOption[]>([]);
	const [classId, setClassId] = useState('');
	const [classRoster, setClassRoster] = useState<MeetingParticipant[] | null>(null);
	const [classLoading, setClassLoading] = useState(false);
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
	function handleScheduleChange(nextStart: string, nextEnd: string) {
		setScheduledAt(nextStart);
		setEndedAt(nextEnd);
	}
	async function openDetail(meeting: Meeting) {
		const version = ++generation.current;
		setSelected(null);
		setModal('detail');
		setModalLoading(true);
		setModalError('');
		setSyncNotice('');
		try {
			const detail = await request<{ meeting: Meeting }>(`/${encodeURIComponent(meeting.id)}`);
			if (version !== generation.current) return;
			setSelected(detail.meeting);
		} catch (error) {
			if (version === generation.current) setModalError((error as Error).message);
		} finally {
			if (version === generation.current) setModalLoading(false);
		}
	}
	async function syncAssignmentOptions() {
		if (syncingOptions) return;
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
	// Editing now offers the same room/class/people pickers as creating, prefilled from the
	// meeting's current assignment - there's no separate "assign" step/button anymore.
	async function openEdit(meeting: Meeting) {
		const version = ++generation.current;
		setSelected(null);
		setTitle(meeting.title);
		setScheduledAt(localDateTimeValue(new Date(meeting.scheduled_at)));
		setEndedAt(localDateTimeValue(meeting.ended_at ? new Date(meeting.ended_at) : defaultEndTime(new Date(meeting.scheduled_at))));
		setModalError('');
		setSyncNotice('');
		setPeopleSearch('');
		setPeople([]);
		setRoomId('');
		setTeacherId('');
		setClassId('');
		setClassRoster(null);
		setOptionsReady(false);
		setModal('edit');
		setModalLoading(true);
		try {
			const [detail, roomData, rosterData, classData] = await Promise.all([
				request<{ meeting: Meeting }>(`/${encodeURIComponent(meeting.id)}`),
				request<{ rooms: MeetingRoomOption[] }>('/rooms'),
				request<{ roster: MeetingRosterMember[] }>('/roster'),
				request<{ classes: MeetingClassOption[] }>('/classes')
			]);
			if (version !== generation.current) return;
			setSelected(detail.meeting);
			setTitle(detail.meeting.title);
			setScheduledAt(localDateTimeValue(new Date(detail.meeting.scheduled_at)));
			setEndedAt(
				localDateTimeValue(detail.meeting.ended_at ? new Date(detail.meeting.ended_at) : defaultEndTime(new Date(detail.meeting.scheduled_at)))
			);
			setRooms(roomData.rooms);
			setRoster(rosterData.roster);
			setClasses(classData.classes);
			const availablePeople = new Set(rosterData.roster.map((person) => person.mezon_id));
			setPeople(detail.meeting.participants.map((person) => person.mezon_id).filter((id) => availablePeople.has(id)));
			setRoomId(detail.meeting.room_id || '');
			setTeacherId(detail.meeting.user_id || '');
			setOptionsReady(true);
			// Prefill the class picker from what was saved last time, so re-saving without touching
			// it (e.g. only changing the title) doesn't silently clear the meeting's class_id.
			if (detail.meeting.class_id) {
				setClassId(detail.meeting.class_id);
				setClassLoading(true);
				try {
					const classRosterData = await request<{ roster: MeetingRosterMember[] }>(`/classes/${encodeURIComponent(detail.meeting.class_id)}`);
					if (version === generation.current) setClassRoster(classRosterData.roster);
				} catch {
					// Class may have been removed/renamed since - leave the dropdown on its saved
					// value with an empty roster; the admin can reselect a class to refresh it.
				} finally {
					if (version === generation.current) setClassLoading(false);
				}
			}
		} catch (error) {
			if (version === generation.current) setModalError((error as Error).message);
		} finally {
			if (version === generation.current) setModalLoading(false);
		}
	}
	// Create offers the same room/class/people pickers as editing, loaded up front instead of a
	// separate step right after.
	async function openCreate() {
		const version = ++generation.current;
		setSelected(null);
		setTitle('');
		setScheduledAt('');
		setEndedAt('');
		setModalError('');
		setSyncNotice('');
		setPeopleSearch('');
		setPeople([]);
		setRoomId('');
		setTeacherId('');
		setClassId('');
		setClassRoster(null);
		setOptionsReady(false);
		setModal('create');
		setModalLoading(true);
		try {
			const [roomData, rosterData, classData] = await Promise.all([
				request<{ rooms: MeetingRoomOption[] }>('/rooms'),
				request<{ roster: MeetingRosterMember[] }>('/roster'),
				request<{ classes: MeetingClassOption[] }>('/classes')
			]);
			if (version !== generation.current) return;
			setRooms(roomData.rooms);
			setRoster(rosterData.roster);
			setClasses(classData.classes);
			setOptionsReady(true);
		} catch (error) {
			if (version === generation.current) setModalError((error as Error).message);
		} finally {
			if (version === generation.current) setModalLoading(false);
		}
	}
	async function selectClass(channelId: string) {
		setClassId(channelId);
		setPeopleSearch('');
		if (!channelId) {
			setClassRoster(null);
			return;
		}
		const version = generation.current;
		setClassLoading(true);
		setClassRoster(null);
		try {
			const data = await request<{ roster: MeetingRosterMember[] }>(`/classes/${encodeURIComponent(channelId)}`);
			if (version !== generation.current) return;
			setClassRoster(data.roster);
			// Picking a class ticks its whole roster by default - the admin can still uncheck
			// individuals afterwards.
			setPeople(data.roster.map((p) => p.mezon_id));
		} catch (error) {
			if (version === generation.current) setModalError((error as Error).message);
		} finally {
			if (version === generation.current) setClassLoading(false);
		}
	}
	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setModalError('');
		try {
			if (modal === 'create' || modal === 'edit') {
				const result = await request<{ meeting: Meeting }>(selected ? `/${encodeURIComponent(selected.id)}` : '', {
					method: selected ? 'PATCH' : 'POST',
					body: JSON.stringify({ title: title.trim(), scheduled_at: new Date(scheduledAt).toISOString(), ended_at: new Date(endedAt).toISOString() })
				});
				// Editing always re-sends the full room/class/teacher/people assignment (so clearing
				// one of them actually clears it); creating only bothers if something was picked.
				if (modal === 'edit' || roomId || people.length || classId || teacherId) {
					await request(`/${encodeURIComponent(result.meeting.id)}/assign`, {
						method: 'POST',
						body: JSON.stringify({
							participants: roster.filter((p) => people.includes(p.mezon_id)),
							replace_participants: true,
							room_id: roomId,
							room_name: rooms.find((r) => r.room_id === roomId)?.room_name || (selected && roomId === selected.room_id ? selected.room_name : ''),
							class_id: classId,
							class_name: classes.find((c) => c.channel_id === classId)?.channel_name || (selected && classId === selected.class_id ? selected.class_name : ''),
							user_id: teacherId,
							user_name: roster.find((p) => p.mezon_id === teacherId)?.display_name || (selected && teacherId === selected.user_id ? selected.user_name : '')
						})
					});
				}
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
				<button className={`${primary} inline-flex items-center justify-center gap-2`} onClick={() => void openCreate()}>
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
												onClick={() => void openDetail(meeting)}
											>
												{meeting.title}
											</button>
											<p className='text-sm text-slate-500'>{formatMeetingTimeRange(meeting, locale)}</p>
											<p className='flex items-center gap-2 text-xs text-slate-500'>
												<Video className='h-4 w-4' />
												{meeting.room_name || t('meeting.noRoom')}
											</p>
											{meeting.class_name && (
												<p className='flex items-center gap-2 text-xs text-slate-500'>
													<GraduationCap className='h-4 w-4' />
													{meeting.class_name}
												</p>
											)}
											{meeting.user_name && (
												<p className='flex items-center gap-2 text-xs text-slate-500'>
													<User className='h-4 w-4' />
													{meeting.user_name}
												</p>
											)}
										</div>
										<div className='flex flex-wrap gap-2'>
											<button className={button} onClick={() => void openDetail(meeting)}>
												{t('meeting.details')}
											</button>
											<button className={button} onClick={() => void openEdit(meeting)}>
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
												onClick={() => void openDetail(meeting)}
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
					title={{ create: t('meeting.create'), edit: t('meeting.edit'), detail: t('meeting.details'), delete: t('meeting.delete') }[modal]}
					onClose={close}
					busy={busy}
					tall={modal === 'create' || modal === 'edit'}
					footer={
						modal !== 'detail' ? (
							<>
								{(modal === 'create' || modal === 'edit') && optionsReady && (
									<button
										type='button'
										className={`${button} mr-auto inline-flex items-center gap-2`}
										disabled={busy || syncingOptions}
										onClick={() => void syncAssignmentOptions()}
									>
										<RefreshCw className={`h-4 w-4 ${syncingOptions ? 'animate-spin' : ''}`} />
										{syncingOptions ? t('meeting.syncingClan') : t('meeting.syncClan')}
									</button>
								)}
								<button type='button' className={button} disabled={busy} onClick={close}>
									{t('meeting.cancel')}
								</button>
								<button
									type='submit'
									form='meeting-form'
									className={primary}
									disabled={
										busy || ((modal === 'create' || modal === 'edit') && (!optionsReady || !title.trim() || !scheduledAt || !endedAt))
									}
								>
									{busy ? t('meeting.saving') : modal === 'delete' ? t('meeting.delete') : t('meeting.save')}
								</button>
							</>
						) : undefined
					}
				>
					{modalError && (
						<p role='alert' className='rounded-xl bg-rose-50 p-3 text-sm text-rose-700'>
							{modalError}
						</p>
					)}
					{modalLoading && (modal === 'detail' || modal === 'edit' || modal === 'create') ? (
						<p role='status'>{t('meeting.loading')}</p>
					) : (
						<>
							{modal === 'detail' && selected && (
								<div className='space-y-4'>
									<h3 className='break-words font-bold'>{selected.title}</h3>
									<p className='text-sm'>{formatMeetingTimeRange(selected, locale)}</p>
									<p className='text-sm'>{t('meeting.room')}: {selected.room_name || t('meeting.noRoom')}</p>
									{selected.class_name && <p className='text-sm'>{t('meeting.class')}: {selected.class_name}</p>}
									{selected.user_name && <p className='text-sm'>{t('meeting.teacherInCharge')}: {selected.user_name}</p>}
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
								<form id='meeting-form' onSubmit={save} className='space-y-5'>
									{(modal === 'create' || modal === 'edit') && (
										<>
											<label className='block space-y-2 text-sm'>
											<span className='font-bold'>{t('meeting.meetingTitle')}</span>
												<input
													autoFocus
													required
													maxLength={200}
													className={input}
													placeholder={t('meeting.meetingTitlePlaceholder')}
													value={title}
													onChange={(e) => setTitle(e.target.value)}
													disabled={busy}
												/>
											</label>
											<div className='space-y-2'>
												<p className='flex items-center gap-2 text-sm font-bold'><CalendarDays className='h-4 w-4 text-purple-600' />{t('meeting.schedule')}</p>
												<MeetingSchedulePicker startValue={scheduledAt} endValue={endedAt} onChange={handleScheduleChange} disabled={busy} />
											</div>
										</>
									)}
									{(modal === 'create' || modal === 'edit') && optionsReady && (
										<>
											{syncNotice && <p role='status' className='text-xs text-emerald-700'>{syncNotice}</p>}
											<label className='block space-y-2 text-sm'>
												<span className='font-bold'>{t('meeting.room')}</span>
												<div className='relative'>
													<select className={`${input} appearance-none pr-11`} value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={busy}>
														<option value=''>{t('meeting.noRoom')}</option>
														{selected?.room_id && !rooms.some((r) => r.room_id === selected.room_id) && (
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
											<label className='block space-y-2 text-sm'>
												<span className='font-bold'>{t('meeting.teacherInCharge')}</span>
												<div className='relative'>
													<select className={`${input} appearance-none pr-11`} value={teacherId} onChange={(e) => setTeacherId(e.target.value)} disabled={busy}>
														<option value=''>{t('meeting.noTeacher')}</option>
														{selected?.user_id && !roster.some((p) => p.mezon_id === selected.user_id) && (
															<option value={selected.user_id}>{selected.user_name || selected.user_id}</option>
														)}
														{roster
															.filter((p) => p.role === 'teacher')
															.map((p) => (
																<option key={p.mezon_id} value={p.mezon_id}>
																	{p.display_name}
																</option>
															))}
													</select>
													<ChevronDown aria-hidden className='pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-700' />
												</div>
											</label>
											<label className='block space-y-2 text-sm'>
												<span className='font-bold'>{t('meeting.classFieldLabel')}</span>
												<div className='relative'>
													<select
														className={`${input} appearance-none pr-11`}
														value={classId}
														onChange={(e) => void selectClass(e.target.value)}
														disabled={busy || classLoading}
													>
														<option value=''>{t('meeting.allPeople')}</option>
														{classes.map((c) => (
															<option key={c.channel_id} value={c.channel_id}>
																{c.channel_name}
															</option>
														))}
													</select>
													<ChevronDown aria-hidden className='pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-700' />
												</div>
											</label>
											<p className='text-xs text-slate-500'>{t('meeting.classHint')}</p>
											<fieldset disabled={busy || classLoading} className='space-y-3'>
												<legend className='text-sm font-bold'>{t('meeting.participants', { count: people.length })} · {t('meeting.selected', { count: people.length })}</legend>
												<input
													aria-label={t('meeting.searchPeople')}
													className={input}
													placeholder={t('meeting.searchPeople')}
													value={peopleSearch}
													onChange={(e) => setPeopleSearch(e.target.value)}
												/>
												{classLoading ? (
													<p className='text-xs text-slate-500'>{t('meeting.loadingClass')}</p>
												) : (
												<div className='max-h-64 overflow-y-auto space-y-2'>
													{(classId ? classRoster || [] : roster)
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
												)}
												{!classLoading && !(classId ? classRoster || [] : roster).length && (
													<p className='text-xs text-slate-500'>{t('meeting.noSyncedPeople')}</p>
												)}
											</fieldset>
										</>
									)}
									{modal === 'delete' && (
										<p className='text-sm'>{t('meeting.deleteConfirmation', { title: selected?.title || '' })}</p>
									)}
								</form>
							)}
						</>
					)}
				</Modal>
			)}
		</div>
	);
}
