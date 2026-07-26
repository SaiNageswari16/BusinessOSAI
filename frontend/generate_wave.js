const fs = require('fs');

const width = 1440;
const height = 300;
const numLines = 80;

let paths = '';

for (let i = 0; i < numLines; i++) {
  // We want a Lissajous/parametric ribbon effect.
  // The ribbon flows from left to right.
  // We'll interpolate a bezier curve where the control points oscillate based on the line index.
  
  const progress = i / (numLines - 1);
  
  // Start point (left side)
  const startX = -100;
  const startY = 150 + Math.sin(progress * Math.PI * 2) * 20;

  // End point (right side)
  const endX = 1540;
  const endY = 150 + Math.cos(progress * Math.PI * 2) * 20;

  // Control point 1 (left-middle)
  const cp1X = 400 + Math.sin(progress * Math.PI * 3) * 150;
  const cp1Y = 50 + Math.cos(progress * Math.PI * 2) * 100;

  // Control point 2 (right-middle)
  const cp2X = 1000 + Math.cos(progress * Math.PI * 3) * 150;
  const cp2Y = 250 + Math.sin(progress * Math.PI * 2) * 100;

  // Calculate opacity: the edges of the ribbon can be slightly fainter
  const opacity = 0.05 + Math.abs(Math.sin(progress * Math.PI)) * 0.15;
  const strokeWidth = 0.5 + Math.abs(Math.cos(progress * Math.PI)) * 0.5;

  paths += `  <path d="M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}" fill="none" stroke="#00f2fe" stroke-width="${strokeWidth}" opacity="${opacity.toFixed(3)}" />\n`;
}

// Add a glowing core to the ribbon
paths += `  <path d="M -100 150 C 400 50, 1000 250, 1540 150" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.4" filter="blur(2px)" />\n`;
paths += `  <path d="M -100 150 C 400 50, 1000 250, 1540 150" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.8" />\n`;


const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#00f2fe" stop-opacity="0" />
    </radialGradient>
  </defs>
  <!-- Central bright glow -->
  <circle cx="720" cy="150" r="200" fill="url(#glow)" mix-blend-mode="screen" />
${paths}
</svg>`;

fs.writeFileSync('wave.svg', svg);
console.log('wave.svg generated!');
