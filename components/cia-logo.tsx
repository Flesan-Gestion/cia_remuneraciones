// Símbolo "Sinapsis" — identidad del área CIA (Centro Inteligencia Analítica).
// Geometría canónica de ~/.claude/skills/CIA-Sinapsis-Skill (assets/svg/sinapsis-rojo.svg);
// los assets originales también están en public/brand/cia/ para usos fuera de React.
// Se pinta con `currentColor` para respetar la regla de marca (rojo sobre claro,
// blanco sobre oscuro) sin duplicar el SVG: basta con la clase de color.
// No deformar, rotar ni recolorear fuera de paleta; el skew de -9° es parte del símbolo.

const NODOS: Array<[number, number, number]> = [
  [50, 9, 5.4],
  [76.046, 28.145, 4.4],
  [93.572, 56.124, 6.2],
  [66.634, 73.755, 4],
  [40.565, 87.842, 5.2],
  [23.153, 65.5, 4.6],
  [10.588, 38.699, 5.6],
  [33.377, 28.724, 3.8],
];

const ESPIGAS: Array<[number, number, number, number]> = [
  [50, 41, 50, 9],
  [56.894, 44.215, 76.046, 28.145],
  [58.912, 51.253, 93.572, 56.124],
  [55.162, 57.372, 66.634, 73.755],
  [47.823, 58.733, 40.565, 87.842],
  [42.206, 54.5, 23.153, 65.5],
  [41.349, 47.519, 10.588, 38.699],
  [44.459, 42.908, 33.377, 28.724],
];

export function CiaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-16 -16 132 132"
      className={className}
      role="img"
      aria-label="CIA · Centro Inteligencia Analítica"
    >
      <g transform="translate(50,50) skewX(-9) translate(-50,-50)">
        <g stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" fill="none">
          {ESPIGAS.map(([x1, y1, x2, y2]) => (
            <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        <g fill="currentColor" stroke="none">
          {NODOS.map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
          <path
            fillRule="evenodd"
            d="M 41,50 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 Z M 46.4,50 a 3.6 3.6 0 1 0 7.2 0 a 3.6 3.6 0 1 0 -7.2 0 Z"
          />
        </g>
      </g>
    </svg>
  );
}
