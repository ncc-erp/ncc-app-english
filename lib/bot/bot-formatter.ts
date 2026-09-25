import { IELTSSpeakingAttempt } from '@/types/ielts';

function truncate(text: string | undefined, maxLength: number): string {
	if (!text) return '';
	const trimmed = text.trim();
	if (trimmed.length <= maxLength) return trimmed;
	return trimmed.slice(0, maxLength - 3) + '...';
}

export function formatIELTSResult(attempt: IELTSSpeakingAttempt, targetUserName?: string, detailsUrl?: string): string {
	const result = attempt.score_result;
	const overallBand = attempt.band_score ?? result?.overall_band ?? 0;
	const topicTitle = attempt.topic_title || result?.topic_title || 'IELTS Speaking Assessment';
	const dateStr = attempt.submitted_at
		? new Date(attempt.submitted_at).toLocaleString('en-US', {
				timeZone: 'Asia/Ho_Chi_Minh',
				month: 'short',
				day: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			})
		: 'Vừa xong';

	const userGreeting = targetUserName ? ` CHO ${targetUserName}` : '';

	// -------------------------------------------------------------
	// PART 1: Overall Band, Strengths & Link to Detailed Report
	// -------------------------------------------------------------
	let msg1 = `🎯 **BÁO CÁO KẾT QUẢ THI THỬ IELTS SPEAKING${userGreeting}**\n`;
	msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
	msg1 += `📋 **Chủ đề:** ${topicTitle}\n`;
	msg1 += `📅 **Ngày:** ${dateStr}\n`;
	msg1 += `🆔 **Mã lượt thi:** \`${attempt.id}\`\n\n`;
	msg1 += `🏆 **ĐIỂM BAND TỔNG: ${overallBand.toFixed(1)}**`;
	if (result?.status_title) {
		msg1 += ` — *${result.status_title}*`;
	}
	msg1 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

	// Strengths & Areas for Improvement

	if (detailsUrl) {
		msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
		msg1 += `🌐 **Báo cáo chi tiết & Nghe lại âm thanh:**\n`;
		msg1 += `👉 ${detailsUrl}\n`;
		msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;
	}

	return msg1.trim();
}

export function formatIELTSTestHistory(attempts: IELTSSpeakingAttempt[], userName?: string): string {
	if (!attempts || attempts.length === 0) {
		return `ℹ️ Bạn chưa có lượt thi IELTS Speaking nào được ghi nhận. Vào web app để làm bài thi đầu tiên nhé!`;
	}

	let msg = `📋 **LỊCH SỬ THI IELTS SPEAKING${userName ? ` CỦA ${userName}` : ''}**\n`;
	msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

	attempts.forEach((att, index) => {
		const band = att.band_score ?? att.score_result?.overall_band;
		const bandStr = band !== undefined ? `Band ${band.toFixed(1)}` : 'Đang chấm điểm...';
		const dateStr = att.submitted_at
			? new Date(att.submitted_at).toLocaleDateString('en-US', {
					month: 'short',
					day: '2-digit',
					year: 'numeric'
				})
			: 'Đang chờ';

		msg += `${index + 1}. \`${att.id}\` | **${att.topic_title}** | **${bandStr}** | ${dateStr}\n`;
	});

	msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
	msg += `💡 **Mẹo:** Gõ \`*result <attempt_id>\` (vd: \`*result ${attempts[0].id}\`) để xem chi tiết bất kỳ bài thi nào!`;

	return msg;
}
