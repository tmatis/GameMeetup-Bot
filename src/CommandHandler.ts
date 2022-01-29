import { Logger } from './Logger';
import { Client, Message, MessageEmbed, MessageOptions } from 'discord.js';
import { MessageUtil } from './MessageUtil';

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

	/*
	 ** tokenize
	 ** "!help" -> ["!help"]
	 ** "!help test" -> ["!help", "test"]
	 ** "!help 'test test'" -> ["!help", "test test"]
	 */
	private static tokenize(message: string): string[] {
		// first check if the ' and " count is even
		let singleQuoteCount = 0;
		for (let i = 0; i < message.length; i++) {
			if (message[i] === "'") singleQuoteCount++;
		}
		if (singleQuoteCount % 2 !== 0) {
			throw new Error('Unbalanced quotes');
		}

		const tokens: string[] = [];
		let currentToken = '';
		let inQuotes = false;
		for (let i = 0; i < message.length; i++) {
			const char = message[i];
			if (char === ' ' && !inQuotes) {
				if (currentToken.length > 0) {
					tokens.push(currentToken);
					currentToken = '';
				}
			} else if (char === "'") {
				inQuotes = !inQuotes;
			} else {
				currentToken += char;
			}
		}
		if (currentToken.length > 0) {
			tokens.push(currentToken);
		}
		return tokens;
	}

	public registerCommand(command: Command) {
		this._commands.push(command);
	}

	public handleMessage(message: Message<boolean>) {
		if (!message.content.startsWith(this._prefix)) return;

		try {
			const args = CommandHandler.tokenize(
				message.content.substring(this._prefix.length)
			);

			if (args.length < 1) return;

			const commandName = (args.shift() as string).toLowerCase();
			const command = this._commands.find((c) => c.name === commandName);

			if (!command) return;

			if (command.dm_disabled && message.channel.type === 'DM') {
				message.channel.send('This command is not available in DMs');
				return;
			}

			command.execute(message, args);
		} catch (e) {
			MessageUtil.sendErrorMessage(
				message.channel,
				`Error: ${(e as Error).message}`
			);
			Logger.debug(`Error: ${(e as Error).message}`);
			return;
		}
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
