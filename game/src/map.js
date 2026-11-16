// Sector 7: a desert freight yard, 76 x 64 m. Attackers (Vipers) spawn south,
// defenders (Wardens) north; site A "Yard" west, site B "Depot" east. Three
// lanes run north: West, Mid and East, through two gate walls with matching gaps.
// Every route below was checked against the walls and cover: a bot following one
// never walks into a box. Boxes are [x, z, width, height, depth, material];
// barrels are cylinders with a small square collider.
export const MAP = {
  bounds: { minX: -38, maxX: 38, minZ: -32, maxZ: 32 },

  // Solid boxes. y defaults to 0 (sitting on the ground).
  boxes: [
    // Perimeter, 4.5 m high.
    { x: 0, z: -32.3, w: 77.2, h: 4.5, d: 0.6, mat: 'concrete' },
    { x: 0, z: 32.3, w: 77.2, h: 4.5, d: 0.6, mat: 'concrete' },
    { x: -38.3, z: 0, w: 0.6, h: 4.5, d: 65, mat: 'concrete' },
    { x: 38.3, z: 0, w: 0.6, h: 4.5, d: 65, mat: 'concrete' },
    // South gate wall (z=+8, 3.2 m): gaps west [-26,-16], mid [-5,5], east [16,26].
    { x: -32, z: 8, w: 12, h: 3.2, d: 0.6, mat: 'dark' },
    { x: -10.5, z: 8, w: 11, h: 3.2, d: 0.6, mat: 'dark' },
    { x: 10.5, z: 8, w: 11, h: 3.2, d: 0.6, mat: 'dark' },
    { x: 32, z: 8, w: 12, h: 3.2, d: 0.6, mat: 'dark' },
    // North gate wall (z=-8, 4.5 m): gaps west [-22,-16], mid [-4,4], east [16,22].
    { x: -30, z: -8, w: 16, h: 4.5, d: 0.6, mat: 'concrete' },
    { x: -10, z: -8, w: 12, h: 4.5, d: 0.6, mat: 'concrete' },
    { x: 10, z: -8, w: 12, h: 4.5, d: 0.6, mat: 'concrete' },
    { x: 30, z: -8, w: 16, h: 4.5, d: 0.6, mat: 'concrete' },
    // Mid courtyard: pillars, crates, a jumpable platform (0.8 m).
    { x: -10, z: -2, w: 1.2, h: 4.5, d: 1.2, mat: 'dark' },
    { x: 10, z: -2, w: 1.2, h: 4.5, d: 1.2, mat: 'dark' },
    { x: -6, z: 2, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: 6, z: 2, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: -3, z: -4, w: 1.2, h: 0.9, d: 1.2, mat: 'crate' },
    { x: 3, z: -4, w: 1.2, h: 0.9, d: 1.2, mat: 'crate' },
    { x: -6, z: -2, w: 4, h: 0.8, d: 3, mat: 'dark' },
    // Mid yard container, splitting the north approach.
    { x: 5, z: -14, w: 2.4, h: 2.6, d: 6, mat: 'rust' },
    // Lane containers.
    { x: -28, z: 16, w: 6, h: 2.6, d: 2.4, mat: 'teal' },
    { x: 28, z: 16, w: 6, h: 2.6, d: 2.4, mat: 'rust' },
    // Lane crates and low sandbag walls (1.2 m: crouch behind, stand to shoot over).
    { x: -20, z: 22, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: 20, z: 22, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: -30, z: 6, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: 30, z: 6, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: -24, z: 10, w: 6, h: 1.2, d: 0.5, mat: 'dark' },
    { x: 24, z: 10, w: 6, h: 1.2, d: 0.5, mat: 'dark' },
    { x: -14, z: -16, w: 5, h: 1.2, d: 0.5, mat: 'dark' },
    { x: 14, z: -16, w: 5, h: 1.2, d: 0.5, mat: 'dark' },
    // Site A cover.
    { x: -32, z: -24, w: 2.4, h: 2.6, d: 6, mat: 'teal' },
    { x: -30, z: -16, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: -20, z: -24, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: -28, z: -21, w: 1.2, h: 0.9, d: 1.2, mat: 'crate' },
    { x: -18, z: -16, w: 1.2, h: 1.1, d: 1.2, mat: 'crate' },
    // Site B cover (mirrored).
    { x: 32, z: -24, w: 2.4, h: 2.6, d: 6, mat: 'rust' },
    { x: 30, z: -16, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: 20, z: -24, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: 28, z: -21, w: 1.2, h: 0.9, d: 1.2, mat: 'crate' },
    { x: 18, z: -16, w: 1.2, h: 1.1, d: 1.2, mat: 'crate' },
    // Spawn cover.
    { x: -6, z: 29, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: 6, z: 29, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: -6, z: -29, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
    { x: 6, z: -29, w: 1.6, h: 1.1, d: 1.6, mat: 'crate' },
  ],

  barrels: [
    [-12, 20], [12, 20], [-8, -20], [8, -20], [-14, 26], [14, 26],
  ],

  sites: {
    A: { name: 'Yard', minX: -34, maxX: -16, minZ: -28, maxZ: -12, plant: [-24, -20] },
    B: { name: 'Depot', minX: 16, maxX: 34, minZ: -28, maxZ: -12, plant: [24, -20] },
  },

  spawns: {
    attackers: [[0, 28], [-3, 29], [3, 29], [-6, 27], [6, 27]],
    defenders: [[0, -28], [-3, -29], [3, -29], [-6, -27], [6, -27]],
  },

  // Bot routes: ordered [x, z] waypoints. Attackers end at a site; defenders
  // end at a hold spot and face `lookAt`.
  routes: {
    attackWest: { points: [[-4, 24], [-12, 18], [-20, 12], [-19, 4], [-23, -4], [-19, -6], [-19, -14], [-24, -20]], site: 'A' },
    attackMidA: { points: [[0, 22], [0, 14], [0, 6], [0, -2], [0, -12], [-8, -14], [-17, -14], [-24, -20]], site: 'A' },
    attackMidB: { points: [[0, 22], [0, 14], [0, 6], [0, -2], [0, -12], [8, -14], [17, -14], [24, -20]], site: 'B' },
    attackEast: { points: [[4, 24], [12, 18], [20, 12], [19, 4], [23, -4], [19, -6], [19, -14], [24, -20]], site: 'B' },
    defendA1: { points: [[-4, -26], [-12, -22], [-18, -18], [-22, -16]], hold: { lookAt: [-19, -8] } },
    defendA2: { points: [[-2, -27], [-10, -25], [-20, -26], [-28, -24]], hold: { lookAt: [-24, -14] } },
    defendB1: { points: [[4, -26], [12, -22], [18, -18], [22, -16]], hold: { lookAt: [19, -8] } },
    defendB2: { points: [[2, -27], [10, -25], [20, -26], [28, -24]], hold: { lookAt: [24, -14] } },
    defendMid: { points: [[0, -26], [0, -18], [0, -13]], hold: { lookAt: [0, -4] } },
  },
};

export function inSite(zone, x, z) {
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}
