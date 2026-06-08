import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import AffinityPlugin from './main';
import { ChatMessage, createProvider } from './providers';

export const AFFINITY_CHAT_VIEW = 'affinity-chat-view';

export class AffinityChatView extends ItemView {
	plugin: AffinityPlugin;
	private messages: ChatMessage[] = [];
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

	private async send(): Promise<void> {
		if (this.sending) return;
		const text = this.inputEl.value.trim();
		if (!text) {
			this.inputEl.value = '';
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
