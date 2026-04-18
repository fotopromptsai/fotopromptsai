import { motion } from "motion/react";

export default function FaceScanOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 300 400"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Corner brackets */}
        {[
          [20, 20, 1, 1], [280, 20, -1, 1], [20, 380, 1, -1], [280, 380, -1, -1]
        ].map(([cx, cy, sx, sy], i) => (
          <g key={i}>
            <line x1={cx} y1={cy} x2={cx + sx * 28} y2={cy} stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={cx} y2={cy + sy * 28} stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="2.5" fill="#f97316" />
          </g>
        ))}

        {/* Face ellipse */}
        <ellipse cx="150" cy="175" rx="72" ry="92" fill="none" stroke="#f97316" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />

        {/* Eye lines */}
        <line x1="100" y1="148" x2="140" y2="148" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
        <line x1="160" y1="148" x2="200" y2="148" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
        <circle cx="120" cy="148" r="6" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.7" />
        <circle cx="180" cy="148" r="6" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.7" />
        <circle cx="120" cy="148" r="2" fill="#38bdf8" opacity="0.5" />
        <circle cx="180" cy="148" r="2" fill="#38bdf8" opacity="0.5" />

        {/* Nose bridge */}
        <path d="M150 155 L142 185 L158 185" fill="none" stroke="#f97316" strokeWidth="0.7" opacity="0.5" />

        {/* Mouth */}
        <path d="M128 205 Q150 218 172 205" fill="none" stroke="#f97316" strokeWidth="0.8" opacity="0.5" />

        {/* Mesh dots */}
        {[
          [115,130],[150,125],[185,130],
          [108,160],[150,157],[192,160],
          [113,190],[150,192],[187,190],
          [125,220],[150,225],[175,220],
          [150,100],[130,105],[170,105],
          [135,245],[150,252],[165,245],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.5" fill="#f97316" opacity="0.35" />
        ))}

        {/* Mesh lines */}
        {[
          [[115,130],[150,125]], [[150,125],[185,130]],
          [[115,130],[108,160]], [[185,130],[192,160]],
          [[108,160],[113,190]], [[192,160],[187,190]],
          [[113,190],[125,220]], [[187,190],[175,220]],
          [[115,130],[150,157]], [[185,130],[150,157]],
          [[108,160],[150,192]], [[192,160],[150,192]],
          [[150,125],[150,100]],
        ].map(([[x1,y1],[x2,y2]], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f97316" strokeWidth="0.4" opacity="0.2" />
        ))}

        {/* Biometric data tags */}
        <text x="24" y="60" fill="#f97316" fontSize="5" opacity="0.6" fontFamily="monospace">FACE_ID: 0x4F2A</text>
        <text x="24" y="68" fill="#38bdf8" fontSize="5" opacity="0.5" fontFamily="monospace">SCAN: 98.7%</text>
        <text x="200" y="60" fill="#f97316" fontSize="5" opacity="0.6" fontFamily="monospace">BIO_AUTH</text>
        <text x="200" y="68" fill="#38bdf8" fontSize="5" opacity="0.5" fontFamily="monospace">MESH: ON</text>

        {/* Bottom bar */}
        <line x1="60" y1="355" x2="240" y2="355" stroke="#f97316" strokeWidth="0.5" opacity="0.3" />
        <text x="150" y="363" textAnchor="middle" fill="#f97316" fontSize="5" opacity="0.5" fontFamily="monospace">PERSONAREFINE · AI VISION</text>
      </svg>

      {/* Animated scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, #f97316 30%, #38bdf8 50%, #f97316 70%, transparent)",
          boxShadow: "0 0 12px 3px rgba(249,115,22,0.4)",
        }}
        initial={{ top: "5%", opacity: 0 }}
        animate={{ top: ["5%", "95%", "5%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Pulsing corner glow */}
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{ boxShadow: "inset 0 0 24px rgba(249,115,22,0.15)" }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
