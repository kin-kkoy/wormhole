export function AtlasPlaceholder() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '12px',
      color: 'var(--text-muted)',
    }}>
      <span style={{ fontSize: '32px', opacity: 0.3 }}>&#9775;</span>
      <span style={{ fontSize: '15px', color: 'var(--accent-atlas)' }}>Atlas Canvas</span>
      <span style={{ fontSize: '12px' }}>Coming in Stage 5</span>
    </div>
  );
}
