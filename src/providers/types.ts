export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * A chat backend the view can talk to, independent of any specific vendor.
 * New providers just implement this interface.
 */
export interface ChatProvider {
	chat(messages: ChatMessage[]): Promise<string>;
}
