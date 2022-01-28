import { MessageUtil } from './MessageUtil';
import { GameMeetup } from './GameMeetup/GameMeetup';
import { Client, Guild, Intents } from 'discord.js';
import { ButtonHandler } from './ButtonHandler';
import { Command, CommandHandler } from './CommandHandler';
import { Logger } from './Logger';

export class DiscordBot {
	private _client: Client;
	private _commandHandler: CommandHandler;
	private _buttonHandler: ButtonHandler;
	private _gameMeetups: GameMeetup[] = [];

	constructor(prefix: string) {
		this._client = new Client({
			intents: [
				Intents.FLAGS.GUILDS,
				Intents.FLAGS.GUILD_MEMBERS,
				Intents.FLAGS.GUILD_MESSAGES,
				Intents.FLAGS.DIRECT_MESSAGES,
				Intents.FLAGS.GUILD_MEMBERS,
				Intents.FLAGS.GUILD_VOICE_STATES,
			],
			partials: ['CHANNEL'],
		});
		this._commandHandler = new CommandHandler(this._client, prefix);
		this._buttonHandler = new ButtonHandler(this._client);

		this.registerCommands();

		this._client.once('ready', () => {
			Logger.success(`Logged in as ${this._client.user?.tag}`);
			this._client.user?.setActivity('!help');
		});
	}

	public login(token: string) {
		Logger.info('logging in...');
		this._client.login(token);
	}

	private registerCommands() {
		const commands: Command[] = [
			{
				name: 'gamemeet',
				description: 'Create a game meetup',
				usage: 'gamemeet gamename hh:mm [max_participants]',
				dm_disabled: true,
				execute: async (message, args) => {
					if (args.length < 2) {
						MessageUtil.sendErrorMessage(
							message.channel,
							'Bad usage! Use `gamemeet gamename hh:mm [max_participants]`'
						);
						return;
					}
					const game = args[0];

					// the format of the date is HH:mm in 24h format
					// if the date is lower than our current time, we add a day
					// gamemeet [gamename] 21:00

					// get actual date

					// check if the format is correct
					if (!/^[0-9]{2}:[0-9]{2}$/.test(args[1])) {
						MessageUtil.sendErrorMessage(
							message.channel,
							'Bad format! Use `need hh:mm`'
						);
						return;
					}

					const date = new Date();
					const actualDate = new Date();
					const hour = parseInt(args[1].split(':')[0]);
					const minute = parseInt(args[1].split(':')[1]);
					date.setHours(hour);
					date.setMinutes(minute);

					if (date.getTime() < actualDate.getTime()) {
						date.setDate(date.getDate() + 1);
					}

					if (isNaN(date.getTime())) {
						MessageUtil.sendErrorMessage(
							message.channel,
							'the date is not valid'
						);
						return;
					}

					const maxParticipants = args[2]
						? parseInt(args[2])
						: Infinity;

					this._gameMeetups.push(
						new GameMeetup({
							channel: message.channel,
							creator: message.author,
							game: game,
							meetdate: date,
							buttonHandler: this._buttonHandler,
							max_participants: maxParticipants,
							guild: message.guild as Guild,
							removeMeetup: (meetup: GameMeetup) => {
								this._gameMeetups = this._gameMeetups.filter(
									(m) => m.id !== meetup.id
								);
							},
						})
					);
				},
			},
		];

		commands.forEach((c) => this._commandHandler.registerCommand(c));
	}
}
