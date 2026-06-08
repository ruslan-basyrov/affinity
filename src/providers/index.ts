import type { AffinitySettings } from '../settings';
import { ChatProvider } from './types';
import { OpenAICompatibleProvider } from './openai-compatible';

export * from './types';

export type ProviderId = 'featherless' | 'custom';

export interface ProviderInfo {
	id: ProviderId;
	name: string;
	defaultBaseUrl: string;
	defaultModel: string;
}

/** Registry of known providers. Add a new entry here to offer another backend. */
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
	featherless: {
		id: 'featherless',
		name: 'Featherless',
		defaultBaseUrl: 'https://api.featherless.ai/v1',
		defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
	},
	custom: {
		id: 'custom',
		name: 'Custom (OpenAI-compatible)',
		defaultBaseUrl: '',
		defaultModel: '',
	},
};

/** Build the chat provider for the currently selected backend. */
export function createProvider(settings: AffinitySettings): ChatProvider {
	const info = PROVIDERS[settings.activeProvider];
	const config = settings.providers[settings.activeProvider];

	// Every provider here speaks the OpenAI-compatible protocol; a provider
	// with a different API (e.g. Anthropic's messages endpoint) would branch
	// on `info.id` and return a different ChatProvider implementation.
	return new OpenAICompatibleProvider({
		label: info.name,
		baseUrl: config.baseUrl || info.defaultBaseUrl,
		apiKey: config.apiKey,
		model: config.model || info.defaultModel,
	});
}