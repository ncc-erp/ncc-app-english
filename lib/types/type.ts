export interface ClassroomItem {
	id: string;
	name: string;
	category_id?: string;
	category_name?: string;
	student_count?: number;
	is_private?: boolean;
}

export interface StudentItem {
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

export interface OverallStats {
	total_attempts: number;
	average_band: number | null;
}

export enum E_SORT_STUDENT_SCORE {
	BAND = 'band',
	SCORE = 'score',
	ATTEMPTS = 'attempts',
	LASTEST = 'latest'
}
