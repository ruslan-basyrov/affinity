import { App, PluginSettingTab, Setting } from 'obsidian';
import AffinityPlugin from './main';

export interface AffinitySettings {
	Model: string;
}

export const DEFAULT_SETTINGS: AffinitySettings = {
	Model: 'Gemini',
};

export class AffinitySettingTab extends PluginSettingTab {
	plugin: AffinityPlugin;

	constructor(app: App, plugin: AffinityPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Choose model')
			.setDesc("What model?")
			.addText((text) =>
				text
					.setPlaceholder('Choose model')
					.setValue(this.plugin.settings.Model)
					.onChange(async (value) => {
						this.plugin.settings.Model = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
