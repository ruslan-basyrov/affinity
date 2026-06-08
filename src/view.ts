import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from 'obsidian';
import AffinityPlugin from './main';
import { ChatMessage, createProvider, PROVIDERS, ProviderId } from './providers';

export const AFFINITY_CHAT_VIEW = 'affinity-chat-view';

export class AffinityChatView extends ItemView {
	plugin: AffinityPlugin;
	private messages: ChatMessage[] = [];
	private providerSelect!: HTMLSelectElement;
	private modelSelect!: HTMLSelectElement;
	private messagesEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendButton!: HTMLButtonElement;
	private sending = false;

	constructor(leaf: WorkspaceLeaf, plugin: AffinityPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return AFFINITY_CHAT_VIEW;
	}

	getDisplayText(): string {
		return 'Affinity chat';
	}

	getIcon(): string {
		return 'message-square';
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass('affinity-chat');

		const pickerRow = root.createDiv({ cls: 'affinity-chat-picker-row' });
		this.providerSelect = pickerRow.createEl('select', {
			cls: 'affinity-chat-picker dropdown',
		});
		this.modelSelect = pickerRow.createEl('select', {
			cls: 'affinity-chat-picker dropdown',
		});

		this.registerDomEvent(this.providerSelect, 'change', () => {
			const value = this.providerSelect.value;
			this.plugin.settings.activeProvider = value ? (value as ProviderId) : null;
			// A model from another provider no longer applies.
			this.plugin.settings.activeModel = null;
			void this.plugin.saveSettings();
			this.populateModels();
		});
		this.registerDomEvent(this.modelSelect, 'change', () => {
			this.plugin.settings.activeModel = this.modelSelect.value || null;
			void this.plugin.saveSettings();
		});

		this.populateProviders();
		this.populateModels();

		this.messagesEl = root.createDiv({ cls: 'affinity-chat-messages' });

		const inputRow = root.createDiv({ cls: 'affinity-chat-input-row' });
		this.inputEl = inputRow.createEl('textarea', {
			cls: 'affinity-chat-input',
			attr: { placeholder: 'Send a message…', rows: '2' },
		});
		this.sendButton = inputRow.createEl('button', {
			cls: 'affinity-chat-send mod-cta',
			text: 'Send',
		});

		this.registerDomEvent(this.inputEl, 'keydown', (evt) => {
			if (evt.key === 'Enter' && !evt.shiftKey) {
				evt.preventDefault();
				void this.send();
			}
		});
		this.registerDomEvent(this.sendButton, 'click', () => void this.send());

		this.renderMessages();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private populateProviders(): void {
		const select = this.providerSelect;
		select.empty();
		select.createEl('option', { text: 'Select provider…', value: '' });
		for (const info of Object.values(PROVIDERS)) {
			select.createEl('option', { text: info.name, value: info.id });
		}
		select.value = this.plugin.settings.activeProvider ?? '';
	}

	private populateModels(): void {
		const select = this.modelSelect;
		select.empty();

		const id = this.plugin.settings.activeProvider;
		const models = id
			? this.plugin.settings.providers[id].models.filter((m) => m.trim())
			: [];

		if (!id) {
			select.createEl('option', { text: 'Select a provider first', value: '' });
			select.disabled = true;
			select.value = '';
			return;
		}
		if (models.length === 0) {
			select.createEl('option', { text: 'No models — add in settings', value: '' });
			select.disabled = true;
			select.value = '';
			return;
		}

		select.disabled = false;
		select.createEl('option', { text: 'Select model…', value: '' });
		for (const model of models) {
			select.createEl('option', { text: model, value: model });
		}
		const active = this.plugin.settings.activeModel;
		select.value = active && models.includes(active) ? active : '';
	}

	private async send(): Promise<void> {
		if (this.sending) return;
		const text = this.inputEl.value.trim();
		if (!text) {
			this.inputEl.value = '';
			return;
		}

		const { activeProvider, activeModel } = this.plugin.settings;
		if (!activeProvider || !activeModel) {
			new Notice('Pick a provider and model above the chat first.');
			return;
		}

		this.inputEl.value = '';
		this.setSending(true);
		this.addMessage({ role: 'user', content: text });

		const thinking = this.messagesEl.createDiv({
			cls: 'affinity-chat-message affinity-chat-assistant affinity-chat-thinking',
			text: '…',
		});
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

		try {
			const provider = createProvider(this.plugin.settings);
			const reply = await provider.chat(this.messages);
			this.addMessage({
				role: 'assistant',
				content: reply.content,
				reasoning: reply.reasoning,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(message);
			this.addMessage({ role: 'assistant', content: `⚠️ ${message}` });
		} finally {
			thinking.remove();
			this.setSending(false);
		}
	}

	private setSending(sending: boolean): void {
		this.sending = sending;
		this.sendButton.disabled = sending;
		this.inputEl.disabled = sending;
	}

	// Full rebuild — only for initial load and clear(). Steady-state updates go
	// through addMessage() so existing messages aren't re-rendered each turn.
	private renderMessages(): void {
		this.messagesEl.empty();
		if (this.messages.length === 0) {
			this.messagesEl.createDiv({
				cls: 'affinity-chat-empty',
				text: 'Start a conversation.',
			});
			return;
		}
		for (const message of this.messages) {
			this.appendMessage(message);
		}
	}

	// Record a new message and render just that one into the DOM.
	private addMessage(message: ChatMessage): void {
		this.messages.push(message);
		this.appendMessage(message);
	}

	// Render a single message element and append it, leaving earlier messages
	// (and their already-rendered markdown) untouched.
	private appendMessage(message: ChatMessage): void {
		// Drop the empty-state placeholder once a real message arrives.
		this.messagesEl.querySelector('.affinity-chat-empty')?.remove();

		const cls =
			message.role === 'user'
				? 'affinity-chat-user'
				: 'affinity-chat-assistant';
		const el = this.messagesEl.createDiv({
			cls: `affinity-chat-message ${cls}`,
		});
		// Collapsed reasoning trace, shown above the answer when present.
		if (message.role === 'assistant' && message.reasoning) {
			const details = el.createEl('details', {
				cls: 'affinity-chat-reasoning',
			});
			details.createEl('summary', {
				cls: 'affinity-chat-reasoning-summary',
				text: 'Thinking',
			});
			const reasoningBody = details.createDiv({
				cls: 'affinity-chat-reasoning-body',
			});
			this.renderMarkdown(message.reasoning, reasoningBody);
		}
		const textEl = el.createDiv({ cls: 'affinity-chat-text' });
		this.renderMarkdown(message.content, textEl);

		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	// Render markdown into el using Obsidian's reading-view pipeline, which
	// gives syntax-highlighted, copiable code blocks for free. Passing `this`
	// as the component ties any rendered children to the view's lifecycle.
	private renderMarkdown(markdown: string, el: HTMLElement): void {
		void MarkdownRenderer.render(this.app, markdown, el, '', this);
	}

	clear(): void {
		this.messages = [];
		this.renderMessages();
	}
}
