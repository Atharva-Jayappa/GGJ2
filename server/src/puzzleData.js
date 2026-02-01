// puzzleData.js - Define complete puzzle configurations for Signal Jammer

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

export const PUZZLES = [
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
            "The symbol is NOT in the first row",
            "The symbol is NOT cyan, pink, or purple colored",
            "The symbol has POINTED tips radiating outward",
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
            "The symbol is in the TOP HALF of the grid",
            "The symbol uses LOWERCASE or small lettering style",
            "The symbol is a GREEK letter",
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
            "The symbol is NOT a heart or diamond shape",
            "The symbol is HOLLOW/OUTLINE style, not filled solid",
            "The symbol is NOT red, pink, or green colored",
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
            "The arrow points at least partially DOWNWARD",
            "The arrow is DIAGONAL, not straight",
            "The symbol is a COOL color (blue, cyan, purple, or teal)",
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
            "The symbol is NOT in the first row",
            "The symbol has a CIRCLE as its base shape",
            "The symbol is a WARM color (red, orange, yellow, or pink)",
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
            "The symbol is in the BOTTOM row",
            "The symbol is NOT blue, purple, or cyan colored",
            "The symbol appears SYMMETRIC or balanced",
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
            "The symbol is in the MIDDLE row",
            "The symbol is a WARM color (yellow, orange, or red)",
            "The symbol represents something that MOVES or falls",
            "The symbol has a ROUND or circular part",
        ],
    },
];

// Helper to get a random puzzle
export function getRandomPuzzle() {
    return PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
}

// Helper to get puzzle by ID
export function getPuzzleById(id) {
    return PUZZLES.find(p => p.id === id);
}

// Helper to get clue for a specific player index
export function getClueForPlayer(puzzle, playerIndex) {
    return puzzle.clues[playerIndex % puzzle.clues.length];
}
