import { Client, Message, MessageEmbed, MessageOptions } from 'discord.js';

export type Command = {
	name: string;
	description: string;
	usage: string;
	dm_disabled?: boolean;
	execute: (message: Message, args: string[]) => void;
};

export class CommandHandler {
	private _prefix: string;
	private _commands: Command[];

	constructor(client: Client, prefix: string) {
		this._prefix = prefix;
		this._commands = [];

		client.on('messageCreate', (message) => this.handleMessage(message));

		this._commands.push({
			name: 'help',
			description: 'Show help',
			usage: 'help [command]',
			execute: (message, args) => {
				if (args.length === 0) {
					message.channel.send(this.generateHelpMessage());
				} else {
					message.channel.send(
						this.generateCommandHelpMessage(args[0])
					);
				}
			},
		});
	}

	public registerCommand(command: Command) {
		this._commands.push(command);
	}

	public handleMessage(message: Message<boolean>) {
		if (!message.content.startsWith(this._prefix)) return;

		// cut by space and remove prefix
		const args = message.content.slice(this._prefix.length).split(/ +/);

		if (args.length < 1) return;

		const commandName = (args.shift() as string).toLowerCase();
		const command = this._commands.find((c) => c.name === commandName);

		if (!command) return;

		if (command.dm_disabled && message.channel.type === 'DM') {
			message.channel.send('This command is not available in DMs');
			return;
		}

		command.execute(message, args);
	}

	private generateHelpMessage(): MessageOptions {
		const embed = new MessageEmbed();
		embed.setTitle('Help');
		embed.setColor(0x00ff00);
		embed.setDescription('List of commands');
		this._commands.forEach((c) => embed.addField(c.name, c.description));
		return { embeds: [embed] };
	}

	private generateCommandHelpMessage(
		commandName: string
	): MessageOptions | string {
		const command = this._commands.find((c) => c.name === commandName);
		if (!command) return `Command ${commandName} not found`;
		const embed = new MessageEmbed();
		embed.setTitle(`Help for ${command.name}`);
		embed.setColor(0x00ff00);
		embed.setDescription(command.description);
		embed.addField('Usage', `${this._prefix}${command.usage}`);
		return { embeds: [embed] };
	}
}
