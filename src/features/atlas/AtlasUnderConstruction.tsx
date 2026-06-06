// Atlas Canvas — detached for redesign. The tab stays as a signpost: a quill
// writing on parchment (pure CSS keyframes — deliberately NOT rAF-driven,
// which can stall in WebKitGTK) and a "Still being written" quote.
//
// The forward-looking architecture lives in references/atlas-2d-foundation.md
// and prototypes/2D-AtlasMap-Prototype.html.

import './AtlasUnderConstruction.css';

export function AtlasUnderConstruction({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`atlas-wip ${compact ? 'atlas-wip--compact' : ''}`}>
      <svg
        className="atlas-wip__scene"
        viewBox="0 0 280 190"
        role="img"
        aria-label="A quill writing on parchment"
      >
        {/* Parchment sheet, slight perspective, curled near corner */}
        <g className="atlas-wip__paper">
          <path
            d="M 36 124
               C 70 108, 130 98, 168 100
               C 204 102, 232 112, 248 124
               C 216 140, 160 152, 120 152
               C 88 152, 56 140, 36 124
               Z"
          />
          {/* curled corner */}
          <path
            className="atlas-wip__paper-curl"
            d="M 36 124 C 44 130, 56 136, 68 139 C 56 142, 44 138, 38 130 Z"
          />
          {/* faint earlier lines already on the page */}
          <path className="atlas-wip__old-line" d="M 78 114 C 96 110, 130 107, 158 109" />
          <path className="atlas-wip__old-line" d="M 86 132 C 110 136, 150 137, 186 132" />
        </g>

        {/* The line being written — draws in sync with the quill */}
        <path
          className="atlas-wip__ink"
          pathLength="1"
          d="M 84 123
             C 92 119, 100 127, 110 123
             S 126 119, 136 123
             S 152 127, 162 123
             S 176 120, 184 123"
        />

        {/* Quill — nib at local (0,0); the group travels along the ink line */}
        <g className="atlas-wip__quill">
          {/* feather body */}
          <path
            className="atlas-wip__feather"
            d="M 4 -12
               C -4 -38, 8 -72, 44 -94
               C 56 -101, 64 -94, 55 -82
               C 38 -59, 22 -34, 10 -9
               Z"
          />
          {/* spine */}
          <path className="atlas-wip__spine" d="M 2 -6 C 8 -34, 22 -64, 48 -88" />
          {/* barb notches */}
          <path className="atlas-wip__barb" d="M 10 -38 L 2 -30" />
          <path className="atlas-wip__barb" d="M 18 -52 L 8 -44" />
          <path className="atlas-wip__barb" d="M 28 -66 L 17 -58" />
          {/* nib */}
          <path className="atlas-wip__nib" d="M 0 0 L 5 -10 L 8 -7 Z" />
          {/* ink flecks by the nib */}
          <circle className="atlas-wip__fleck" cx="9" cy="-14" r="1.4" />
          <circle className="atlas-wip__fleck" cx="13" cy="-20" r="1" />
        </g>
      </svg>

      <p className="atlas-wip__quote">Still being written</p>
      <p className="atlas-wip__sub">The Atlas returns once the ink dries.</p>
    </div>
  );
}
