export const examEn = {
	intro: {
		startError: 'Failed to start exam. Please try again.',
		networkError: 'Network error while starting exam.',
		candidateBadge: 'Candidate: @{{username}}',
		assessmentBadge: 'Assessment Overview',
		title: 'English Placement Test',
		subtitle: 'Answer 2 multiple-choice questions to evaluate your English grammar, vocabulary, and reading skills.',
		specQuestions: 'Questions',
		specQuestionsValue: '2 MCQ',
		specDuration: 'Duration',
		specDurationValue: '15 Mins',
		specScoring: 'Scoring',
		specScoringValue: 'CEFR A1–C2',
		rulesTitle: 'Guidelines & Anti-Cheat',
		rules: [
			'Each question has 4 options with exactly 1 correct answer.',
			'You can navigate back and forth between questions before submitting.',
			'Your progress is saved automatically. If you refresh, you can resume.',
			'Calculators or dictionary tools are prohibited.'
		],
		begin: 'Begin Placement Test'
	},
	active: {
		loadError: 'Failed to load attempt.',
		networkError: 'Network error loading exam.',
		loading: 'Loading Exam...',
		loadingErrorTitle: 'Exam Loading Error',
		noQuestionsFound: 'No questions found.',
		returnToIntro: 'Return to Exam Intro',
		previous: 'Previous',
		submitExam: 'Submit Exam',
		next: 'Next',
		answerProgress: 'Answer Progress',
		answeredCount: '{{count}} / {{total}} Answered',
		submitError: 'Failed to submit exam.',
		submitNetworkError: 'Network error while submitting.',
		modalTitle: 'Ready to Submit?',
		modalBody: 'You have answered {{count}} out of {{total}} questions.',
		modalWarning: '⚠️ Unanswered questions will be scored as incorrect.',
		confirmSubmit: 'Confirm & Submit'
	},
	result: {
		loadError: 'Failed to load result.',
		networkError: 'Network error loading result.',
		calculating: 'Calculating Your Results...',
		resultErrorTitle: 'Result Error',
		resultNotFound: 'Result not found.',
		backToIntro: 'Back to Exam Intro',
		retake: 'Retake Placement Exam',
		defaultLevelTitle: 'Intermediate',
		defaultLevelDescription: 'Can handle everyday conversational topics.'
	},
	progressBar: {
		label: 'Question {{current}} of {{total}}'
	},
	questionCard: {
		readingPassage: 'Reading Passage'
	},
	partialScore: {
		cefrAssessed: 'CEFR Assessed',
		yourLevel: 'Your Level:',
		accuracyScore: 'Accuracy Score:'
	},
	lockedTeaser: {
		title: 'Full Skill Analysis & Action Plan',
		subtitle: 'Locked until you join the Mezon Clan',
		badge: 'Gated Report',
		unlockFree: 'Unlock 100% Free',
		description: 'Join our Mezon Clan community to reveal your exact section breakdown, skill weaknesses, and downloadable certificate!',
		instantUnlock: 'Instant Unlock',
		zeroSpam: 'Zero Spam'
	},
	fullReport: {
		unlockedBanner: 'Full Report Unlocked!',
		unlockedThanks: 'Thank you for joining the Mezon English Clan community.',
		scoreBreakdown: 'Score Breakdown',
		rawScore: 'Raw Score',
		weightedScore: 'Weighted Score',
		proficiencyRank: 'Proficiency Rank',
		proficiencyRankValue: 'Top 15%',
		sectionMastery: 'Section Mastery',
		keyFocusAreas: 'Key Focus Areas',
		noWeaknesses: 'No major weaknesses identified! Excellent overall mastery.',
		actionPlan: '7-Day Action Plan',
		certificateTitle: 'Verified CEFR Level Certificate',
		certificateSubtitle: 'Download your official PDF completion badge to share or print.',
		downloadCertificate: 'Download Certificate',
		certificateAlert: 'Certificate download feature generated for your level!'
	},
	clanJoinCTA: {
		invalidJsonError: 'Membership verification returned invalid JSON ({{status}})',
		verifyFailedError: 'Membership verification failed ({{status}})',
		verifySuccess: '🎉 Mezon Clan membership verified successfully! Full report unlocked.',
		notMemberYet: 'We could not confirm your clan membership yet. Please join the clan and try again.',
		networkError: 'Network error. Please try verifying again.',
		exclusiveUnlock: 'Exclusive Unlock',
		joinClan: 'Join Mezon English Clan',
		description:
			'Connect with 5,000+ English learners, access weekly quizzes, practice speaking in channels, and immediately unlock your full exam breakdown!',
		joinClanButton: 'Join Clan on Mezon',
		checkingMembership: 'Checking Membership...',
		verifyNow: "I've Joined — Verify Now",
		footerPrefix: 'Join clan and type',
		footerSuffix: 'to view score report',
		freeForever: '100% Free Forever'
	}
};

export const examVi = {
	intro: {
		startError: 'Không thể bắt đầu bài thi. Vui lòng thử lại.',
		networkError: 'Lỗi kết nối khi bắt đầu bài thi.',
		candidateBadge: 'Thí sinh: @{{username}}',
		assessmentBadge: 'Tổng quan bài đánh giá',
		title: 'Bài kiểm tra xếp lớp tiếng Anh',
		subtitle: 'Trả lời 2 câu hỏi trắc nghiệm để đánh giá ngữ pháp, từ vựng và kỹ năng đọc hiểu tiếng Anh của bạn.',
		specQuestions: 'Số câu hỏi',
		specQuestionsValue: '2 câu trắc nghiệm',
		specDuration: 'Thời gian',
		specDurationValue: '15 phút',
		specScoring: 'Thang điểm',
		specScoringValue: 'CEFR A1–C2',
		rulesTitle: 'Hướng dẫn & Chống gian lận',
		rules: [
			'Mỗi câu hỏi có 4 lựa chọn với đúng 1 đáp án chính xác.',
			'Bạn có thể quay lại và chuyển tiếp giữa các câu hỏi trước khi nộp bài.',
			'Tiến độ làm bài được tự động lưu lại. Nếu tải lại trang, bạn có thể tiếp tục làm bài.',
			'Không được sử dụng máy tính hoặc công cụ tra từ điển.'
		],
		begin: 'Bắt đầu bài kiểm tra'
	},
	active: {
		loadError: 'Không thể tải bài thi.',
		networkError: 'Lỗi kết nối khi tải bài thi.',
		loading: 'Đang tải bài thi...',
		loadingErrorTitle: 'Lỗi tải bài thi',
		noQuestionsFound: 'Không tìm thấy câu hỏi nào.',
		returnToIntro: 'Quay lại trang giới thiệu',
		previous: 'Câu trước',
		submitExam: 'Nộp bài',
		next: 'Câu tiếp',
		answerProgress: 'Tiến độ trả lời',
		answeredCount: '{{count}} / {{total}} đã trả lời',
		submitError: 'Không thể nộp bài thi.',
		submitNetworkError: 'Lỗi kết nối khi nộp bài.',
		modalTitle: 'Sẵn sàng nộp bài?',
		modalBody: 'Bạn đã trả lời {{count}} trên tổng số {{total}} câu hỏi.',
		modalWarning: '⚠️ Các câu chưa trả lời sẽ bị tính là sai.',
		confirmSubmit: 'Xác nhận nộp bài'
	},
	result: {
		loadError: 'Không thể tải kết quả.',
		networkError: 'Lỗi kết nối khi tải kết quả.',
		calculating: 'Đang tính toán kết quả của bạn...',
		resultErrorTitle: 'Lỗi kết quả',
		resultNotFound: 'Không tìm thấy kết quả.',
		backToIntro: 'Quay lại trang giới thiệu',
		retake: 'Làm lại bài kiểm tra',
		defaultLevelTitle: 'Trung cấp',
		defaultLevelDescription: 'Có thể xử lý các chủ đề giao tiếp hàng ngày.'
	},
	progressBar: {
		label: 'Câu {{current}} / {{total}}'
	},
	questionCard: {
		readingPassage: 'Đoạn văn đọc hiểu'
	},
	partialScore: {
		cefrAssessed: 'Đánh giá theo CEFR',
		yourLevel: 'Trình độ của bạn:',
		accuracyScore: 'Điểm chính xác:'
	},
	lockedTeaser: {
		title: 'Phân tích kỹ năng đầy đủ & Kế hoạch hành động',
		subtitle: 'Bị khóa cho đến khi bạn tham gia Mezon Clan',
		badge: 'Báo cáo bị khóa',
		unlockFree: 'Mở khóa miễn phí 100%',
		description: 'Tham gia cộng đồng Mezon Clan để xem chi tiết từng phần thi, các điểm yếu kỹ năng và tải chứng chỉ hoàn thành!',
		instantUnlock: 'Mở khóa ngay lập tức',
		zeroSpam: 'Không spam'
	},
	fullReport: {
		unlockedBanner: 'Đã mở khóa báo cáo đầy đủ!',
		unlockedThanks: 'Cảm ơn bạn đã tham gia cộng đồng Mezon English Clan.',
		scoreBreakdown: 'Chi tiết điểm số',
		rawScore: 'Điểm thô',
		weightedScore: 'Điểm quy đổi',
		proficiencyRank: 'Xếp hạng năng lực',
		proficiencyRankValue: 'Top 15%',
		sectionMastery: 'Mức độ thành thạo từng phần',
		keyFocusAreas: 'Các điểm cần tập trung',
		noWeaknesses: 'Không phát hiện điểm yếu đáng kể! Năng lực tổng thể xuất sắc.',
		actionPlan: 'Kế hoạch hành động 7 ngày',
		certificateTitle: 'Chứng chỉ trình độ CEFR đã xác thực',
		certificateSubtitle: 'Tải huy hiệu hoàn thành PDF chính thức để chia sẻ hoặc in ra.',
		downloadCertificate: 'Tải chứng chỉ',
		certificateAlert: 'Đã tạo tính năng tải chứng chỉ cho trình độ của bạn!'
	},
	clanJoinCTA: {
		invalidJsonError: 'Xác minh thành viên trả về JSON không hợp lệ ({{status}})',
		verifyFailedError: 'Xác minh thành viên thất bại ({{status}})',
		verifySuccess: '🎉 Xác minh thành viên Mezon Clan thành công! Đã mở khóa báo cáo đầy đủ.',
		notMemberYet: 'Chưa xác nhận được bạn đã tham gia clan. Vui lòng tham gia clan rồi thử lại.',
		networkError: 'Lỗi kết nối. Vui lòng thử xác minh lại.',
		exclusiveUnlock: 'Mở khóa độc quyền',
		joinClan: 'Tham gia Mezon English Clan',
		description:
			'Kết nối với hơn 5.000 người học tiếng Anh, tham gia các bài quiz hàng tuần, luyện nói trong các kênh và mở khóa ngay báo cáo chi tiết bài thi của bạn!',
		joinClanButton: 'Tham gia Clan trên Mezon',
		checkingMembership: 'Đang kiểm tra thành viên...',
		verifyNow: 'Tôi đã tham gia — Xác minh ngay',
		footerPrefix: 'Tham gia clan và gõ',
		footerSuffix: 'để xem báo cáo điểm',
		freeForever: 'Miễn phí trọn đời'
	}
};
