import { App, PluginSettingTab, Setting } from 'obsidian';
import AffinityPlugin from './main';
import { PROVIDERS, ProviderId } from './providers';

export interface ProviderConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
}

export interface AffinitySettings {
	activeProvider: ProviderId;
	/** Per-provider config, so each backend remembers its own key/model. */
	providers: Record<ProviderId, ProviderConfig>;
}

/**
 * Build settings from persisted data, filling in defaults for any provider
 * missing from the saved data.
 */
export function normalizeSettings(raw: unknown): AffinitySettings {
	const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const saved = (
		data.providers && typeof data.providers === 'object' ? data.providers : {}
	) as Partial<Record<ProviderId, Partial<ProviderConfig>>>;

	const providers = {} as Record<ProviderId, ProviderConfig>;
	for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
		const p = saved[id] ?? {};
		providers[id] = {
			apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
			model: typeof p.model === 'string' ? p.model : '',
			baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
		};
	}

	const activeProvider =
		typeof data.activeProvider === 'string' && data.activeProvider in PROVIDERS
			? (data.activeProvider as ProviderId)
			: 'featherless';

	return { activeProvider, providers };
}

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
			.setName('Provider')
			.setDesc('Which service to chat with.')
			.addDropdown((dropdown) => {
				for (const info of Object.values(PROVIDERS)) {
					dropdown.addOption(info.id, info.name);
				}
				dropdown
					.setValue(this.plugin.settings.activeProvider)
					.onChange(async (value) => {
						this.plugin.settings.activeProvider = value as ProviderId;
						await this.plugin.saveSettings();
						// Re-render so the fields below reflect the chosen provider.
						this.display();
					});
			});

		const info = PROVIDERS[this.plugin.settings.activeProvider];
		const config = this.plugin.settings.providers[this.plugin.settings.activeProvider];

		new Setting(containerEl)
			.setName('API key')
			.setDesc(`Your ${info.name} API key. Stored locally in this vault.`)
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Paste your API key')
					.setValue(config.apiKey)
					.onChange(async (value) => {
						config.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Model ID to use.')
			.addText((text) =>
				text
					.setPlaceholder(info.defaultModel || 'Model ID')
					.setValue(config.model)
					.onChange(async (value) => {
						config.model = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Base URL')
			.setDesc('OpenAI-compatible endpoint')
			.addText((text) =>
				text
					.setPlaceholder(info.defaultBaseUrl || 'https://…')
					.setValue(config.baseUrl)
					.onChange(async (value) => {
						config.baseUrl = value.trim().replace(/\/+$/, '');
						await this.plugin.saveSettings();
					}),
			);
	}
}