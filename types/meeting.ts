export type MeetingParticipantRole = 'student' | 'teacher';

export interface MeetingParticipant {
	mezon_id: string;
	username?: string;
	display_name: string;
	avatar_url?: string;
	role?: MeetingParticipantRole;
	joined_at?: string;
}

export interface Meeting {
	id: string;
	title: string;
	scheduled_at: string;
	room_id?: string;
	room_name?: string;
	created_by: string;
	created_at: string;
	participant_count: number;
	// List views only include a preview (first 10); the detail endpoint returns everyone.
	participants: MeetingParticipant[];
}

// Cached from the Mezon clan bot sync (Person B's job) so the assign UI (Person A) has
// something to select from independent of when the sync automation is finished.
export interface MeetingRoomOption {
	room_id: string;
	room_name: string;
	clan_id: string;
	synced_at: string;
}

export interface MeetingRosterMember {
	mezon_id: string;
	username?: string;
	display_name: string;
	avatar_url?: string;
	role: MeetingParticipantRole;
	clan_id: string;
	synced_at: string;
}
