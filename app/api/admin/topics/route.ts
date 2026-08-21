import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';

async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  const user = session.user;
  return Boolean(user?.isLoggedIn && (user?.mezon_username === 'admin' || user?.mezon_id === 'admin_sys_001'));
}

// GET /api/admin/topics - List all topics for admin
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
    }

    const topics = await pgDb.getIELTSTopics();
    return NextResponse.json({ success: true, topics });
  } catch (error) {
    console.error('[Admin Topics GET Error]:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch topics' }, { status: 500 });
  }
}

// POST /api/admin/topics - Create a new topic set
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, part1_questions, part2_cue_card, part3_questions } = body || {};

    if (!title || !category) {
      return NextResponse.json({ success: false, error: 'Title and Category are required.' }, { status: 400 });
    }

    const newTopic = await pgDb.createIELTSTopic({
      id: `topic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      category,
      part1_questions: part1_questions || [],
      part2_cue_card: part2_cue_card || {
        id: `cue-${Date.now()}`,
        topic_title: title,
        cue_card_title: title,
        prompt_lead: 'You should say:',
        bullet_points: ['What it is', 'Where it happened', 'Who was involved'],
      },
      part3_questions: part3_questions || [],
    });

    return NextResponse.json({ success: true, topic: newTopic });
  } catch (error) {
    console.error('[Admin Topics POST Error]:', error);
    return NextResponse.json({ success: false, error: 'Failed to create topic' }, { status: 500 });
  }
}
