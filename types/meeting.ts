export type MeetingParticipantRole = 'student' | 'teacher';

export interface MeetingParticipant {
	mezon_id: string;
	username?: string;
	display_name: string;
	avatar_url?: string;
	role?: MeetingParticipantRole;
	joined_at?: string;
	// Most recent time this participant left the meeting's voice room (onVoiceLeavedEvent).
	end_at?: string;
}

export interface Meeting {
	id: string;
	title: string;
	scheduled_at: string;
	// Optional (backfilled) - meetings created before this field existed have no end time.
	ended_at?: string;
	room_id?: string;
	room_name?: string;
	class_id?: string;
	class_name?: string;
	// The teacher in charge (their Mezon user id) - separate from meeting_participants (the roster shown up).
	user_id?: string;
	user_name?: string;
	created_by: string;
	// Display name of created_by, resolved from users; absent if that user row no longer exists.
	created_by_name?: string;
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

// A text channel ("Lớp cơ bản", "Lớp nâng cao", ...) the assign UI can filter the people list by.
export interface MeetingClassOption {
	channel_id: string;
	channel_name: string;
	category_name?: string;
}
