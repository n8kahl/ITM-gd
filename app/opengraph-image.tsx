import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Trade In The Money - Premium Trading Signals';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0b 0%, #111113 50%, #0a0a0b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Subtle gradient accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at 50% 30%, rgba(4, 120, 87, 0.15) 0%, transparent 50%)',
          }}
        />

        {/* Logo Text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '24px',
          }}
        >
          <span
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#FFFEF5',
              fontFamily: 'serif',
              letterSpacing: '-1px',
            }}
          >
            Trade
          </span>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#D4AF37',
              fontFamily: 'serif',
              letterSpacing: '-1px',
            }}
          >
            ITM
          </span>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#047857',
              marginLeft: '4px',
              marginBottom: '24px',
            }}
          />
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '32px',
            color: '#D4AF37',
            fontWeight: 600,
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          3 Guaranteed 100%+ Trades Every Week
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255, 254, 245, 0.7)',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          Premium Trading Signals & Education
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            width: '200px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
