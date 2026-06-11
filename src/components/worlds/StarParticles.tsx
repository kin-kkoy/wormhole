import { useMemo } from 'react';
import './StarParticles.css';

const PARTICLE_COUNT = 50;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function StarParticles() {
  const particles = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const size = 1 + rand() * 2.5;
      const brightness = 0.15 + rand() * 0.4;
      const colorIdx = Math.floor(rand() * 4);
      const rgb = [
        '234, 229, 218',
        'var(--accent-overview-rgb)',
        'var(--accent-characters-rgb)',
        'var(--accent-lore-rgb)',
      ][colorIdx];
      return {
        key: i,
        size,
        left: rand() * 100,
        top: rand() * 100,
        duration: 20 + rand() * 35,
        delay: -(rand() * 45),
        color: `rgba(${rgb}, ${brightness})`,
      };
    });
  }, []);

  return (
    <div className="star-particles" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.key}
          className="star-particles__dot"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
