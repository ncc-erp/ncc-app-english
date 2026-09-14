import { ImageResponse } from 'next/og';

export const alt = 'Mezon IELTS – Luyện IELTS Speaking cùng giám khảo AI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #9333ea, #4f46e5, #6d28d9)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, opacity: 0.85 }}>MEZON IELTS</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginTop: 24 }}>Luyện IELTS Speaking</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, color: '#fcd34d' }}>cùng giám khảo AI</div>
        <div style={{ fontSize: 32, marginTop: 32, opacity: 0.9 }}>
          Đủ 3 Part • Band score 1.0–9.0 • Miễn phí
        </div>
      </div>
    ),
    size,
  );
}
