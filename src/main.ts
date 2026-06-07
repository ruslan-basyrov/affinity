import {
	Plugin,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	AffinitySettings,
	AffinitySettingTab,
} from './settings';

// Remember to rename these classes and interfaces!

export default class AffinityPlugin extends Plugin {
	settings!: AffinitySettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('message-square', 'Open chat (Affinity)', (_evt: MouseEvent) => {
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AffinitySettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AffinitySettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
