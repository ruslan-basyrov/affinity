export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
	/**
	 * The model's reasoning trace for an assistant turn, when the backend
	 * exposes one. Shown as a collapsible "Thinking" section; never sent back
	 * upstream as part of the conversation.
	 */
	reasoning?: string;
}

/** A single assistant reply: the answer plus any reasoning trace. */
export interface ChatReply {
	content: string;
	reasoning?: string;
}

/**
 * A chat backend the view can talk to, independent of any specific vendor.
 * New providers just implement this interface.
 */
export interface ChatProvider {
	chat(messages: ChatMessage[]): Promise<ChatReply>;
}
