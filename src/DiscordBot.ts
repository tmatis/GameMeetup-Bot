import { TimeUtils } from './TimeUtils';
import { MessageUtil } from './MessageUtil';
import { Client, Guild, Intents } from 'discord.js';
import { ButtonHandler } from './ButtonHandler';
import { Command, CommandHandler } from './CommandHandler';
import { Logger } from './Logger';
import { GameMeetup } from './GameMeetup/GameMeetup';

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

	private static sanitizeChannelName(name: string) {
		// if there is only space throw an error
		let newName = name.trim();
		if (newName.length === 0) {
			throw new Error('Channel name cannot be empty');
		}
		newName = newName.toLowerCase();
		// replace multiple space with one
		newName = newName.replace(/\s+/g, ' ');
		// replace all spaces with dashes
		newName = newName.replace(/ /g, '-');
		return newName;
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
				usage: "gamemeet 'gamename' hh:mm [max_participants]",
				dm_disabled: true,
				execute: async (message, args) => {
					if (args.length < 2 || args.length > 3) {
						MessageUtil.sendErrorMessage(
							message.channel,
							"Bad usage! Use `gamemeet 'gamename' hh:mm [max_participants]`"
						);
						return;
					}

					try {
						const game = DiscordBot.sanitizeChannelName(args[0]);
						Logger.debug(`sanitized game name: ${game}`);

						try {
							const date = TimeUtils.parseDateTZ(args[1]);
							Logger.debug(`parsed date: ${date.toISOString()}`);
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
										Logger.debug(
											`removed meetup ${meetup.id} from list`
										);
										this._gameMeetups =
											this._gameMeetups.filter(
												(m) => m.id !== meetup.id
											);
									},
								})
							);
						} catch (e) {
							MessageUtil.sendErrorMessage(
								message.channel,
								'Bad date format! Use `need hh:mm`'
							);
						}

						
					} catch (e) {
						MessageUtil.sendErrorMessage(
							message.channel,
							`Error: ${(e as Error).message}`
						);
						Logger.debug(`Error: ${(e as Error).message}`);
						return;
					}

					// the format of the date is HH:mm in 24h format
					// if the date is lower than our current time, we add a day
					// gamemeet [gamename] 21:00

					// get actual date

					// check if the format is correct
				},
			},
		];

		commands.forEach((c) => this._commandHandler.registerCommand(c));
		Logger.debug(
			`registered ${commands.length} commands in the command handler`
		);
	}
}
