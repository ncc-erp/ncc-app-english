'use client';

import { useState, useEffect } from 'react';
import { useAdminSidebarVisible } from '@/components/admin/AdminAuthContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { StudentDetailModal } from '@/components/admin/StudentDetailModal';
import {
	ShieldAlert,
	Search,
	Sparkles,
	Users,
	Mic,
	Award,
	Layers,
	ChevronRight,
	Loader2,
	RefreshCw,
	GraduationCap,
	School,
	CheckCircle2,
	AlertCircle,
	Lock
} from 'lucide-react';
import { E_SORT_STUDENT_SCORE } from '@/lib/types/type';
import { StudentList } from './StudentList';

interface ClassroomItem {
	id: string;
	name: string;
	category_id?: string;
	category_name?: string;
	student_count?: number;
	is_private?: boolean;
}

interface StudentItem {
	mezon_id: string;
	username: string;
	display_name: string;
	avatar_url?: string;
	clan_nick?: string;
	class_ids?: string[];
	total_speaking_attempts: number;
	average_speaking_band: number | null;
	highest_speaking_band: number | null;
	latest_attempt_at: string | null;
}

interface OverallStats {
	total_attempts: number;
	average_band: number | null;
}

export default function AdminClassesPage() {
	const { t } = useTranslation();

	const [authLoading, setAuthLoading] = useState(true);
	const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
	const [verificationError, setVerificationError] = useState(false);

	// Hide the shared sidebar unless we're still checking or the user actually has Clan Admin permission
	useAdminSidebarVisible(authLoading || isAuthorizedAdmin);

	const [classes, setClasses] = useState<ClassroomItem[]>([]);
	const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
	const [allStudents, setAllStudents] = useState<StudentItem[]>([]);

	const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [sortBy, setSortBy] = useState<E_SORT_STUDENT_SCORE>(E_SORT_STUDENT_SCORE.ATTEMPTS);

	const [loadingClasses, setLoadingClasses] = useState(true);
	const [loadingStudents, setLoadingStudents] = useState(true);
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncNotification, setSyncNotification] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);

	// Selected student for detail evaluation modal
	const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

	// 1. Verify Clan Admin Authorization (session itself is already verified by the /admin layout)
	useEffect(() => {
		async function checkPermission() {
			setAuthLoading(true);
			setVerificationError(false);
			await fetchClassesData();
			setAuthLoading(false);
		}
		checkPermission();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 2. Fetch Classrooms from Category "LỚP HỌC"
	const fetchClassesData = async (forceRefresh: boolean = false) => {
		try {
			setLoadingClasses(true);
			const url = forceRefresh ? `/api/admin/classes?refresh=true&t=${Date.now()}` : `/api/admin/classes?t=${Date.now()}`;
			const res = await fetch(url, { cache: 'no-store' });
			if (res.status === 503) {
				setVerificationError(true);
				return [];
			}
			const data = await res.json();

			if (res.ok && data.success) {
				setIsAuthorizedAdmin(true);
				setClasses(data.classes || []);
				setOverallStats(data.overallStats || null);
				fetchStudentsData(forceRefresh);
				return data.classes;
			} else {
				setIsAuthorizedAdmin(false);
				return [];
			}
		} catch (err) {
			console.error('Fetch classes error:', err);
			setVerificationError(true);
			return [];
		} finally {
			setLoadingClasses(false);
		}
	};

	// 3. Fetch Students with role = "Student"
	const fetchStudentsData = async (forceRefresh: boolean = false) => {
		try {
			setLoadingStudents(true);
			const params = new URLSearchParams();
			if (forceRefresh) {
				params.set('refresh', 'true');
			}
			params.set('t', String(Date.now()));

			const url = `/api/admin/students?${params.toString()}`;
			const res = await fetch(url, { cache: 'no-store' });
			const data = await res.json();

			if (res.ok && data.success) {
				setAllStudents(data.students || []);
				return data.students;
			}
			return [];
		} catch (err) {
			console.error('Fetch students error:', err);
			return [];
		} finally {
			setLoadingStudents(false);
		}
	};

	// 4. Force Sync Clan Data Directly from Mezon
	const handleSyncClan = async () => {
		if (isSyncing) return;
		try {
			setIsSyncing(true);
			setSyncNotification(null);

			const [updatedClasses, updatedStudents] = await Promise.all([fetchClassesData(true), fetchStudentsData(true)]);

			const classCount = updatedClasses?.length || 0;
			const studentCount = updatedStudents?.length || 0;

			setSyncNotification({
				type: 'success',
				text: `Clan data synchronized successfully! Loaded ${classCount} classrooms from Category "LỚP HỌC" and ${studentCount} students with role "Student".`
			});

			setTimeout(() => {
				setSyncNotification(null);
			}, 6000);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			console.error('Sync Clan error:', err);
			setSyncNotification({
				type: 'error',
				text: err?.message || 'An error occurred while synchronizing data from Mezon Clan.'
			});
		} finally {
			setIsSyncing(false);
		}
	};

	const handleSelectClass = (classId: string | null) => {
		setSelectedClassId(classId);
	};

	// 1. Filter by Classroom
	const classFilteredStudents = selectedClassId === null ? allStudents : allStudents.filter((s) => s.class_ids?.includes(selectedClassId));

	// Helper to compute stats (Total tests & Average test score) for a list of students
	const getClassStats = (studentsList: StudentItem[]) => {
		const totalStudents = studentsList.length;
		const totalTests = studentsList.reduce((acc, s) => acc + (s.total_speaking_attempts || 0), 0);

		const studentsWithBand = studentsList.filter((s) => s.average_speaking_band !== null && s.average_speaking_band > 0);

		let totalWeightedScore = 0;
		let totalWeightedTests = 0;

		studentsWithBand.forEach((s) => {
			const attempts = s.total_speaking_attempts || 1;
			totalWeightedScore += s.average_speaking_band! * attempts;
			totalWeightedTests += attempts;
		});

		const averageBand = totalWeightedTests > 0 ? Math.round((totalWeightedScore / totalWeightedTests) * 10) / 10 : null;

		return { totalStudents, totalTests, averageBand };
	};

	const activeClassStats = selectedClassId
		? getClassStats(classFilteredStudents)
		: {
				totalStudents: allStudents.length,
				totalTests: overallStats?.total_attempts ?? getClassStats(allStudents).totalTests,
				averageBand: overallStats?.average_band ?? getClassStats(allStudents).averageBand
			};

	// 2. Filter by Search Query
	const searchFilteredStudents = classFilteredStudents.filter((s) => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return true;
		return s.display_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q) || s.mezon_id.toLowerCase().includes(q);
	});

	if (authLoading) {
		return (
			<div className='flex items-center justify-center py-24'>
				<div className='flex items-center space-x-3'>
					<Loader2 className='w-6 h-6 animate-spin text-purple-600' />
					<span className='text-sm font-medium text-slate-600'>{t('common.adminAccess.verifyingClan')}</span>
				</div>
			</div>
		);
	}

	if (verificationError) {
		return (
			<div className='bg-white border border-slate-200 rounded-3xl p-8 max-w-md mx-auto text-center space-y-4'>
				<AlertCircle className='w-8 h-8 text-amber-600 mx-auto' />
				<h1 className='text-xl font-bold'>{t('common.adminAccess.verificationUnavailableTitle')}</h1>
				<p role='alert' className='text-sm text-slate-600'>
					{t('common.adminAccess.verificationUnavailableMessage')}
				</p>
				<button onClick={() => window.location.reload()} className='w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl'>
					{t('common.adminAccess.retry')}
				</button>
			</div>
		);
	}

	if (!isAuthorizedAdmin) {
		return (
			<div className='bg-white border border-slate-200 rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 shadow-xl'>
				<div className='w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200'>
					<ShieldAlert className='w-7 h-7' />
				</div>
				<h1 className='text-xl font-bold text-slate-900'>{t('common.adminAccess.accessDeniedTitle')}</h1>
				<p className='text-xs text-slate-600 leading-relaxed'>{t('common.adminAccess.classesDeniedMessage')}</p>
			</div>
		);
	}

	const currentClass = classes.find((c) => c.id === selectedClassId);

	return (
		<>
			<div className='space-y-7'>
				{/* Header & Portal Tabs */}
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
						<h1 className='text-2xl md:text-3xl font-extrabold text-slate-900'>Classrooms & Students Management</h1>
						<p className='text-xs text-slate-600 max-w-2xl leading-relaxed'>
							Monitor classrooms from Category "LỚP HỌC", students with role "Student", and review detailed IELTS Speaking test performance.
						</p>
					</div>

					<div className='flex items-center gap-2.5 shrink-0'>
						<button
							onClick={handleSyncClan}
							disabled={isSyncing}
							className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
								isSyncing
									? 'bg-purple-100 text-purple-700 cursor-not-allowed border border-purple-200'
									: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:border-purple-300'
							}`}
							title='Fetch latest live data directly from Mezon Clan'
						>
							<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-purple-600' : ''}`} />
							<span>{isSyncing ? 'Syncing...' : 'Sync Clan'}</span>
						</button>
					</div>
				</div>

				{/* Sync Notification Banner */}
				{syncNotification && (
					<div
						className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 border shadow-sm transition-all animate-in fade-in ${
							syncNotification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
						}`}
					>
						<div className='flex items-center gap-2.5'>
							{syncNotification.type === 'success' ? (
								<CheckCircle2 className='w-4 h-4 text-emerald-600 shrink-0' />
							) : (
								<AlertCircle className='w-4 h-4 text-rose-600 shrink-0' />
							)}
							<span className='font-medium leading-relaxed'>{syncNotification.text}</span>
						</div>
						<button
							onClick={() => setSyncNotification(null)}
							className='px-2 py-1 text-xs font-bold hover:underline opacity-70 hover:opacity-100 shrink-0'
						>
							Dismiss
						</button>
					</div>
				)}

				{/* Global Speaking Stats Row */}
				<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
					<div className='bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm'>
						<div className='w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100'>
							<School className='w-5 h-5' />
						</div>
						<div>
							<div className='text-xs text-slate-500 font-medium'>Classrooms (Category LỚP HỌC)</div>
							<div className='text-2xl font-extrabold text-slate-900'>{classes.length}</div>
						</div>
					</div>

					<div className='bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm'>
						<div className='w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100'>
							<Users className='w-5 h-5' />
						</div>
						<div>
							<div className='text-xs text-slate-500 font-medium'>Students (Role: Student)</div>
							<div className='text-2xl font-extrabold text-slate-900'>{allStudents.length}</div>
						</div>
					</div>

					<div className='bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm'>
						<div className='w-11 h-11 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center shrink-0 border border-pink-100'>
							<Mic className='w-5 h-5' />
						</div>
						<div>
							<div className='text-xs text-slate-500 font-medium'>Total Speaking Tests(Submitted)</div>
							<div className='text-2xl font-extrabold text-slate-900'>{overallStats?.total_attempts ?? 0}</div>
						</div>
					</div>

					<div className='bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm'>
						<div className='w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100'>
							<Award className='w-5 h-5' />
						</div>
						<div>
							<div className='text-xs text-slate-500 font-medium'>Average Speaking Band</div>
							<div className='text-2xl font-extrabold text-emerald-700'>
								{overallStats?.average_band ? `Band ${overallStats.average_band}` : 'N/A'}
							</div>
						</div>
					</div>
				</div>

				{/* Main 2-Column Content Layout */}
				<div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'>
					{/* Left Column: Classrooms List (Category "LỚP HỌC") */}
					<div className='lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm'>
						<div className='flex items-center justify-between pb-3 border-b border-slate-100'>
							<div className='flex items-center gap-2'>
								<School className='w-4 h-4 text-purple-600' />
								<h2 className='text-sm font-extrabold text-slate-900'>Classrooms</h2>
							</div>
							<span className='text-[11px] font-bold text-slate-400'>
								{classes.length} {classes.length === 1 ? 'class' : 'classes'}
							</span>
						</div>

						{loadingClasses ? (
							<div className='py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2'>
								<Loader2 className='w-4 h-4 animate-spin text-purple-600' />
								<span>Scanning clan channels...</span>
							</div>
						) : (
							<div className='space-y-2'>
								{/* All Classes Button */}
								<button
									onClick={() => handleSelectClass(null)}
									className={`w-full text-left p-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-between ${
										selectedClassId === null
											? 'bg-purple-600 text-white shadow-md shadow-purple-200'
											: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
									}`}
								>
									<div className='flex items-center gap-2.5'>
										<Layers className='w-4 h-4' />
										<span>All Classrooms</span>
									</div>
									<span
										className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
											selectedClassId === null ? 'bg-purple-800/80 text-white' : 'bg-slate-200 text-slate-700'
										}`}
									>
										{allStudents.length} {allStudents.length === 1 ? 'student' : 'students'}
									</span>
								</button>

								{/* Individual Classroom Channels */}
								{classes.map((cls) => {
									const isSelected = selectedClassId === cls.id;
									const classStudents = allStudents.filter((s) => s.class_ids?.includes(cls.id));
									const count = classStudents.length;
									const clsStats = getClassStats(classStudents);

									return (
										<button
											key={cls.id}
											onClick={() => handleSelectClass(cls.id)}
											className={`w-full text-left p-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-between ${
												isSelected
													? 'bg-purple-600 text-white shadow-md shadow-purple-200'
													: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
											}`}
										>
											<div className='space-y-0.5 truncate pr-2'>
												<div className='flex items-center gap-1.5 truncate'>
													{cls.is_private && <Lock className={`w-3 h-3 shrink-0 ${isSelected ? 'text-amber-300' : 'text-amber-500'}`} />}
													<span className='truncate'>{cls.name}</span>
												</div>
												<div className={`text-[10px] font-normal truncate ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>#{cls.id}</div>
											</div>
											<div className='flex items-center gap-2 shrink-0'>
												<span
													className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
														isSelected ? 'bg-purple-800/80 text-white' : 'bg-slate-200 text-slate-700'
													}`}
												>
													{count}
												</span>
												<ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'rotate-90 text-white' : 'text-slate-400'}`} />
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>

					{/* Right Column: Students List & Evaluation Summary */}
					<div className='lg:col-span-8 space-y-4'>
						{/* Filter & Search Bar */}
						<div className='bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4'>
							<div className='relative w-full md:w-80'>
								<Search className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2' />
								<input
									type='text'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder='Search students by name, username, or ID...'
									className='w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white'
								/>
							</div>

							<div className='flex items-center gap-3 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap'>
								{/* Sort By Dropdown */}
								<div className='flex items-center gap-1.5 w-full sm:w-auto'>
									<span className='text-[11px] font-bold text-slate-500 shrink-0'>Sort by:</span>
									<select
										value={sortBy}
										onChange={(e) => setSortBy(e.target.value as E_SORT_STUDENT_SCORE)}
										className='w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500'
									>
										<option value={E_SORT_STUDENT_SCORE.ATTEMPTS}>Most Tests Taken</option>
										<option value={E_SORT_STUDENT_SCORE.HIGHEST}>Highest Average Band</option>
										<option value={E_SORT_STUDENT_SCORE.LOWEST}>Lowest Average Band</option>
										<option value={E_SORT_STUDENT_SCORE.LASTEST}>Most Recent Attempt</option>
									</select>
								</div>
							</div>
						</div>

						{/* Statistical information line: Total test, average test score of the class */}
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-purple-50/80 border border-purple-200 rounded-2xl text-xs shadow-sm animate-in fade-in'>
							<div className='flex items-center gap-2.5 flex-wrap'>
								<div className='w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200'>
									<School className='w-4 h-4' />
								</div>
								<div>
									<div className='flex items-center gap-2'>
										<span className='font-extrabold text-slate-900 text-xs'>
											{selectedClassId === null ? 'All Classrooms ' : currentClass?.name || 'Classroom'}
										</span>
										{selectedClassId !== null && currentClass?.is_private && (
											<span className='px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-800 font-bold flex items-center gap-0.5'>
												<Lock className='w-2.5 h-2.5' />
												Private
											</span>
										)}
									</div>
									<div className='text-[11px] text-slate-500 font-medium'>
										Students: <strong className='text-slate-800'>{activeClassStats.totalStudents}</strong>
									</div>
								</div>
							</div>

							<div className='flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap border-t sm:border-t-0 pt-2 sm:pt-0 border-purple-100'>
								<div className='flex items-center gap-1.5'>
									<Mic className='w-3.5 h-3.5 text-pink-600' />
									<span className='text-slate-500 font-medium'>Total test:</span>
									<span className='font-black text-slate-900 text-xs'>{activeClassStats.totalTests}</span>
								</div>

								<div className='h-4 w-[1px] bg-purple-200 hidden sm:block' />

								<div className='flex items-center gap-1.5'>
									<Award className='w-3.5 h-3.5 text-emerald-600' />
									<span className='text-slate-500 font-medium'>Average test score:</span>
									<span className='font-black text-emerald-700 text-xs'>
										{activeClassStats.averageBand !== null ? `Band ${activeClassStats.averageBand}` : 'N/A'}
									</span>
								</div>
							</div>
						</div>

						{/* Students Table / List */}
						<div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4'>
							<div className='flex items-center justify-between border-b border-slate-100 pb-4'>
								<div>
									<h3 className='text-base font-extrabold text-slate-900 flex items-center gap-2'>
										<GraduationCap className='w-4 h-4 text-purple-600' />
										<span>{selectedClassId ? `Students: ${currentClass?.name || 'Classroom'}` : 'All Students (Role: Student)'}</span>
									</h3>
									<p className='text-xs text-slate-500'>
										Click on any student to inspect test attempts, average band score, and detailed IELTS Speaking evaluations.
									</p>
								</div>

								<span className='px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200'>
									{searchFilteredStudents.length} {searchFilteredStudents.length === 1 ? 'student' : 'students'}
								</span>
							</div>

							<StudentList
								currentClass={currentClass}
								onSelectStudent={setSelectedStudentId}
								classId={selectedClassId}
								onViewAllClasses={() => handleSelectClass(null)}
								sortBy={sortBy}
								searchQuery={searchQuery}
								loading={loadingStudents}
								students={allStudents}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Student Detail Evaluation Modal */}
			{selectedStudentId && <StudentDetailModal studentId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />}
		</>
	);
}
