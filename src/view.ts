import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
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

		this.messages.push({ role: 'user', content: text });
		this.inputEl.value = '';
		this.setSending(true);
		this.renderMessages();

		const thinking = this.messagesEl.createDiv({
			cls: 'affinity-chat-message affinity-chat-assistant affinity-chat-thinking',
			text: '…',
		});
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

		try {
			const provider = createProvider(this.plugin.settings);
			const reply = await provider.chat(this.messages);
			this.messages.push({ role: 'assistant', content: reply });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(message);
			this.messages.push({
				role: 'assistant',
				content: `⚠️ ${message}`,
			});
		} finally {
			thinking.remove();
			this.setSending(false);
			this.renderMessages();
		}
	}

	private setSending(sending: boolean): void {
		this.sending = sending;
		this.sendButton.disabled = sending;
		this.inputEl.disabled = sending;
	}

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
			const cls =
				message.role === 'user'
					? 'affinity-chat-user'
					: 'affinity-chat-assistant';
			const el = this.messagesEl.createDiv({
				cls: `affinity-chat-message ${cls}`,
			});
			el.setText(message.content);
		}
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	clear(): void {
		this.messages = [];
		this.renderMessages();
	}
}
