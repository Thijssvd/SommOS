class PairingEngine {
    async generatePairings(dish, context = {}) {
        return [
            {
                wine: {
                    id: 'test-wine-1',
                    vintage_id: 'test-vintage-1',
                    name: 'Château Test Bordeaux',
                    producer: 'Test Château',
                    year: 2020,
                    wine_type: 'Red',
                    region: 'Bordeaux',
                    quantity: 6,
                    location: 'main-cellar'
                },
                score: {
                    total: 0.92,
                    style_match: 0.9,
                    flavor_harmony: 0.95,
                    confidence: 0.9
                },
                reasoning: `Balanced structure complements ${dish}.`,
                ai_enhanced: true
            }
        ];
    }

    async quickPairing(dish) {
        return [
            {
                wine: 'Maison Test Champagne 2019',
                confidence: 0.85,
                reason: `Sparkling freshness makes an elegant match for ${dish}.`
            }
        ];
    }
}

module.exports = PairingEngine;
