import { requestUrl } from 'obsidian';
import { ChatMessage, ChatProvider, ChatReply } from './types';

interface ChatCompletionResponse {
	choices?: { message?: { content?: string; reasoning?: string } }[];
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

	async chat(messages: ChatMessage[]): Promise<ChatReply> {
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
			// Only role/content go upstream; a prior turn's reasoning trace is
			// for display, not part of the conversation we send back.
			body: JSON.stringify({
				model,
				messages: messages.map(({ role, content }) => ({ role, content })),
			}),
			// We handle non-2xx ourselves so we can show a useful message.
			throw: false,
		});

		const data = response.json as ChatCompletionResponse | undefined;

		if (response.status < 200 || response.status >= 300) {
			const detail = data?.error?.message ?? response.text ?? `HTTP ${response.status}`;
			throw new Error(`${label} request failed: ${detail}`);
		}

		const message = data?.choices?.[0]?.message;
		if (typeof message?.content !== 'string') {
			throw new Error(`Unexpected response from ${label} (no message content).`);
		}
		const reasoning =
			typeof message.reasoning === 'string' && message.reasoning.trim()
				? message.reasoning
				: undefined;
		return { content: message.content, reasoning };
	}
}