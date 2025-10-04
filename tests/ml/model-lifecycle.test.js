/**
 * ML Model Lifecycle Tests
 * Tests for model loading, versioning, persistence, and fallback mechanisms
 */

const ModelManager = require('../../backend/ml/model_manager');
const ModelRegistry = require('../../backend/ml/model_registry');
const fs = require('fs').promises;
const path = require('path');

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        access: jest.fn(),
        mkdir: jest.fn(),
        readdir: jest.fn(),
        stat: jest.fn()
    }
}));

describe('ML Model Manager', () => {
    let modelManager;

    beforeEach(() => {
        modelManager = new ModelManager();
        jest.clearAllMocks();
    });

    describe('Model Loading', () => {
        test('should load model from file', async () => {
            const mockModelData = JSON.stringify({
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                metadata: { trained_at: '2024-01-01' }
            });

            fs.readFile.mockResolvedValue(mockModelData);
            fs.access.mockResolvedValue(undefined);

            const model = await modelManager.loadModel('collaborative_filtering', '1.0.0');

            expect(model).toBeDefined();
            expect(model.version).toBe('1.0.0');
            expect(fs.readFile).toHaveBeenCalled();
        });

        test('should handle missing model files', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT: no such file'));

            await expect(
                modelManager.loadModel('non_existent_model', '1.0.0')
            ).rejects.toThrow();
        });

        test('should load latest version when no version specified', async () => {
            fs.readdir.mockResolvedValue([
                'model-v1.0.0.json',
                'model-v1.1.0.json',
                'model-v2.0.0.json'
            ]);

            fs.readFile.mockResolvedValue(JSON.stringify({
                version: '2.0.0',
                type: 'content_based'
            }));

            fs.access.mockResolvedValue(undefined);

            const model = await modelManager.loadModel('content_based');

            expect(model.version).toBe('2.0.0');
        });

        test('should validate model schema on load', async () => {
            const invalidModelData = JSON.stringify({
                // Missing required fields
                weights: [0.5, 0.3]
            });

            fs.readFile.mockResolvedValue(invalidModelData);
            fs.access.mockResolvedValue(undefined);

            await expect(
                modelManager.loadModel('invalid_model', '1.0.0')
            ).rejects.toThrow(/schema|validation/i);
        });

        test('should handle corrupted model files', async () => {
            fs.readFile.mockResolvedValue('{ invalid json }');
            fs.access.mockResolvedValue(undefined);

            await expect(
                modelManager.loadModel('corrupted_model', '1.0.0')
            ).rejects.toThrow();
        });
    });

    describe('Model Versioning', () => {
        test('should create new version on save', async () => {
            const model = {
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                metadata: { trained_at: new Date().toISOString() }
            };

            fs.writeFile.mockResolvedValue(undefined);
            fs.mkdir.mockResolvedValue(undefined);

            const version = await modelManager.saveModel(model);

            expect(version).toMatch(/^\d+\.\d+\.\d+$/); // SemVer format
            expect(fs.writeFile).toHaveBeenCalled();
        });

        test('should increment patch version for minor updates', async () => {
            const existingVersions = ['1.0.0', '1.0.1', '1.0.2'];
            fs.readdir.mockResolvedValue(
                existingVersions.map(v => `model-v${v}.json`)
            );

            const model = {
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2]
            };

            fs.writeFile.mockResolvedValue(undefined);
            fs.mkdir.mockResolvedValue(undefined);

            const version = await modelManager.saveModel(model, { updateType: 'patch' });

            expect(version).toBe('1.0.3');
        });

        test('should increment minor version for feature updates', async () => {
            const existingVersions = ['1.0.0', '1.1.0'];
            fs.readdir.mockResolvedValue(
                existingVersions.map(v => `model-v${v}.json`)
            );

            const model = {
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                new_feature: true
            };

            fs.writeFile.mockResolvedValue(undefined);
            fs.mkdir.mockResolvedValue(undefined);

            const version = await modelManager.saveModel(model, { updateType: 'minor' });

            expect(version).toBe('1.2.0');
        });

        test('should increment major version for breaking changes', async () => {
            const existingVersions = ['1.0.0', '2.0.0'];
            fs.readdir.mockResolvedValue(
                existingVersions.map(v => `model-v${v}.json`)
            );

            const model = {
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                breaking_change: true
            };

            fs.writeFile.mockResolvedValue(undefined);
            fs.mkdir.mockResolvedValue(undefined);

            const version = await modelManager.saveModel(model, { updateType: 'major' });

            expect(version).toBe('3.0.0');
        });

        test('should list all available versions', async () => {
            fs.readdir.mockResolvedValue([
                'model-v1.0.0.json',
                'model-v1.1.0.json',
                'model-v2.0.0.json',
                'other-file.txt'
            ]);

            const versions = await modelManager.listVersions('collaborative_filtering');

            expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
            expect(versions).not.toContain('other-file.txt');
        });

        test('should compare versions correctly', () => {
            expect(modelManager.compareVersions('1.0.0', '1.0.1')).toBe(-1);
            expect(modelManager.compareVersions('2.0.0', '1.9.9')).toBe(1);
            expect(modelManager.compareVersions('1.5.0', '1.5.0')).toBe(0);
        });
    });

    describe('Model Fallback', () => {
        test('should fallback to previous version on load failure', async () => {
            fs.readdir.mockResolvedValue([
                'model-v1.0.0.json',
                'model-v1.1.0.json',
                'model-v2.0.0.json'
            ]);

            // Fail on latest, succeed on previous
            fs.access
                .mockRejectedValueOnce(new Error('ENOENT'))
                .mockResolvedValueOnce(undefined);

            fs.readFile.mockResolvedValue(JSON.stringify({
                version: '1.1.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2]
            }));

            const model = await modelManager.loadModel('collaborative_filtering', {
                fallback: true
            });

            expect(model.version).toBe('1.1.0');
        });

        test('should use baseline model as last resort', async () => {
            fs.readdir.mockResolvedValue([]);
            fs.access.mockRejectedValue(new Error('ENOENT'));

            const model = await modelManager.loadModel('collaborative_filtering', {
                fallback: true,
                baseline: true
            });

            expect(model).toBeDefined();
            expect(model.version).toBe('baseline');
        });

        test('should log fallback attempts', async () => {
            const logSpy = jest.spyOn(console, 'warn').mockImplementation();

            fs.readdir.mockResolvedValue(['model-v1.0.0.json', 'model-v2.0.0.json']);
            fs.access
                .mockRejectedValueOnce(new Error('ENOENT'))
                .mockResolvedValueOnce(undefined);

            fs.readFile.mockResolvedValue(JSON.stringify({
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: []
            }));

            await modelManager.loadModel('collaborative_filtering', { fallback: true });

            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        test('should not fallback if disabled', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));

            await expect(
                modelManager.loadModel('collaborative_filtering', { fallback: false })
            ).rejects.toThrow();
        });
    });

    describe('Model Caching', () => {
        test('should cache loaded models', async () => {
            const mockModelData = JSON.stringify({
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2]
            });

            fs.readFile.mockResolvedValue(mockModelData);
            fs.access.mockResolvedValue(undefined);

            await modelManager.loadModel('collaborative_filtering', '1.0.0');
            await modelManager.loadModel('collaborative_filtering', '1.0.0');

            // Should only read file once
            expect(fs.readFile).toHaveBeenCalledTimes(1);
        });

        test('should invalidate cache on update', async () => {
            const mockModelData = JSON.stringify({
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2]
            });

            fs.readFile.mockResolvedValue(mockModelData);
            fs.access.mockResolvedValue(undefined);
            fs.writeFile.mockResolvedValue(undefined);
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['model-v1.0.0.json']);

            await modelManager.loadModel('collaborative_filtering', '1.0.0');
            await modelManager.saveModel({ type: 'collaborative_filtering' });
            await modelManager.loadModel('collaborative_filtering', '1.0.0');

            // Should re-read after save
            expect(fs.readFile).toHaveBeenCalledTimes(2);
        });

        test('should clear cache manually', async () => {
            const mockModelData = JSON.stringify({
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: []
            });

            fs.readFile.mockResolvedValue(mockModelData);
            fs.access.mockResolvedValue(undefined);

            await modelManager.loadModel('collaborative_filtering', '1.0.0');
            modelManager.clearCache();
            await modelManager.loadModel('collaborative_filtering', '1.0.0');

            expect(fs.readFile).toHaveBeenCalledTimes(2);
        });
    });

    describe('Model Metadata', () => {
        test('should store model training metadata', async () => {
            const model = {
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                metadata: {
                    trained_at: new Date().toISOString(),
                    dataset_size: 10000,
                    accuracy: 0.85,
                    hyperparameters: { learning_rate: 0.01 }
                }
            };

            fs.writeFile.mockResolvedValue(undefined);
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue([]);

            await modelManager.saveModel(model);

            const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
            expect(savedData.metadata).toBeDefined();
            expect(savedData.metadata.trained_at).toBeDefined();
            expect(savedData.metadata.accuracy).toBe(0.85);
        });

        test('should retrieve model metadata without loading model', async () => {
            const mockModelData = JSON.stringify({
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                metadata: {
                    trained_at: '2024-01-01',
                    accuracy: 0.85
                }
            });

            fs.readFile.mockResolvedValue(mockModelData);
            fs.access.mockResolvedValue(undefined);

            const metadata = await modelManager.getModelMetadata('collaborative_filtering', '1.0.0');

            expect(metadata.trained_at).toBe('2024-01-01');
            expect(metadata.accuracy).toBe(0.85);
        });
    });

    describe('Model Validation', () => {
        test('should validate model integrity on load', async () => {
            const model = {
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                checksum: 'abc123'
            };

            fs.readFile.mockResolvedValue(JSON.stringify(model));
            fs.access.mockResolvedValue(undefined);

            const loadedModel = await modelManager.loadModel('collaborative_filtering', '1.0.0', {
                validateChecksum: true
            });

            expect(loadedModel).toBeDefined();
        });

        test('should detect corrupted models via checksum', async () => {
            const model = {
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2],
                checksum: 'invalid_checksum'
            };

            fs.readFile.mockResolvedValue(JSON.stringify(model));
            fs.access.mockResolvedValue(undefined);

            // Mock checksum validation to fail
            jest.spyOn(modelManager, 'calculateChecksum').mockReturnValue('different_checksum');

            await expect(
                modelManager.loadModel('collaborative_filtering', '1.0.0', {
                    validateChecksum: true
                })
            ).rejects.toThrow(/checksum|corrupted/i);
        });
    });

    describe('Model Migration', () => {
        test('should migrate old model format to new format', async () => {
            const oldModel = {
                // Old format
                model_type: 'collaborative_filtering',
                model_weights: [0.5, 0.3, 0.2]
            };

            fs.readFile.mockResolvedValue(JSON.stringify(oldModel));
            fs.access.mockResolvedValue(undefined);

            const migratedModel = await modelManager.loadModel('collaborative_filtering', '0.9.0', {
                autoMigrate: true
            });

            // Should have new format
            expect(migratedModel.type).toBeDefined();
            expect(migratedModel.weights).toBeDefined();
        });

        test('should skip migration if not needed', async () => {
            const currentModel = {
                version: '1.0.0',
                type: 'collaborative_filtering',
                weights: [0.5, 0.3, 0.2]
            };

            fs.readFile.mockResolvedValue(JSON.stringify(currentModel));
            fs.access.mockResolvedValue(undefined);

            const model = await modelManager.loadModel('collaborative_filtering', '1.0.0', {
                autoMigrate: true
            });

            expect(model).toEqual(expect.objectContaining(currentModel));
        });
    });
});

describe('Model Registry', () => {
    let registry;

    beforeEach(() => {
        registry = new ModelRegistry();
        jest.clearAllMocks();
    });

    describe('Model Registration', () => {
        test('should register new model', () => {
            const model = {
                name: 'test_model',
                version: '1.0.0',
                type: 'collaborative_filtering'
            };

            registry.register(model);

            const registered = registry.get('test_model', '1.0.0');
            expect(registered).toEqual(model);
        });

        test('should prevent duplicate registrations', () => {
            const model = {
                name: 'test_model',
                version: '1.0.0',
                type: 'collaborative_filtering'
            };

            registry.register(model);

            expect(() => {
                registry.register(model);
            }).toThrow(/already registered/i);
        });

        test('should allow multiple versions of same model', () => {
            const model1 = { name: 'test_model', version: '1.0.0', type: 'cf' };
            const model2 = { name: 'test_model', version: '2.0.0', type: 'cf' };

            registry.register(model1);
            registry.register(model2);

            expect(registry.get('test_model', '1.0.0')).toEqual(model1);
            expect(registry.get('test_model', '2.0.0')).toEqual(model2);
        });
    });

    describe('Model Lookup', () => {
        test('should retrieve registered model', () => {
            const model = { name: 'test_model', version: '1.0.0', type: 'cf' };
            registry.register(model);

            const retrieved = registry.get('test_model', '1.0.0');
            expect(retrieved).toEqual(model);
        });

        test('should return null for unregistered model', () => {
            const retrieved = registry.get('non_existent', '1.0.0');
            expect(retrieved).toBeNull();
        });

        test('should list all models of a type', () => {
            registry.register({ name: 'cf_model', version: '1.0.0', type: 'collaborative_filtering' });
            registry.register({ name: 'cb_model', version: '1.0.0', type: 'content_based' });
            registry.register({ name: 'cf_model2', version: '1.0.0', type: 'collaborative_filtering' });

            const cfModels = registry.listByType('collaborative_filtering');
            expect(cfModels).toHaveLength(2);
        });
    });

    describe('Model Lifecycle', () => {
        test('should unregister model', () => {
            const model = { name: 'test_model', version: '1.0.0', type: 'cf' };
            registry.register(model);

            registry.unregister('test_model', '1.0.0');

            expect(registry.get('test_model', '1.0.0')).toBeNull();
        });

        test('should mark model as deprecated', () => {
            const model = { name: 'test_model', version: '1.0.0', type: 'cf' };
            registry.register(model);

            registry.deprecate('test_model', '1.0.0');

            const retrieved = registry.get('test_model', '1.0.0');
            expect(retrieved.deprecated).toBe(true);
        });
    });
});
