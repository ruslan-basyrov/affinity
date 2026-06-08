import { requestUrl } from 'obsidian';
import { ChatMessage, ChatProvider } from './types';

interface ChatCompletionResponse {
	choices?: { message?: { content?: string } }[];
	error?: { message?: string };
}

export interface OpenAICompatibleConfig {
	/** Display name, used in error messages. */
	label: string;
	baseUrl: string;
	apiKey: string;
	model: string;
}

/**
 * Talks to any OpenAI-compatible `/chat/completions` endpoint
 * (Featherless, OpenAI, OpenRouter, local servers, …).
 * Uses Obsidian's requestUrl to avoid CORS issues on desktop and mobile.
 */
export class OpenAICompatibleProvider implements ChatProvider {
	constructor(private readonly config: OpenAICompatibleConfig) {}

	async chat(messages: ChatMessage[]): Promise<string> {
		const { label, baseUrl, apiKey, model } = this.config;

		if (!apiKey) {
			throw new Error(`No API key set for ${label}. Add it in plugin settings.`);
		}

		const response = await requestUrl({
			url: `${baseUrl}/chat/completions`,
			method: 'POST',
			contentType: 'application/json',
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({ model, messages }),
			// We handle non-2xx ourselves so we can show a useful message.
			throw: false,
		});

		const data = response.json as ChatCompletionResponse | undefined;

		if (response.status < 200 || response.status >= 300) {
			const detail = data?.error?.message ?? response.text ?? `HTTP ${response.status}`;
			throw new Error(`${label} request failed: ${detail}`);
		}

		const content = data?.choices?.[0]?.message?.content;
		if (typeof content !== 'string') {
			throw new Error(`Unexpected response from ${label} (no message content).`);
		}
		return content;
	}
}