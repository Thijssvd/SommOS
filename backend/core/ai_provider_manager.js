    initialize() {
        if (this.initialized) {
            return;
        }

        // Validate and initialize DeepSeek (primary)
        if (this.config.deepSeek && this.config.deepSeek.apiKey) {
            // Ensure key starts with 'sk-'
            const apiKey = this.config.deepSeek.apiKey.startsWith('sk-') 
                ? this.config.deepSeek.apiKey 
                : 'sk-' + this.config.deepSeek.apiKey;
                
            try {
                this.providers.set('deepseek', new OpenAI({
                    apiKey,
                    baseURL: 'https://api.deepseek.com/v1',
                    timeout: this.thresholds.maxTimeout,
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }));
                this.fallbackChain.push('deepseek');
                console.log('✅ DeepSeek provider initialized (primary)');
            } catch (error) {
                console.error('Failed to initialize DeepSeek provider:', error.message);
            }
        }
