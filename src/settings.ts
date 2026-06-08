import { App, PluginSettingTab, Setting } from 'obsidian';
import AffinityPlugin from './main';
import { PROVIDERS, ProviderId } from './providers';

export interface ProviderConfig {
	apiKey: string;
	baseUrl: string;
	/** Models the user can pick from in the chat for this provider. */
	models: string[];
}

export interface AffinitySettings {
	/** Provider chosen in the chat, or null when none is selected yet. */
	activeProvider: ProviderId | null;
	/** Model chosen in the chat, or null when none is selected yet. */
	activeModel: string | null;
	/** Per-provider config, so each backend remembers its own key/models. */
	providers: Record<ProviderId, ProviderConfig>;
}

/**
 * Build settings from persisted data, filling in defaults for any provider
 * missing from the saved data and migrating the legacy single-`model` shape
 * to the new `models` list.
 */
export function normalizeSettings(raw: unknown): AffinitySettings {
	const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const saved = (
		data.providers && typeof data.providers === 'object' ? data.providers : {}
	) as Partial<Record<ProviderId, Partial<ProviderConfig> & { model?: string }>>;

	const providers = {} as Record<ProviderId, ProviderConfig>;
	for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
		const p = saved[id] ?? {};
		let models: string[];
		if (Array.isArray(p.models)) {
			models = p.models
				.filter((m): m is string => typeof m === 'string')
				.map((m) => m.trim())
				.filter((m) => m.length > 0);
		} else if (typeof p.model === 'string' && p.model.trim()) {
			// Legacy single-model field.
			models = [p.model.trim()];
		} else {
			models = [];
		}
		providers[id] = {
			apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
			baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
			models,
		};
	}

	const activeProvider =
		typeof data.activeProvider === 'string' && data.activeProvider in PROVIDERS
			? (data.activeProvider as ProviderId)
			: null;

	let activeModel = typeof data.activeModel === 'string' ? data.activeModel : null;
	// Migrate: if an active provider was saved with the legacy single model,
	// keep that as the chosen model.
	if (!activeModel && activeProvider) {
		const legacy = saved[activeProvider]?.model;
		if (typeof legacy === 'string' && legacy.trim()) {
			activeModel = legacy.trim();
		}
	}
	// Drop a chosen model that no longer exists for the active provider.
	if (
		!activeProvider ||
		(activeModel && !providers[activeProvider].models.includes(activeModel))
	) {
		activeModel = null;
	}

	return { activeProvider, activeModel, providers };
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
			.setName('Providers')
			.setDesc(
				'Configure each provider here. Pick the active provider and model above the chat.',
			)
			.setHeading();

		for (const info of Object.values(PROVIDERS)) {
			this.renderProvider(info.id);
		}
	}

	private renderProvider(id: ProviderId): void {
		const { containerEl } = this;
		const info = PROVIDERS[id];
		const config = this.plugin.settings.providers[id];

		new Setting(containerEl).setName(info.name).setHeading();

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

		new Setting(containerEl)
			.setName('Models')
			.setDesc('Models you can choose from in the chat.');

		config.models.forEach((model, index) => {
			new Setting(containerEl)
				.addText((text) =>
					text
						.setPlaceholder(info.defaultModel || 'Model ID')
						.setValue(model)
						.onChange(async (value) => {
							const next = value.trim();
							const previous = config.models[index];
							config.models[index] = next;
							// Keep the chat's chosen model in sync if it was renamed.
							if (
								this.plugin.settings.activeProvider === id &&
								this.plugin.settings.activeModel === previous
							) {
								this.plugin.settings.activeModel = next || null;
							}
							await this.plugin.saveSettings();
						}),
				)
				.addExtraButton((btn) =>
					btn
						.setIcon('trash')
						.setTooltip('Remove model')
						.onClick(async () => {
							const [removed] = config.models.splice(index, 1);
							if (
								this.plugin.settings.activeProvider === id &&
								this.plugin.settings.activeModel === removed
							) {
								this.plugin.settings.activeModel = null;
							}
							await this.plugin.saveSettings();
							this.display();
						}),
				);
		});

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText('Add model')
				.setCta()
				.onClick(async () => {
					config.models.push('');
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}
}
