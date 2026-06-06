// Atlas Canvas — detached for redesign. The tab stays as a signpost: a
// looping forge animation (pure CSS keyframes — deliberately NOT rAF-driven,
// which can stall in WebKitGTK) and an "In Development" quote.
//
// The forward-looking architecture lives in references/atlas-2d-foundation.md
// and prototypes/2D-AtlasMap-Prototype.html.

import './AtlasUnderConstruction.css';

export function AtlasUnderConstruction({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`atlas-wip ${compact ? 'atlas-wip--compact' : ''}`}>
      <svg
        className="atlas-wip__forge"
        viewBox="0 0 240 190"
        role="img"
        aria-label="A hammer striking an anvil"
      >
        {/* Sparks — burst on each strike */}
        <g className="atlas-wip__sparks">
          <line x1="96" y1="96" x2="76" y2="74" />
          <line x1="104" y1="92" x2="100" y2="64" />
          <line x1="114" y1="94" x2="132" y2="70" />
          <line x1="90" y1="102" x2="62" y2="94" />
          <line x1="118" y1="102" x2="146" y2="92" />
        </g>

        {/* Anvil */}
        <g className="atlas-wip__anvil">
          {/* horn + body */}
          <path
            d="M 52 104
               C 38 104 30 110 24 118
               C 34 116 44 116 52 120
               L 60 120 L 60 130 L 52 138 L 148 138 L 140 130 L 140 120
               L 156 118 C 166 116 172 110 172 104
               Z"
          />
          {/* waist + foot */}
          <rect x="88" y="138" width="24" height="12" rx="2" />
          <path d="M 74 150 L 126 150 L 134 162 L 66 162 Z" />
          {/* top face highlight */}
          <rect className="atlas-wip__anvil-face" x="52" y="104" width="120" height="5" rx="2.5" />
        </g>

        {/* Hammer — pivots at the wrist, strikes the anvil face */}
        <g className="atlas-wip__hammer">
          {/* handle */}
          <rect x="108" y="34" width="76" height="9" rx="4.5" transform="rotate(24 184 42)" />
          {/* head */}
          <g transform="rotate(24 112 40)">
            <rect x="96" y="22" width="30" height="38" rx="5" />
            <rect className="atlas-wip__hammer-face" x="96" y="52" width="30" height="8" rx="4" />
          </g>
        </g>
      </svg>

      <p className="atlas-wip__quote">In Development</p>
      <p className="atlas-wip__sub">The Atlas has been carried back to the forge.</p>
    </div>
  );
}
