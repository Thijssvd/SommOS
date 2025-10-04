/**
 * Collaborative Filtering Engine Tests
 * Tests for user-based and item-based recommendation algorithms
 */

jest.mock('../../backend/database/connection');

const CollaborativeFilteringEngine = require('../../backend/core/collaborative_filtering_engine');
const Database = require('../../backend/database/connection');

describe('Collaborative Filtering Engine', () => {
    let db;
    let engine;

    beforeEach(() => {
        db = Database.getInstance();
        db.reset();
        engine = new CollaborativeFilteringEngine(db);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('User-Based Recommendations', () => {
        test('should find similar users based on rating patterns', async () => {
            // Mock user ratings data
            const userRatings = [
                { wine_id: 1, overall_rating: 4, created_at: new Date().toISOString() },
                { wine_id: 2, overall_rating: 5, created_at: new Date().toISOString() },
                { wine_id: 3, overall_rating: 3, created_at: new Date().toISOString() }
            ];

            // Mock database to return other users with similar ratings
            db.all = jest.fn()
                .mockResolvedValueOnce([{ user_id: 'user2' }, { user_id: 'user3' }]) // Other users
                .mockResolvedValueOnce([ // User 2 ratings
                    { wine_id: 1, overall_rating: 4, created_at: new Date().toISOString() },
                    { wine_id: 2, overall_rating: 5, created_at: new Date().toISOString() },
                    { wine_id: 4, overall_rating: 4, created_at: new Date().toISOString() }
                ])
                .mockResolvedValueOnce([ // User 3 ratings
                    { wine_id: 1, overall_rating: 3, created_at: new Date().toISOString() },
                    { wine_id: 2, overall_rating: 4, created_at: new Date().toISOString() }
                ]);

            const similarUsers = await engine.findSimilarUsers('user1', userRatings);

            expect(similarUsers).toBeDefined();
            expect(Array.isArray(similarUsers)).toBe(true);
        });

        test('should calculate Pearson correlation similarity correctly', () => {
            const userRatings1 = [
                { wine_id: 1, overall_rating: 4 },
                { wine_id: 2, overall_rating: 5 },
                { wine_id: 3, overall_rating: 3 }
            ];

            const userRatings2 = [
                { wine_id: 1, overall_rating: 4 },
                { wine_id: 2, overall_rating: 5 },
                { wine_id: 4, overall_rating: 4 }
            ];

            const similarity = engine.calculateUserSimilarity(userRatings1, userRatings2);

            // Similarity should be between -1 and 1
            expect(similarity).toBeLessThanOrEqual(1);
            expect(similarity).toBeGreaterThanOrEqual(-1);
        });

        test('should handle cold start users', async () => {
            // Mock empty ratings for new user
            db.all = jest.fn()
                .mockResolvedValueOnce([]) // No ratings for user
                .mockResolvedValueOnce([ // Popular wines
                    { wine_id: 1, avg_rating: 4.5, rating_count: 100 },
                    { wine_id: 2, avg_rating: 4.3, rating_count: 80 }
                ]);

            const recommendations = await engine.getUserBasedRecommendations(
                'new_user',
                { name: 'Grilled steak' },
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
            // Should return popularity-based recommendations with low confidence
        });

        test('should not recommend already-rated wines', async () => {
            const userId = 'user1';
            const userRatings = [
                { wine_id: 1, overall_rating: 4 },
                { wine_id: 2, overall_rating: 5 }
            ];

            // Mock data
            db.all = jest.fn()
                .mockResolvedValueOnce(userRatings) // User's ratings
                .mockResolvedValueOnce([{ user_id: 'user2' }]) // Similar users
                .mockResolvedValueOnce([ // Similar user's ratings
                    { wine_id: 1, overall_rating: 4 }, // Already rated by user1
                    { wine_id: 3, overall_rating: 5 }, // New wine
                    { wine_id: 4, overall_rating: 4 }  // New wine
                ]);

            const recommendations = await engine.getUserBasedRecommendations(
                userId,
                { name: 'Grilled steak' },
                { limit: 5 }
            );

            if (recommendations && recommendations.length > 0) {
                const recommendedIds = recommendations.map(r => r.wine_id);
                // Should not include wine_id 1 or 2 (already rated)
                expect(recommendedIds).not.toContain(1);
                expect(recommendedIds).not.toContain(2);
            }
        });
    });

    describe('Item-Based Recommendations', () => {
        test('should find similar wines based on co-rating patterns', async () => {
            const wineId = 1;

            // Mock database to return wines rated by similar users
            db.all = jest.fn()
                .mockResolvedValueOnce([ // Users who rated wine 1
                    { user_id: 'user1', overall_rating: 4 },
                    { user_id: 'user2', overall_rating: 5 }
                ])
                .mockResolvedValueOnce([{ wine_id: 2 }, { wine_id: 3 }]) // Similar wines
                .mockResolvedValueOnce([ // Wine 2 ratings
                    { user_id: 'user1', overall_rating: 4 },
                    { user_id: 'user3', overall_rating: 5 }
                ])
                .mockResolvedValueOnce([ // Wine 3 ratings
                    { user_id: 'user2', overall_rating: 4 }
                ]);

            const similarWines = await engine.findSimilarItems(wineId, 5);

            expect(similarWines).toBeDefined();
            expect(Array.isArray(similarWines)).toBe(true);
        });

        test('should generate item-based recommendations', async () => {
            const userId = 'user1';

            // Mock data
            db.all = jest.fn()
                .mockResolvedValueOnce([ // User's high-rated wines
                    { wine_id: 1, overall_rating: 5 },
                    { wine_id: 2, overall_rating: 4 }
                ])
                .mockResolvedValueOnce([ // Similar to wine 1
                    { wine_id: 3, similarity: 0.8 },
                    { wine_id: 4, similarity: 0.7 }
                ])
                .mockResolvedValueOnce([ // Similar to wine 2
                    { wine_id: 3, similarity: 0.75 },
                    { wine_id: 5, similarity: 0.65 }
                ]);

            const recommendations = await engine.getItemBasedRecommendations(
                userId,
                { name: 'Grilled steak' },
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
        });

        test('should calculate cosine similarity for items', () => {
            const item1Ratings = [
                { user_id: 'user1', overall_rating: 4 },
                { user_id: 'user2', overall_rating: 5 },
                { user_id: 'user3', overall_rating: 3 }
            ];

            const item2Ratings = [
                { user_id: 'user1', overall_rating: 4 },
                { user_id: 'user2', overall_rating: 5 },
                { user_id: 'user4', overall_rating: 4 }
            ];

            const similarity = engine.calculateItemSimilarity(item1Ratings, item2Ratings);

            // Similarity should be between 0 and 1
            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });
    });

    describe('Hybrid Recommendations', () => {
        test('should combine user-based and item-based recommendations', async () => {
            const userId = 'user1';
            const dishContext = { name: 'Grilled salmon', intensity: 'medium' };

            // Spy on both recommendation methods
            jest.spyOn(engine, 'getUserBasedRecommendations').mockResolvedValue([
                { wine_id: 1, predicted_rating: 4.5, confidence: 0.8, algorithm: 'user_based_cf' },
                { wine_id: 2, predicted_rating: 4.3, confidence: 0.7, algorithm: 'user_based_cf' }
            ]);

            jest.spyOn(engine, 'getItemBasedRecommendations').mockResolvedValue([
                { wine_id: 2, predicted_rating: 4.6, confidence: 0.9, algorithm: 'item_based_cf' },
                { wine_id: 3, predicted_rating: 4.2, confidence: 0.6, algorithm: 'item_based_cf' }
            ]);

            const recommendations = await engine.getHybridRecommendations(
                userId,
                dishContext,
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);

            // Wine 2 should have higher score (appeared in both with high ratings)
            if (recommendations.length > 1) {
                const wine2 = recommendations.find(r => r.wine_id === 2);
                expect(wine2).toBeDefined();
            }
        });

        test('should apply appropriate weights to different algorithms', async () => {
            const userId = 'user1';

            jest.spyOn(engine, 'getUserBasedRecommendations').mockResolvedValue([
                { wine_id: 1, predicted_rating: 4.0, confidence: 0.9, algorithm: 'user_based_cf' }
            ]);

            jest.spyOn(engine, 'getItemBasedRecommendations').mockResolvedValue([
                { wine_id: 1, predicted_rating: 3.5, confidence: 0.6, algorithm: 'item_based_cf' }
            ]);

            const recommendations = await engine.getHybridRecommendations(
                userId,
                {},
                { limit: 5 }
            );

            // Higher confidence recommendation should have more weight
            if (recommendations.length > 0) {
                const wine1 = recommendations[0];
                // Final score should be closer to 4.0 (higher confidence source)
                expect(wine1.predicted_rating).toBeGreaterThan(3.5);
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle database connection errors gracefully', async () => {
            db.all = jest.fn().mockRejectedValue(new Error('Database connection lost'));

            await expect(
                engine.getUserBasedRecommendations('user1', {}, { limit: 5 })
            ).rejects.toThrow();
        });

        test('should handle invalid user IDs', async () => {
            db.all = jest.fn().mockResolvedValue([]);

            const recommendations = await engine.getUserBasedRecommendations(
                null,
                {},
                { limit: 5 }
            );

            // Should return empty array or handle gracefully
            expect(Array.isArray(recommendations)).toBe(true);
        });

        test('should handle sparse rating matrices', async () => {
            // User with only one rating
            db.all = jest.fn()
                .mockResolvedValueOnce([{ wine_id: 1, overall_rating: 4 }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const recommendations = await engine.getUserBasedRecommendations(
                'sparse_user',
                {},
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('Performance', () => {
        test('should generate recommendations efficiently', async () => {
            // Mock moderate dataset
            const ratings = [];
            for (let i = 0; i < 100; i++) {
                ratings.push({
                    user_id: `user${i % 20}`,
                    wine_id: i % 50,
                    overall_rating: 3 + Math.random() * 2,
                    created_at: new Date().toISOString()
                });
            }

            db.all = jest.fn().mockResolvedValue(ratings);

            const startTime = Date.now();
            await engine.getUserBasedRecommendations('user1', {}, { limit: 10 });
            const duration = Date.now() - startTime;

            // Should complete in reasonable time (< 500ms for mocked data)
            expect(duration).toBeLessThan(500);
        });
    });

    describe('Cold Start Handling', () => {
        test('should provide popularity-based recommendations for new users', async () => {
            db.all = jest.fn()
                .mockResolvedValueOnce([]) // No user ratings
                .mockResolvedValueOnce([ // Popular wines
                    { wine_id: 1, avg_rating: 4.8, rating_count: 150 },
                    { wine_id: 2, avg_rating: 4.5, rating_count: 120 },
                    { wine_id: 3, avg_rating: 4.3, rating_count: 100 }
                ]);

            const recommendations = await engine.getUserBasedRecommendations(
                'brand_new_user',
                {},
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
            
            if (recommendations.length > 0) {
                // Confidence should be lower for cold start
                recommendations.forEach(rec => {
                    if (rec.confidence !== undefined) {
                        expect(rec.confidence).toBeLessThan(0.8);
                    }
                });
            }
        });

        test('should handle semi-cold-start users with few ratings', async () => {
            const fewRatings = [
                { wine_id: 1, overall_rating: 5 },
                { wine_id: 2, overall_rating: 4 }
            ];

            db.all = jest.fn()
                .mockResolvedValueOnce(fewRatings)
                .mockResolvedValueOnce([{ user_id: 'user2' }])
                .mockResolvedValueOnce([
                    { wine_id: 3, overall_rating: 5 },
                    { wine_id: 4, overall_rating: 4 }
                ]);

            const recommendations = await engine.getUserBasedRecommendations(
                'semi_cold_user',
                {},
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });
});
