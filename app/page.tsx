'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  Mic,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Bot,
  Layers,
  Award,
  History,
  ListChecks,
  MessageSquareText,
  Facebook,
  Users,
  CheckCircle2,
  Clock,
  Headphones,
  Star,
  Quote,
} from 'lucide-react';

const FACEBOOK_URL = process.env.NEXT_PUBLIC_FACEBOOK_URL || '#';
const CLAN_INVITE_URL = process.env.NEXT_PUBLIC_MEZON_CLAN_INVITE_URL || '#';

const MENU = [
  { href: '#features', label: 'Tính năng' },
  { href: '#how', label: 'Cách hoạt động' },
  { href: '#teacher', label: 'Giảng viên' },
  { href: '#contact', label: 'Liên hệ' },
];

const STATS = [
  { value: '3', label: 'Part như thi thật' },
  { value: '4', label: 'Tiêu chí chấm điểm' },
  { value: '1.0 – 9.0', label: 'Thang Band score' },
  { value: '0đ', label: 'Hoàn toàn miễn phí' },
];

const CRITERIA = ['Fluency & Coherence', 'Lexical Resource', 'Grammatical Range', 'Pronunciation'];
const PARTS = [
  { name: 'Part 1', desc: 'Phỏng vấn', time: '4–5 phút' },
  { name: 'Part 2', desc: 'Cue card', time: '60s + 120s' },
  { name: 'Part 3', desc: 'Thảo luận', time: '4–5 phút' },
];

const FEATURES = [
  {
    Icon: Award,
    title: 'Band score từng tiêu chí',
    desc: 'Điểm chi tiết kèm nhận xét và gợi ý nâng cấp từ vựng, ngữ pháp lên C1/C2.',
    color: 'bg-indigo-100 text-indigo-700',
  },
  {
    Icon: History,
    title: 'Lưu lịch sử & nghe lại',
    desc: 'Nghe lại audio từng câu và theo dõi tiến bộ theo thời gian.',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    Icon: Clock,
    title: 'Kết quả trong vài phút',
    desc: 'Không cần chờ lịch chấm. Nộp bài xong là có Band score ngay.',
    color: 'bg-rose-100 text-rose-700',
  },
  {
    Icon: Headphones,
    title: 'Không cần cài đặt',
    desc: 'Ghi âm trực tiếp trên trình duyệt, dùng được trên máy tính lẫn điện thoại.',
    color: 'bg-sky-100 text-sky-700',
  },
];

const STEPS = [
  { Icon: ListChecks, title: 'Chọn đề thi', desc: 'Chọn một bộ đề trong ngân hàng đề theo chủ đề bạn muốn luyện.' },
  { Icon: Mic, title: 'Thi & ghi âm', desc: 'Trả lời trực tiếp bằng micro trên trình duyệt, đúng thời gian như thi thật.' },
  { Icon: MessageSquareText, title: 'Nhận kết quả', desc: 'AI chấm và trả về Band score cùng nhận xét chi tiết trong vài phút.' },
];

// Illustrative sample for the hero mock result card
const SAMPLE_CRITERIA = [
  { label: 'Fluency & Coherence', band: 7.0 },
  { label: 'Lexical Resource', band: 6.5 },
  { label: 'Grammatical Range', band: 7.0 },
  { label: 'Pronunciation', band: 7.5 },
];

const WHO = [
  'Sắp thi IELTS và muốn biết band Speaking hiện tại',
  'Ngại nói, cần môi trường luyện tập không áp lực',
  'Muốn nhận xét chi tiết thay vì chỉ một con số',
  'Học viên của thầy Huy muốn luyện thêm ngoài giờ',
];

export default function LandingPage() {
  // Mezon iframe opens the app at /?data=<hash>; verify it here so the session exists before "Thi thử"
  useEffect(() => {
    const hashData = new URLSearchParams(window.location.search).get('data');
    if (!hashData) return;
    fetch('/api/auth/mezon-hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashData }),
    }).catch((err) => console.error('Hash auth error:', err));
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-200">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-700">
                Mezon IELTS
              </span>
              <span className="block text-[10px] font-bold text-purple-600 uppercase tracking-widest">
                Speaking Platform
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            {MENU.map((m) => (
              <a key={m.href} href={m.href} className="hover:text-purple-700 transition-colors">
                {m.label}
              </a>
            ))}
          </nav>

          <Link
            href="/ielts-speaking"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all"
          >
            <Mic className="w-4 h-4" />
            Thi thử
          </Link>
        </div>
      </header>

      <main id="top" className="flex-1 w-full">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-indigo-700 to-violet-900 text-white">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/20 blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-20 md:pt-20 md:pb-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/15 border border-white/25 text-xs font-bold rounded-full uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Miễn phí • Không cần cài đặt</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                Luyện IELTS Speaking <br />
                <span className="text-amber-300">cùng giám khảo AI</span>
              </h1>
              <p className="text-purple-100 text-base sm:text-lg leading-relaxed max-w-xl">
                Mô phỏng đầy đủ 3 Part của bài thi IELTS Speaking, ghi âm ngay trên trình duyệt và nhận Band score kèm
                nhận xét chi tiết chỉ sau vài phút.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/ielts-speaking"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-amber-400 text-slate-900 hover:bg-amber-300 font-extrabold text-lg rounded-2xl transition-all shadow-xl shadow-amber-900/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Mic className="w-6 h-6" />
                  <span>Thi thử ngay</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href={CLAN_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/30 font-bold rounded-2xl transition-all"
                >
                  <Users className="w-5 h-5" />
                  <span>Gia nhập cộng đồng</span>
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-purple-100">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Chấm bằng AI theo thang điểm IELTS chính thức</span>
              </div>
            </div>

            {/* Mock result card */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -top-5 -left-5 rotate-[-6deg] px-4 py-2 bg-amber-400 text-slate-900 text-sm font-extrabold rounded-xl shadow-lg">
                Part 2 · Cue card
              </div>
              <div className="bg-white text-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl shadow-indigo-950/50 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Overall Band</div>
                    <div className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-700">
                      7.0
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                    <Award className="w-8 h-8" />
                  </div>
                </div>
                <div className="space-y-3">
                  {SAMPLE_CRITERIA.map(({ label, band }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-700">{label}</span>
                        <span className="font-bold text-purple-700">{band.toFixed(1)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                          style={{ width: `${(band / 9) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 leading-relaxed">
                  <Quote className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <span>
                    Câu trả lời mạch lạc, phát âm rõ. Hãy thay <em>&ldquo;very good&rdquo;</em> bằng{' '}
                    <em>&ldquo;exceptional&rdquo;</em> để nâng Lexical Resource.
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-5 -right-3 px-4 py-2 bg-emerald-400 text-slate-900 text-sm font-extrabold rounded-xl shadow-lg rotate-[4deg]">
                ✓ Chấm xong sau 2 phút
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="relative border-t border-white/15 bg-white/5 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <div className="text-3xl font-extrabold text-amber-300">{value}</div>
                  <div className="text-xs font-semibold text-purple-100 uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-4 py-20 space-y-10 scroll-mt-20">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">Tính năng</span>
            <h2 className="text-3xl md:text-4xl font-extrabold">Mọi thứ bạn cần để luyện Speaking tại nhà</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Thi thật đến đâu, luyện tập đến đó. Không cần giám khảo, không cần hẹn lịch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Big: AI grading */}
            <div className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-8 space-y-6">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-purple-500/30 blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold">AI chấm theo chuẩn IELTS</h3>
                  <p className="text-sm text-slate-300">Đúng 4 tiêu chí giám khảo thật sử dụng</p>
                </div>
              </div>
              <div className="relative grid grid-cols-2 gap-3">
                {CRITERIA.map((c) => (
                  <div key={c} className="flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    {c}
                  </div>
                ))}
              </div>
            </div>

            {/* Big: 3 parts */}
            <div className="md:col-span-2 relative overflow-hidden bg-purple-50 border border-purple-100 rounded-3xl p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold">Đủ 3 Part như thi thật</h3>
                  <p className="text-sm text-slate-600">Đúng cấu trúc, đúng thời gian từng phần</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {PARTS.map(({ name, desc, time }) => (
                  <div key={name} className="bg-white border border-purple-100 rounded-2xl p-4 text-center space-y-1">
                    <div className="text-xs font-bold text-purple-600 uppercase tracking-widest">{name}</div>
                    <div className="font-bold">{desc}</div>
                    <div className="text-xs text-slate-500">{time}</div>
                  </div>
                ))}
              </div>
            </div>

            {FEATURES.map(({ Icon, title, desc, color }) => (
              <div
                key={title}
                className="group relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 space-y-4 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100 hover:border-purple-200 transition-all"
              >
                <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-purple-100 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity" />
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="relative text-lg font-bold leading-snug">{title}</h3>
                <p className="relative text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-slate-50 border-y border-slate-200 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-10">
              <div className="space-y-3">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">Quy trình</span>
                <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
                  Ba bước để có một <br className="hidden sm:block" />
                  bài thi thử hoàn chỉnh
                </h2>
              </div>
              <ol className="relative space-y-8">
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-purple-500 via-indigo-400 to-slate-200" />
                {STEPS.map(({ Icon, title, desc }, i) => (
                  <li key={title} className="relative flex gap-5">
                    <div className="relative z-10 w-12 h-12 rounded-full bg-white border-2 border-purple-500 text-purple-700 font-extrabold flex items-center justify-center shrink-0 shadow-md shadow-purple-100">
                      {i + 1}
                    </div>
                    <div className="pt-1.5 space-y-1">
                      <h3 className="font-bold text-xl flex items-center gap-2">
                        {title}
                        <Icon className="w-4 h-4 text-purple-500" />
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/ielts-speaking"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-200 transition-all"
              >
                Bắt đầu thi thử
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Mock recording screen */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-gradient-to-br from-purple-200 to-indigo-200" />
              <div className="relative bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700">Part 1 · Câu 3/5</span>
                  <span className="inline-flex items-center gap-1.5 text-rose-600">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    Đang ghi âm
                  </span>
                </div>
                <p className="text-lg font-semibold text-slate-800 leading-snug">
                  &ldquo;Do you prefer studying in the morning or in the evening? Why?&rdquo;
                </p>
                <div className="flex items-end justify-center gap-1 h-16">
                  {[3, 6, 9, 14, 8, 12, 16, 10, 5, 11, 15, 7, 12, 9, 4, 8, 13, 6, 10, 3].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full bg-gradient-to-t from-purple-600 to-indigo-400 animate-pulse-subtle"
                      style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-slate-700">00:24</span>
                  <div className="w-14 h-14 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                    <Mic className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Teacher + Who is this for */}
        <section id="teacher" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20 grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">
          <div className="lg:col-span-3 relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-8 md:p-10 flex flex-col sm:flex-row items-center gap-8">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-purple-500/30 blur-3xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://cdn.komu.vn/1788023377328345088/2099330483476238336.png"
              alt="Thầy Phùng Quang Huy"
              className="relative w-40 h-40 rounded-full object-cover shrink-0 shadow-2xl shadow-amber-900/40 ring-4 ring-amber-300"
            />
            <div className="relative space-y-3 text-center sm:text-left">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">Giảng viên</span>
              <h2 className="text-3xl md:text-4xl font-extrabold">Thầy Phùng Quang Huy</h2>
              <p className="text-slate-300 leading-relaxed">
                Đề thi và tiêu chí chấm trên nền tảng được xây dựng theo định hướng luyện thi của thầy Huy, giúp bạn
                luyện đúng trọng tâm ngoài giờ học.
              </p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-3 pt-2">
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold transition-all"
                >
                  <Facebook className="w-4 h-4" /> Facebook
                </a>
                <a
                  href={CLAN_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl text-sm font-bold transition-all"
                >
                  <Users className="w-4 h-4" /> Cộng đồng Mezon
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-8 space-y-5">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <h3 className="text-xl font-extrabold">Dành cho ai?</h3>
            </div>
            <ul className="space-y-3">
              {WHO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Contact / CTA */}
        <section id="contact" className="max-w-6xl mx-auto px-4 pb-20 scroll-mt-20">
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-indigo-700 to-violet-900 text-white rounded-3xl p-8 md:p-14 text-center space-y-6">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="relative space-y-3">
              <h2 className="text-3xl md:text-4xl font-extrabold">Sẵn sàng biết band Speaking của bạn?</h2>
              <p className="text-purple-100 max-w-xl mx-auto">
                Một bài thi thử chỉ mất khoảng 15 phút. Theo dõi thầy hoặc tham gia cộng đồng để cùng luyện tập mỗi ngày.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/ielts-speaking"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-amber-400 text-slate-900 hover:bg-amber-300 font-extrabold text-lg rounded-2xl transition-all shadow-xl shadow-amber-900/30"
              >
                <Mic className="w-6 h-6" />
                Thi thử miễn phí
              </Link>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/30 font-bold rounded-2xl transition-all"
              >
                <Facebook className="w-5 h-5" />
                Theo dõi Facebook
              </a>
              <a
                href={CLAN_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/30 font-bold rounded-2xl transition-all"
              >
                <Users className="w-5 h-5" />
                Gia nhập clan Mezon
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Mezon IELTS Speaking App. Powered by Mezon.
        </div>
      </footer>
    </div>
  );
}
