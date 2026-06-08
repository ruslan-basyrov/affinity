import { Plugin, WorkspaceLeaf } from 'obsidian';
import {
	AffinitySettings,
	AffinitySettingTab,
	normalizeSettings,
} from './settings';
import { AFFINITY_CHAT_VIEW, AffinityChatView } from './view';

export default class AffinityPlugin extends Plugin {
	settings!: AffinitySettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			AFFINITY_CHAT_VIEW,
			(leaf) => new AffinityChatView(leaf, this),
		);

		// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Affinity" is the plugin name
		this.addRibbonIcon('message-square', 'Open chat (Affinity)', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-chat',
			name: 'Open chat',
			callback: () => void this.activateView(),
		});

		this.addSettingTab(new AffinitySettingTab(this.app, this));
	}

	onunload() {}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null =
			workspace.getLeavesOfType(AFFINITY_CHAT_VIEW)[0] ?? null;

		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: AFFINITY_CHAT_VIEW, active: true });
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}