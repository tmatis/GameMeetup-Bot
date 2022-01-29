import { Logger } from './Logger';
import {
	ButtonInteraction,
	Client,
	MessageButton,
	MessageButtonStyleResolvable,
} from 'discord.js';

export type ButtonOptions = {
	label: string;
	style: MessageButtonStyleResolvable;
	action: (interaction: ButtonInteraction) => void;
};

export class Button {
	private _label: string;
	private _style: MessageButtonStyleResolvable;
	private _action: (interaction: ButtonInteraction) => void;
	private _uuid: string;

	constructor(options: ButtonOptions & { uuid: string }) {
		this._label = options.label;
		this._style = options.style;
		this._action = options.action;
		this._uuid = options.uuid;
	}

	public get label(): string {
		return this._label;
	}

	public get style(): MessageButtonStyleResolvable {
		return this._style;
	}

	public get action(): (interaction: ButtonInteraction) => void {
		return this._action;
	}

	public get uuid(): string {
		return this._uuid;
	}
}

export class ButtonHandler {
	private _buttons: Button[];

	constructor(client: Client) {
		this._buttons = [];

		client.on('interactionCreate', (interaction) => {
			if (interaction.isButton()) {
				const button = this._buttons.find(
					(b) => b.uuid === interaction.customId
				);

				if (button) {
					interaction.deferUpdate();
					button.action(interaction);
				}
			}
		});
	}

	private generateUUID(): string {
		// make sure it's unique
		let uuid = '';
		do {
			uuid =
				Math.random().toString(36).substring(2, 15) +
				Math.random().toString(36).substring(2, 15);
		} while (this._buttons.find((b) => b.uuid === uuid));

		return uuid;
	}

	public registerButton(button: ButtonOptions): MessageButton {
		// generate unique uuid
		const newButton = new Button({ ...button, uuid: this.generateUUID() });

		this._buttons.push(newButton);

		Logger.debug(
			`registered button with uuid ${newButton.uuid} and label ${newButton.label}`
		);
		return new MessageButton()
			.setCustomId(newButton.uuid)
			.setLabel(newButton.label)
			.setStyle(newButton.style);
	}

	public removeButton(uuid: string) {
		this._buttons = this._buttons.filter((b) => b.uuid !== uuid);
		Logger.debug(`removed button with uuid ${uuid} from button list`);
	}
}
