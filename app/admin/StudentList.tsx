'use client';

import { ClassroomItem, E_SORT_STUDENT_SCORE, StudentItem } from '@/lib/types/type';
import { Calendar, Eye, GraduationCap, Loader2, Mic, Users } from 'lucide-react';
import { memo, useMemo } from 'react';

interface StudentListProps {
	students: StudentItem[];
	loading: boolean;
	searchQuery: string;
	onSelectStudent: (studentId: string) => void;
	onViewAllClasses?: () => void;
	sortBy: E_SORT_STUDENT_SCORE;
	classId: string | null;
	currentClass: ClassroomItem | undefined;
}

export function StudentList({ students, loading, searchQuery, onSelectStudent, onViewAllClasses, sortBy, classId, currentClass }: StudentListProps) {
	const studentsFilter = useMemo(() => {
		let filterStudents = students;
		if (classId) {
			filterStudents = filterStudents.filter((s) => s.class_ids?.includes(classId));
		}
		if (searchQuery) {
			filterStudents = filterStudents.filter((s) => {
				const q = searchQuery.toLowerCase().trim();
				if (!q) return true;
				return s.display_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q) || s.mezon_id.toLowerCase().includes(q);
			});
		}
		if (sortBy) {
			filterStudents = filterStudents.sort((a, b) => {
				if (sortBy === E_SORT_STUDENT_SCORE.HIGHEST) {
					return (b.average_speaking_band || 0) - (a.average_speaking_band || 0);
				}
				if (sortBy === E_SORT_STUDENT_SCORE.LOWEST) {
					return (a.average_speaking_band || 0) - (b.average_speaking_band || 0);
				}
				if (sortBy === E_SORT_STUDENT_SCORE.LASTEST) {
					const dateA = a.latest_attempt_at ? new Date(a.latest_attempt_at).getTime() : 0;
					const dateB = b.latest_attempt_at ? new Date(b.latest_attempt_at).getTime() : 0;
					return dateB - dateA;
				}

				return b.total_speaking_attempts - a.total_speaking_attempts;
			});
		}

		return filterStudents;
	}, [searchQuery, sortBy, students, classId]);

	const formatRelativeTime = (dateStr: string | null) => {
		if (!dateStr) return 'Never';
		const diffMs = Date.now() - new Date(dateStr).getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'Just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHour = Math.floor(diffMin / 60);
		if (diffHour < 24) return `${diffHour}h ago`;
		const diffDay = Math.floor(diffHour / 24);
		if (diffDay < 30) return `${diffDay}d ago`;
		const diffMonth = Math.floor(diffDay / 30);
		if (diffMonth < 12) return `${diffMonth}mo ago`;
		return `${Math.floor(diffMonth / 12)}y ago`;
	};

	const getBandBadgeColor = (band?: number | null) => {
		if (!band) return 'bg-slate-100 text-slate-500 border-slate-200';
		if (band >= 7.5) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
		if (band >= 6.5) return 'bg-indigo-50 text-indigo-700 border-indigo-300';
		if (band >= 5.5) return 'bg-purple-50 text-purple-700 border-purple-300';
		if (band >= 4.5) return 'bg-amber-50 text-amber-700 border-amber-300';
		return 'bg-rose-50 text-rose-700 border-rose-300';
	};
	return (
		<div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4'>
			

			{loading ? (
				<div className='py-16 text-center text-xs text-slate-500 flex items-center justify-center gap-2'>
					<Loader2 className='w-5 h-5 animate-spin text-purple-600' />
					<span>Loading students list...</span>
				</div>
			) : students.length === 0 ? (
				<div className='py-16 text-center space-y-3'>
					<Users className='w-10 h-10 text-slate-300 mx-auto' />

					<div className='text-sm font-bold text-slate-700'>No Students Found</div>

					<p className='text-xs text-slate-500 max-w-sm mx-auto'>
						{searchQuery
							? 'No students match your search criteria.'
							: classId
								? 'No users with role "Student" found in the clan.'
								: `No students with role "Student" found in ${currentClass?.name || 'this classroom'}.`}
					</p>

					{onViewAllClasses && (
						<button
							onClick={onViewAllClasses}
							className='px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm'
						>
							View All Classrooms
						</button>
					)}
				</div>
			) : (
				<div className='space-y-3'>
					{studentsFilter.map((student) => (
						<StudentListItem
							key={student.mezon_id}
							onSelectStudent={onSelectStudent}
							student={student}
							band={getBandBadgeColor(student.average_speaking_band)}
							last_attempt={formatRelativeTime(student.latest_attempt_at)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface StudentListItemProps {
	student: StudentItem;
	onSelectStudent: (studentId: string) => void;
	band?: string;
	last_attempt?: string;
}

export const StudentListItem = memo(function StudentListItem({ last_attempt, student, onSelectStudent, band }: StudentListItemProps) {
	const handleSelect = () => {
		onSelectStudent(student.mezon_id);
	};

	return (
		<div
			onClick={handleSelect}
			className='p-4 bg-slate-50/70 hover:bg-purple-50/40 border border-slate-200 hover:border-purple-300 rounded-2xl transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 group'
		>
			{/* Student info */}
			<div className='flex items-center space-x-3.5'>
				<div className='w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-purple-200 shadow-sm'>
					{student.avatar_url ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={student.avatar_url} alt={student.display_name} className='w-full h-full object-cover' />
					) : (
						student.display_name[0]?.toUpperCase()
					)}
				</div>

				<div className='space-y-0.5'>
					<div className='flex items-center gap-2'>
						<span className='text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors'>{student.display_name}</span>

						<span className='px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200'>Student</span>
					</div>

					<div className='text-xs text-slate-500 font-mono'>
						@{student.username} • ID: {student.mezon_id}
					</div>
				</div>
			</div>

			{/* Stats */}
			<div className='flex items-center justify-between 2xl:justify-end gap-3 sm:gap-4 shrink-0 pt-2 2xl:pt-0 border-t 2xl:border-t-0 border-slate-200/60'>
				<div className='text-left 2xl:text-right'>
					<div className='text-[10px] text-slate-400 font-medium'>Tests Taken</div>

					<div className='text-xs font-black text-slate-900 flex items-center gap-1'>
						<Mic className='w-3 h-3 text-purple-600' />
						{student.total_speaking_attempts} {student.total_speaking_attempts === 1 ? 'test' : 'tests'}
					</div>
				</div>
				<div className='text-left 2xl:text-right'>
					<div className='text-[10px] text-slate-400 font-medium'>Last Exam</div>
					<div
						className='text-xs font-black text-slate-900 flex items-center gap-1'
						title={student.latest_attempt_at ? new Date(student.latest_attempt_at).toLocaleString() : undefined}
					>
						<Calendar className='w-3 h-3 text-purple-600' />
						<span>{last_attempt}</span>
					</div>
				</div>
				<div className='text-left 2xl:text-right'>
					<div className='text-[10px] text-slate-400 font-medium'>Average Band</div>

					<div className={`px-2.5 py-0.5 rounded-lg border font-black text-xs inline-block ${band}`}>
						{student.average_speaking_band ? `Band ${student.average_speaking_band}` : 'N/A'}
					</div>
				</div>

				<button
					type='button'
					onClick={(event) => {
						event.stopPropagation();
						onSelectStudent(student.mezon_id);
					}}
					className='px-3.5 py-2 bg-purple-600 group-hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-purple-200 flex items-center gap-1.5 transition-all shrink-0'
				>
					<Eye className='w-3.5 h-3.5' />
					<span className='hidden sm:inline'>Details</span>
				</button>
			</div>
		</div>
	);
});