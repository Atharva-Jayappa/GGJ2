// puzzleData.ts - Define complete puzzle configurations for Signal Jammer

export interface PuzzleCell {
    symbol: string;
    color: string;  // hex color value (e.g., '#22d3ee')
}

export interface Puzzle {
    id: string;
    name: string;
    // Grid configuration (the symbols and their colors in order)
    grid: PuzzleCell[];
    // The correct answer (index in the grid)
    correctIndex: number;
    // Clues distributed to players (cycles if more players than clues)
    clues: string[];
}

// Color palette - hex values for consistent rendering
const COLORS = {
    cyan: '#22d3ee',
    pink: '#f472b6',
    green: '#4ade80',
    yellow: '#facc15',
    red: '#f87171',
    purple: '#c084fc',
    blue: '#60a5fa',
    orange: '#fb923c',
    teal: '#2dd4bf',
    slate: '#cbd5e1',
    lime: '#a3e635',
    orangeLight: '#fdba74',
    yellowLight: '#fde047',
};

export const PUZZLES: Puzzle[] = [
    {
        id: 'cyber_runes',
        name: 'Cyber Runes',
        grid: [
            { symbol: '◇', color: COLORS.cyan },
            { symbol: '△', color: COLORS.pink },
            { symbol: '○', color: COLORS.green },
            { symbol: '□', color: COLORS.yellow },
            { symbol: '⬡', color: COLORS.red },
            { symbol: '⬢', color: COLORS.purple },
            { symbol: '◈', color: COLORS.blue },
            { symbol: '✧', color: COLORS.orange },  // ← ANSWER (index 7)
            { symbol: '☆', color: COLORS.teal },
        ],
        correctIndex: 7,
        clues: [
            // Matches: ⬡, ⬢, ◈, ✧, ☆ (row 2-3) → need more clues
            "The symbol is NOT in the first row",
            // Matches: ○, □, ⬡, ◈, ✧ (not cyan/pink) → combined with above: ⬡, ◈, ✧
            "The symbol is NOT cyan, pink, or purple colored",
            // Matches: ✧, ☆ (star shapes) → combined: ✧ only
            "The symbol has POINTED tips radiating outward",
            // Matches: ✧ (4-pointed) vs ☆ (5-pointed)
            "The symbol has exactly FOUR points",
        ],
    },
    {
        id: 'math_symbols',
        name: 'Binary Matrix',
        grid: [
            { symbol: '∞', color: COLORS.cyan },
            { symbol: '∑', color: COLORS.pink },
            { symbol: 'π', color: COLORS.green },      // ← ANSWER (index 2)
            { symbol: '√', color: COLORS.yellow },
            { symbol: 'Δ', color: COLORS.red },
            { symbol: 'Ω', color: COLORS.purple },
            { symbol: '∂', color: COLORS.blue },
            { symbol: '∫', color: COLORS.orange },
            { symbol: 'λ', color: COLORS.teal },
        ],
        correctIndex: 2,
        clues: [
            // Matches: ∞, ∑, π (row 1) + √, Δ, Ω (row 2) - need narrowing
            "The symbol is in the TOP HALF of the grid",
            // Matches: π, √, ∂, λ (lowercase-ish curved symbols)
            "The symbol uses LOWERCASE or small lettering style",
            // Matches: π, Ω, λ (Greek letters representing constants)
            "The symbol is a GREEK letter",
            // Matches: π (green), vs Ω (purple), λ (teal)
            "The symbol is a COOL color (green, blue, cyan, or teal)",
        ],
    },
    {
        id: 'card_suits',
        name: 'Card Cipher',
        grid: [
            { symbol: '♠', color: COLORS.slate },
            { symbol: '♥', color: COLORS.red },
            { symbol: '♦', color: COLORS.red },
            { symbol: '♣', color: COLORS.lime },
            { symbol: '♤', color: COLORS.cyan },      // ← ANSWER (index 4)
            { symbol: '♡', color: COLORS.pink },
            { symbol: '♢', color: COLORS.yellow },
            { symbol: '♧', color: COLORS.green },
            { symbol: '⚜', color: COLORS.purple },
        ],
        correctIndex: 4,
        clues: [
            // Matches: ♠, ♣, ♤, ♧ (black suits) + ⚜
            "The symbol is NOT a heart or diamond shape",
            // Matches: ♤, ♡, ♢, ♧ (outlines only)
            "The symbol is HOLLOW/OUTLINE style, not filled solid",
            // Matches: ♤ (cyan), ♢ (yellow), ⚜ (purple) - not warm colors
            "The symbol is NOT red, pink, or green colored",
            // Matches: ♠, ♤ (spade shapes)
            "The symbol has a POINTED top like an upside-down heart",
        ],
    },
    {
        id: 'arrows',
        name: 'Vector Grid',
        grid: [
            { symbol: '↑', color: COLORS.red },
            { symbol: '↗', color: COLORS.orange },
            { symbol: '→', color: COLORS.yellow },
            { symbol: '↘', color: COLORS.green },
            { symbol: '↓', color: COLORS.cyan },
            { symbol: '↙', color: COLORS.blue },      // ← ANSWER (index 5)
            { symbol: '←', color: COLORS.purple },
            { symbol: '↖', color: COLORS.pink },
            { symbol: '⟳', color: COLORS.teal },
        ],
        correctIndex: 5,
        clues: [
            // Matches: ↘, ↓, ↙ (has downward component)
            "The arrow points at least partially DOWNWARD",
            // Matches: ↗, ↘, ↙, ↖ (diagonals)
            "The arrow is DIAGONAL, not straight",
            // Matches: ↙ (blue), ↓ (cyan), ← (purple) - cool colors
            "The symbol is a COOL color (blue, cyan, purple, or teal)",
            // Matches: ↙, ←, ↖ (has leftward component)
            "The arrow points at least partially LEFT",
        ],
    },
    {
        id: 'planets',
        name: 'Cosmic Code',
        grid: [
            { symbol: '☉', color: COLORS.yellow },
            { symbol: '☽', color: COLORS.slate },
            { symbol: '☿', color: COLORS.orange },
            { symbol: '♀', color: COLORS.pink },
            { symbol: '♁', color: COLORS.blue },
            { symbol: '♂', color: COLORS.red },       // ← ANSWER (index 5)
            { symbol: '♃', color: COLORS.orangeLight },
            { symbol: '♄', color: COLORS.yellowLight },
            { symbol: '♅', color: COLORS.cyan },
        ],
        correctIndex: 5,
        clues: [
            // Matches: ♀, ♁, ♂, ♃, ♄, ♅ (rows 2-3)
            "The symbol is NOT in the first row",
            // Matches: ☿, ♀, ♂ (has circle with something attached)
            "The symbol has a CIRCLE as its base shape",
            // Matches: ♂ (red), ♈ if existed - warm single colors
            "The symbol is a WARM color (red, orange, yellow, or pink)",
            // Matches: ♂ (arrow pointing out), vs ♀ (cross below)
            "The symbol has an ARROW or spike extending from it",
        ],
    },
    {
        id: 'zodiac',
        name: 'Star Chart',
        grid: [
            { symbol: '♈', color: COLORS.red },
            { symbol: '♉', color: COLORS.green },
            { symbol: '♊', color: COLORS.yellow },
            { symbol: '♋', color: COLORS.slate },
            { symbol: '♌', color: COLORS.orange },
            { symbol: '♍', color: COLORS.blue },
            { symbol: '♎', color: COLORS.pink },      // ← ANSWER (index 6)
            { symbol: '♏', color: COLORS.purple },
            { symbol: '♐', color: COLORS.cyan },
        ],
        correctIndex: 6,
        clues: [
            // Matches: ♎, ♏, ♐ (row 3)
            "The symbol is in the BOTTOM row",
            // Matches: ♎ (pink), ♈ (red), ♌ (orange) - warm-ish
            "The symbol is NOT blue, purple, or cyan colored",
            // Matches: ♎ (Libra - balanced/symmetric), ♊ (Gemini)
            "The symbol appears SYMMETRIC or balanced",
            // Matches: ♎ (horizontal line on top)
            "The symbol has a HORIZONTAL line as part of it",
        ],
    },
    {
        id: 'weather',
        name: 'Storm Signal',
        grid: [
            { symbol: '☀', color: COLORS.yellow },
            { symbol: '☁', color: COLORS.slate },
            { symbol: '☂', color: COLORS.blue },
            { symbol: '☃', color: COLORS.lime },
            { symbol: '☄', color: COLORS.orange },    // ← ANSWER (index 4)
            { symbol: '⚡', color: COLORS.yellowLight },
            { symbol: '❄', color: COLORS.cyan },
            { symbol: '☾', color: COLORS.purple },
            { symbol: '✦', color: COLORS.pink },
        ],
        correctIndex: 4,
        clues: [
            // Matches: ☃, ☄, ⚡ (row 2)
            "The symbol is in the MIDDLE row",
            // Matches: ☀, ☄, ⚡ (yellow/orange warm colors)
            "The symbol is a WARM color (yellow, orange, or red)",
            // Matches: ☄ (comet), ⚡ (lightning) - dynamic/moving
            "The symbol represents something that MOVES or falls",
            // Matches: ☀ (circle), ☄ (circle with tail) - round base
            "The symbol has a ROUND or circular part",
        ],
    },
];

// Helper to get a random puzzle
export function getRandomPuzzle(): Puzzle {
    return PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
}

// Helper to get puzzle by ID
export function getPuzzleById(id: string): Puzzle | undefined {
    return PUZZLES.find(p => p.id === id);
}

// Helper to get clue for a specific player index
export function getClueForPlayer(puzzle: Puzzle, playerIndex: number): string {
    return puzzle.clues[playerIndex % puzzle.clues.length];
}

