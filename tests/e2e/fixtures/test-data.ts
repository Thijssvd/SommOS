/**
 * Test data factories for generating deterministic test data
 */

export interface WineTestData {
  producer: string;
  wine_name: string;
  vintage: number;
  type: string;
  region: string;
  country: string;
  quantity: number;
  location: string;
  unit_price?: number;
}

export interface PairingTestData {
  dish: string;
  occasion: string;
  guestCount: number;
}

/**
 * Predefined wine test data for consistent testing
 */
export const TEST_WINES: Record<string, WineTestData> = {
  redBordeaux: {
    producer: 'Château Margaux',
    wine_name: 'Grand Vin',
    vintage: 2015,
    type: 'Red',
    region: 'Bordeaux',
    country: 'France',
    quantity: 12,
    location: 'main-cellar',
    unit_price: 850.00,
  },
  whiteBurgundy: {
    producer: 'Domaine Leflaive',
    wine_name: 'Puligny-Montrachet',
    vintage: 2018,
    type: 'White',
    region: 'Burgundy',
    country: 'France',
    quantity: 6,
    location: 'service-bar',
    unit_price: 220.00,
  },
  champagne: {
    producer: 'Dom Pérignon',
    wine_name: 'Brut',
    vintage: 2012,
    type: 'Sparkling',
    region: 'Champagne',
    country: 'France',
    quantity: 24,
    location: 'service-bar',
    unit_price: 195.00,
  },
  italianBarolo: {
    producer: 'Gaja',
    wine_name: 'Barolo Sperss',
    vintage: 2016,
    type: 'Red',
    region: 'Piedmont',
    country: 'Italy',
    quantity: 8,
    location: 'private-reserve',
    unit_price: 425.00,
  },
  californiaChardonnay: {
    producer: 'Kistler',
    wine_name: 'Les Noisetiers',
    vintage: 2019,
    type: 'White',
    region: 'Sonoma Coast',
    country: 'USA',
    quantity: 10,
    location: 'main-cellar',
    unit_price: 135.00,
  },
  portWine: {
    producer: 'Taylor Fladgate',
    wine_name: 'Vintage Port',
    vintage: 2000,
    type: 'Fortified',
    region: 'Douro',
    country: 'Portugal',
    quantity: 4,
    location: 'private-reserve',
    unit_price: 285.00,
  },
};

/**
 * Predefined pairing test scenarios
 */
export const TEST_PAIRINGS: Record<string, PairingTestData> = {
  steakDinner: {
    dish: 'Grilled Wagyu beef with truffle butter',
    occasion: 'Dinner',
    guestCount: 4,
  },
  seafoodLunch: {
    dish: 'Fresh Mediterranean sea bass with lemon and herbs',
    occasion: 'Lunch',
    guestCount: 6,
  },
  celebration: {
    dish: 'Oysters and caviar',
    occasion: 'Celebration',
    guestCount: 8,
  },
  dessert: {
    dish: 'Chocolate soufflé with raspberry coulis',
    occasion: 'Dessert',
    guestCount: 2,
  },
};

/**
 * Wine locations
 */
export const WINE_LOCATIONS = {
  mainCellar: 'main-cellar',
  serviceBar: 'service-bar',
  deckStorage: 'deck-storage',
  privateReserve: 'private-reserve',
} as const;

/**
 * Wine types
 */
export const WINE_TYPES = {
  red: 'Red',
  white: 'White',
  sparkling: 'Sparkling',
  rose: 'Rosé',
  dessert: 'Dessert',
  fortified: 'Fortified',
} as const;

/**
 * Generate a random wine for testing
 */
export function generateRandomWine(overrides?: Partial<WineTestData>): WineTestData {
  const producers = ['Test Estate', 'Mock Vineyards', 'E2E Winery', 'Automation Cellars'];
  const wines = ['Reserve', 'Grand Cru', 'Premium Selection', 'Special Edition'];
  const regions = ['Test Region', 'Mock Valley', 'E2E Hills', 'Automation Coast'];
  const countries = ['France', 'Italy', 'USA', 'Spain', 'Australia'];
  const types = Object.values(WINE_TYPES);
  const locations = Object.values(WINE_LOCATIONS);
  
  const randomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  return {
    producer: randomElement(producers),
    wine_name: randomElement(wines),
    vintage: 2015 + Math.floor(Math.random() * 8), // 2015-2022
    type: randomElement(types),
    region: randomElement(regions),
    country: randomElement(countries),
    quantity: 1 + Math.floor(Math.random() * 20),
    location: randomElement(locations),
    unit_price: 50 + Math.floor(Math.random() * 450),
    ...overrides,
  };
}

/**
 * Generate multiple test wines
 */
export function generateTestWineList(count: number): WineTestData[] {
  return Array.from({ length: count }, (_, i) => generateRandomWine({
    wine_name: `Test Wine ${i + 1}`,
  }));
}

/**
 * Seeded random number generator for deterministic tests
 */
export class SeededRandom {
  private seed: number;
  
  constructor(seed: number = 12345) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

/**
 * Generate deterministic wine data using seeded random
 */
export function generateDeterministicWine(seed: number, overrides?: Partial<WineTestData>): WineTestData {
  const rng = new SeededRandom(seed);
  
  const producers = ['Test Estate', 'Mock Vineyards', 'E2E Winery', 'Automation Cellars'];
  const wines = ['Reserve', 'Grand Cru', 'Premium Selection', 'Special Edition'];
  const regions = ['Test Region', 'Mock Valley', 'E2E Hills', 'Automation Coast'];
  const countries = ['France', 'Italy', 'USA', 'Spain', 'Australia'];
  const types = Object.values(WINE_TYPES);
  const locations = Object.values(WINE_LOCATIONS);
  
  return {
    producer: rng.choice(producers),
    wine_name: rng.choice(wines),
    vintage: rng.nextInt(2015, 2022),
    type: rng.choice(types),
    region: rng.choice(regions),
    country: rng.choice(countries),
    quantity: rng.nextInt(1, 20),
    location: rng.choice(locations),
    unit_price: rng.nextInt(50, 500),
    ...overrides,
  };
}
