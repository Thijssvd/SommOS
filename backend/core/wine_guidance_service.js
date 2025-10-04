'use strict';

/**
 * Wine Guidance Service
 * Provides storage temperature and decanting recommendations for wines based on
 * wine type, style, and grape varieties.
 */

const BASE_GUIDANCE = {
    Red: {
        storage: { minC: 12, maxC: 16, note: 'Cellar temperature preserves structure and slows development.' },
        decant: { shouldDecant: true, minMinutes: 45, maxMinutes: 60, note: 'Aeration softens tannins and reveals aromatics.' }
    },
    White: {
        storage: { minC: 8, maxC: 12, note: 'Cool storage protects freshness and acidity.' },
        decant: { shouldDecant: false, note: 'Serve chilled straight from the bottle.' }
    },
    Rosé: {
        storage: { minC: 8, maxC: 10, note: 'Cooler storage keeps rosé vibrant and crisp.' },
        decant: { shouldDecant: false, note: 'Decanting typically unnecessary for rosé.' }
    },
    Sparkling: {
        storage: { minC: 6, maxC: 8, note: 'Keep very cold to preserve mousse and precision.' },
        decant: { shouldDecant: false, note: 'No decanting required; avoid to maintain carbonation.' }
    },
    Dessert: {
        storage: { minC: 10, maxC: 12, note: 'Slightly cool storage balances sweetness and freshness.' },
        decant: { shouldDecant: false, note: 'Decanting rarely required for dessert wines.' }
    },
    Fortified: {
        storage: { minC: 14, maxC: 18, note: 'Slightly warmer storage keeps fortified wines expressive.' },
        decant: { shouldDecant: true, minMinutes: 30, maxMinutes: 45, note: 'Decanting vintage styles removes sediment and opens aromas.' }
    },
    default: {
        storage: { minC: 10, maxC: 14, note: 'Store in a stable, cool environment away from light.' },
        decant: { shouldDecant: false, note: 'Decanting optional depending on structure and age.' }
    }
};

const STYLE_GUIDANCE = {
    'Full-bodied': {
        storage: { minC: 13, maxC: 16 },
        decant: { shouldDecant: true, minMinutes: 45, maxMinutes: 60 }
    },
    'Medium-bodied': {
        decant: { shouldDecant: true, minMinutes: 30, maxMinutes: 45 }
    },
    'Light-bodied': {
        storage: { minC: 11, maxC: 13 },
        decant: { shouldDecant: false }
    }
};

const GRAPE_GUIDANCE = {
    'cabernet sauvignon': {
        storage: { minC: 13, maxC: 16 },
        decant: { shouldDecant: true, minMinutes: 60, maxMinutes: 90, note: 'Give Cabernet ample time to soften powerful tannins.' }
    },
    'merlot': {
        decant: { shouldDecant: true, minMinutes: 30, maxMinutes: 45, note: 'Short aeration enhances Merlot\'s plush fruit.' }
    },
    'cabernet franc': {
        decant: { shouldDecant: true, minMinutes: 45, maxMinutes: 60 }
    },
    'malbec': {
        decant: { shouldDecant: true, minMinutes: 45, maxMinutes: 60 }
    },
    'pinot noir': {
        storage: { minC: 12, maxC: 14 },
        decant: { shouldDecant: true, minMinutes: 30, maxMinutes: 45, note: 'Gentle decanting awakens delicate aromatics.' }
    },
    'nebbiolo': {
        storage: { minC: 12, maxC: 15 },
        decant: { shouldDecant: true, minMinutes: 90, maxMinutes: 120, note: 'Extended decanting tames Nebbiolo\'s firm tannins.' }
    },
    'sangiovese': {
        decant: { shouldDecant: true, minMinutes: 45, maxMinutes: 60 }
    },
    'tempranillo': {
        decant: { shouldDecant: true, minMinutes: 45, maxMinutes: 60 }
    },
    'syrah': {
        decant: { shouldDecant: true, minMinutes: 45, maxMinutes: 75 }
    },
    'grenache': {
        decant: { shouldDecant: true, minMinutes: 30, maxMinutes: 45 }
    },
    'mourvedre': {
        decant: { shouldDecant: true, minMinutes: 60, maxMinutes: 90 }
    },
    'barbera': {
        decant: { shouldDecant: true, minMinutes: 30, maxMinutes: 45 }
    },
    'zinfandel': {
        decant: { shouldDecant: true, minMinutes: 30, maxMinutes: 45 }
    },
    'riesling': {
        storage: { minC: 8, maxC: 10 },
        decant: { shouldDecant: false, note: 'Serve chilled; decanting unnecessary.' }
    },
    'chardonnay': {
        storage: { minC: 10, maxC: 13 },
        decant: { shouldDecant: false, note: 'Brief aeration optional for richer styles.' }
    },
    'sauvignon blanc': {
        storage: { minC: 8, maxC: 10 },
        decant: { shouldDecant: false, note: 'Serve crisp and chilled without decanting.' }
    },
    'chenin blanc': {
        storage: { minC: 9, maxC: 11 },
        decant: { shouldDecant: false }
    },
    'viognier': {
        storage: { minC: 10, maxC: 12 },
        decant: { shouldDecant: true, minMinutes: 20, maxMinutes: 30, note: 'Brief aeration unlocks Viognier\'s aromatics.' }
    },
    'port': {
        storage: { minC: 14, maxC: 18 },
        decant: { shouldDecant: true, minMinutes: 60, maxMinutes: 120, note: 'Decant to remove sediment and encourage aromatics.' }
    },
    'champagne': {
        storage: { minC: 6, maxC: 8 },
        decant: { shouldDecant: false, note: 'Never decant sparkling wine to preserve bubbles.' }
    }
};

function toNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function toFahrenheit(celsius) {
    if (celsius === null || celsius === undefined) {
        return null;
    }
    return Math.round((Number(celsius) * 9) / 5 + 32);
}

function mergeGuidance(base = {}, override = {}) {
    if (!override) {
        return { ...base };
    }

    return {
        ...base,
        ...Object.fromEntries(
            Object.entries(override).filter(([, value]) => value !== undefined && value !== null)
        )
    };
}

function parseGrapeVarieties(grapeVarieties) {
    if (!grapeVarieties) {
        return [];
    }

    if (Array.isArray(grapeVarieties)) {
        return grapeVarieties;
    }

    if (typeof grapeVarieties === 'string') {
        try {
            if (grapeVarieties.trim().startsWith('[')) {
                return JSON.parse(grapeVarieties);
            }
            return grapeVarieties.split(',').map(grape => grape.trim());
        } catch (error) {
            return [grapeVarieties];
        }
    }

    return [];
}

function getGuidance(wine = {}) {
    const wineType = wine.wine_type && BASE_GUIDANCE[wine.wine_type]
        ? wine.wine_type
        : 'default';

    let storage = { ...BASE_GUIDANCE[wineType].storage };
    let decant = { ...BASE_GUIDANCE[wineType].decant };

    if (wine.style && STYLE_GUIDANCE[wine.style]) {
        storage = mergeGuidance(storage, STYLE_GUIDANCE[wine.style].storage);
        decant = mergeGuidance(decant, STYLE_GUIDANCE[wine.style].decant);
    }

    const grapes = parseGrapeVarieties(wine.grape_varieties);
    // For each grape, select the longest decant time (maximum) and tightest storage range
    let maxDecantMin = decant.minMinutes;
    let maxDecantMax = decant.maxMinutes;
    let bestDecantNote = decant.note;
    
    for (const grape of grapes) {
        const key = grape.toLowerCase();
        if (GRAPE_GUIDANCE[key]) {
            // Only apply grape storage guidance for non-sparkling, non-dessert wines
            // (Sparkling and Dessert wine types should take precedence)
            if (wineType !== 'Sparkling' && wineType !== 'Dessert' && wineType !== 'Rosé') {
                storage = mergeGuidance(storage, GRAPE_GUIDANCE[key].storage);
            }
            
            // For decanting, use the longest time from any grape variety
            // BUT only if the base wine type says to decant
            const grapeDecant = GRAPE_GUIDANCE[key].decant;
            if (grapeDecant && decant.shouldDecant) {
                if (grapeDecant.shouldDecant !== undefined) {
                    // If any grape says to decant and base wine type also says to decant
                    if (grapeDecant.shouldDecant && decant.shouldDecant) {
                        decant.shouldDecant = true;
                    }
                }
                
                if (grapeDecant.minMinutes && (!maxDecantMin || grapeDecant.minMinutes > maxDecantMin)) {
                    maxDecantMin = grapeDecant.minMinutes;
                    bestDecantNote = grapeDecant.note || bestDecantNote;
                }
                if (grapeDecant.maxMinutes && (!maxDecantMax || grapeDecant.maxMinutes > maxDecantMax)) {
                    maxDecantMax = grapeDecant.maxMinutes;
                }
            }
        }
    }
    
    // Apply the selected decant times
    if (maxDecantMin) decant.minMinutes = maxDecantMin;
    if (maxDecantMax) decant.maxMinutes = maxDecantMax;
    if (bestDecantNote) decant.note = bestDecantNote;

    const explicitMin = toNumber(wine.storage_temp_min);
    const explicitMax = toNumber(wine.storage_temp_max);

    const storageMinC = explicitMin ?? storage?.minC ?? null;
    const storageMaxC = explicitMax ?? storage?.maxC ?? null;
    const storageNote = wine.storage_recommendation || storage?.note || null;

    const shouldDecant = typeof wine.should_decant === 'boolean'
        ? wine.should_decant
        : (decant?.shouldDecant ?? false);

    const explicitDecantMin = toNumber(wine.decanting_time_minutes_min);
    const explicitDecantMax = toNumber(wine.decanting_time_minutes_max);

    const decantMin = explicitDecantMin ?? decant?.minMinutes ?? decant?.minutes ?? null;
    const decantMax = explicitDecantMax ?? decant?.maxMinutes ?? decant?.minutes ?? null;

    let decantNote = wine.decanting_recommendation || decant?.note || null;

    if (!decantNote) {
        if (shouldDecant) {
            if (decantMin && decantMax && decantMin !== decantMax) {
                decantNote = `Decant for ${decantMin}-${decantMax} minutes before serving.`;
            } else if (decantMin) {
                decantNote = `Decant for about ${decantMin} minutes before serving.`;
            } else {
                decantNote = 'Decant before serving to allow the wine to open up.';
            }
        } else {
            decantNote = 'No decanting required; serve directly from the bottle.';
        }
    }

    const storageRecommendation = storageNote || (storageMinC && storageMaxC
        ? `Store at ${storageMinC}-${storageMaxC}°C in a dark, humidity-controlled environment.`
        : 'Store in a cool, dark place away from vibration.');

    return {
        storage_temp_min: storageMinC,
        storage_temp_max: storageMaxC,
        storage_temp_min_f: storageMinC !== null ? toFahrenheit(storageMinC) : null,
        storage_temp_max_f: storageMaxC !== null ? toFahrenheit(storageMaxC) : null,
        storage_recommendation: storageRecommendation,
        should_decant: shouldDecant,
        decanting_time_minutes_min: decantMin,
        decanting_time_minutes_max: decantMax,
        decanting_recommendation: decantNote
    };
}

module.exports = {
    getGuidance
};
