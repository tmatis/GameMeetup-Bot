import { Logger } from './../Logger';
import {
	ButtonInteraction,
	EmbedFieldData,
	MessageActionRow,
	MessageButton,
	MessageEmbed,
	MessageOptions,
	User,
} from 'discord.js';
import { ChannelTypes } from 'discord.js/typings/enums';
import { ButtonHandler } from '../ButtonHandler';
import {
	GameMeetupButtons,
	GameMeetupChannels,
	GameMeetupInfo,
	GameMeetupMessages,
	GameMeetupOptions,
} from './GMTypes';
import { MessageUtil } from '../MessageUtil';
import { TimeUtils } from '../TimeUtils';

/*
 ** Game Meetup
 ** - The owner receive a message with the meetup information and a cancel button
 ** - the channel where the meetup is created receive a message with the meetup information and joins button
 ** - if someone joins, he receive a message with the meetup information and a cancel button
 ** - a notification is sent 10 minutes before the meetup
 ** - a second notification is sent 5 minutes after the meetup if the user is not in the voice channel
 ** - the category, voice channel and text channel are created 30 minutes before the meetup of instant if
 ** the meetup date is bellow 30 minutes
 ** - every 30 minutes the meetup check if the meetup is still active, if not, it is removed
 ** - if the meetup is removed, the channel is deleted
 ** - if the ownder cancel the meetup, the channel is deleted
 ** - if the meetup is not full ask maybe participants to join 5 minutes before the meetup
 */

export class GameMeetup {
	private static _nextId = 0;

	private _id: number;
	private _participants: User[];
	private _maybe_participants: User[];
	private _buttonHandler: ButtonHandler;
	private _removeMeetup: (meetup: GameMeetup) => void;
	private _timers: NodeJS.Timeout[];

	private _info: GameMeetupInfo;
	private _buttons: GameMeetupButtons;
	private _messages: GameMeetupMessages = {
		generalMessage: undefined,
		ownerMessage: undefined,
		channelMessage: undefined,
		participantsMessage: {},
		maybeParticipantsMessage: {},
	}; // we need to init here to avoid ts error

	private _channels: GameMeetupChannels = {
		categoryChannel: undefined,
		textChannel: undefined,
		voiceChannel: undefined,
	}; // we need to init here to avoid ts error

	/*
	 ** format date to string HH:MM
	 */

	public get id(): number {
		return this._id;
	}

	public removeParticipant(user: User) {
		// find by id
		const index = this._participants.findIndex((p) => p.id === user.id);
		if (index === -1) return;
		this._participants.splice(index, 1);
		// remove participant message
		delete this._messages.participantsMessage[user.id];
		Logger.debug(
			`GameMeetup ${this._id} removeParticipant ${user.username}`
		);
		this.updateMessages();
	}

	public removeMaybeParticipant(user: User) {
		// find by id
		const index = this._maybe_participants.findIndex(
			(p) => p.id === user.id
		);
		if (index === -1) return;
		this._maybe_participants.splice(index, 1);
		// remove participant message
		delete this._messages.maybeParticipantsMessage[user.id];
		Logger.debug(
			`GameMeetup ${this._id} removeMaybeParticipant ${user.username}`
		);
		this.updateMessages();
	}

	public async addParticipant(user: User) {
		if (this._participants.find((p) => p.id === user.id)) return;
		this._participants.push(user);

		const maybe_user = this._maybe_participants.find(
			(p) => p.id === user.id
		);
		if (maybe_user) {
			// transfer maybe message to participant message
			this._messages.participantsMessage[user.id] =
				this._messages.maybeParticipantsMessage[maybe_user.id];
			this.removeMaybeParticipant(maybe_user);
		} else
			this._messages.participantsMessage[user.id] = await user.send(
				this.generateParticipantMessage()
			);
		Logger.debug(`GameMeetup ${this._id} addParticipant ${user.username}`);
		this.updateMessages();
	}

	public async addMaybeParticipant(user: User) {
		if (this._maybe_participants.find((p) => p.id === user.id)) return;
		this._maybe_participants.push(user);

		const user_participant = this._participants.find(
			(p) => p.id === user.id
		);
		if (user_participant) {
			// transfer participant message to maybe message
			this._messages.maybeParticipantsMessage[user.id] =
				this._messages.participantsMessage[user_participant.id];
			this.removeParticipant(user_participant);
		} else
			this._messages.maybeParticipantsMessage[user.id] = await user.send(
				this.generateMaybeParticipantMessage()
			);
		Logger.debug(
			`GameMeetup ${this._id} addMaybeParticipant ${user.username}`
		);
		this.updateMessages();
	}

	private generateEmbed(): MessageEmbed {
		const embed = new MessageEmbed();

		// the title will be in the format "Game Meetup: <game> hh:mm"
		const title = `Game Meetup: ${this._info.game} ${TimeUtils.formatDateTimeTZ(
			this._info.meetdate
		)}`;
		embed.setTitle(title);
		embed.setColor(0x00ff00);
		embed.setDescription(
			`${this._info.creator.username} created this game meetup.`
		);

		if (this._info.max_participants !== Infinity)
			embed.addField(
				'Participants',
				`${this._participants.length}/${this._info.max_participants}${
					this._participants.length >= this._info.max_participants
						? ' (full)'
						: ''
				}`,
				true
			);

		embed.addField('Creator', `${this._info.creator.username}`, true);

		embed.addField(
			'Date',
			`${this._info.meetdate.toLocaleDateString('fr-FR')}`,
			true
		);

		// add empty field to make the embed look nice

		embed.addField('\u200b', 'Participants list', false);

		let fields: EmbedFieldData[] = this._participants.map((p) => {
			return {
				name: p.username,
				value: 'joined',
				inline: true,
			};
		});

		if (
			this._info.max_participants !== Infinity &&
			this._participants.length < this._info.max_participants
		) {
			fields = fields.concat(
				this._maybe_participants.map((p) => {
					return {
						name: p.username,
						value: 'maybe',
						inline: true,
					};
				})
			);
		}
		embed.addFields(fields);
		return embed;
	}

	/* message generators */

	private generateGeneralMessage(): MessageOptions {
		return {
			embeds: [this.generateEmbed()],
			components:
				this._participants.length >= this._info.max_participants
					? []
					: [this._buttons.generalButtons],
		};
	}

	private generateOwnerMessage(): MessageOptions {
		return {
			content:
				'You created this game meetup, you can cancel it by clicking the button below.',
			embeds: [this.generateEmbed()],
			components: [this._buttons.ownerButtons],
		};
	}

	private generateParticipantMessage(): MessageOptions {
		return {
			content: 'You joined a game meetup, please be present or cancel.',
			embeds: [this.generateEmbed()],
			components: [this._buttons.participantButtons],
		};
	}

	private generateMaybeParticipantMessage(): MessageOptions {
		return {
			content:
				'You are maybe participating in a game meetup, confirm or cancel.',
			embeds: [this.generateEmbed()],
			components:
				this._participants.length >= this._info.max_participants
					? []
					: [this._buttons.maybeParticipantButtons],
		};
	}

	private generateCancelledMessage(): MessageOptions {
		const message = MessageUtil.generateEmbedMessage(
			'Game Meetup Cancelled',
			`The game meetup for ${this._info.game} was cancelled by ${this._info.creator.username}.`,
			0xff0000
		);
		message.content = 'Canceled';
		return message;
	}

	private generateOverMessage(): MessageOptions {
		return MessageUtil.generateEmbedMessage(
			'Game Meetup Over',
			`The game of ${this._info.game} is over.
			The participants were: ${this._participants.map((p) => p.username).join(', ')}
			Thank you for using GameMeetup. If you find any bugs report to Frost`,
			0xff0000
		);
	}

	private generateChannelMessage(): MessageOptions {
		// mention all participants in message content
		const content = this._participants.map((p) => `<@${p.id}>`).join(' ');
		return {
			content: content,
			embeds: [this.generateEmbed()],
		};
	}

	private generateReminderMessage(): MessageOptions {
		const message = MessageUtil.generateEmbedMessage(
			'Game Meetup Reminder',
			`The game of ${this._info.game} is starting in 10 mins.`,
			0xffff00
		);
		message.content = `<#${this._channels.voiceChannel?.id}>`;
		return message;
	}

	private generateAbsentMessage(): MessageOptions {
		const message = MessageUtil.generateEmbedMessage(
			'Absent to Game Meetup',
			`You are absent from the game meetup for ${this._info.game}, please join or cancel.`,
			0xff0000
		);
		message.content = `<#${this._channels.voiceChannel?.id}>`;
		return message;
	}

	private generateMeetupStartedMessage(
		mention_channel: boolean
	): MessageOptions {
		const message = MessageUtil.generateEmbedMessage(
			'Game Meetup Started',
			`The game of ${this._info.game} is starting.`,
			0xffff00
		);
		if (mention_channel)
			message.content = `<#${this._channels.voiceChannel?.id}>`;
		return message;
	}

	private generateYouCanStillJoinMessage(): MessageOptions {
		const message = MessageUtil.generateEmbedMessage(
			'Game Meetup Reminder',
			`You can still join the game meetup for ${this._info.game}.\n
			there is still ${
				this._info.max_participants -
				(this._channels.voiceChannel?.members.size || 0)
			} places left.`,
			0xffff00
		);
		message.content = `<#${this._channels.voiceChannel?.id}>`;
		return message;
	}

	/*
	 ** this function will update all messages they act like components that will be refreshed
	 ** every time the game meetup is updated
	 */

	private updateMessages() {
		this._messages.generalMessage?.edit(this.generateGeneralMessage());
		this._messages.ownerMessage?.edit(this.generateOwnerMessage());
		this._messages.channelMessage?.edit(this.generateChannelMessage());
		this._participants.forEach((p) => {
			this._messages.participantsMessage[p.id]?.edit(
				this.generateParticipantMessage()
			);
		});

		this._maybe_participants.forEach((p) => {
			this._messages.maybeParticipantsMessage[p.id]?.edit(
				this.generateMaybeParticipantMessage()
			);
		});
		Logger.debug(`GameMeetup ${this.id} updated messages`);
	}

	private destroyButtons() {
		for (const [, value] of Object.entries(this._buttons)) {
			// for every component in the object
			value.components.forEach((b) => {
				// if the component is a button
				if (b.type === 'BUTTON' && b.customId)
					// remove the button
					this._buttonHandler.removeButton(b.customId);
			});
		}
		Logger.debug(`GameMeetup ${this.id} destroyed buttons`);
	}

	private delete() {
		this._timers.forEach((t) => clearTimeout(t));
		this.destroyButtons();
		this.deleteChannels();
		Logger.debug(`GameMeetup ${this.id} deleted`);
		this._removeMeetup(this);
	}

	private setAllMessages(message: MessageOptions) {
		this._messages.generalMessage?.edit(message);
		this._messages.ownerMessage?.edit(message);
		this._participants.forEach((p) => {
			this._messages.participantsMessage[p.id]?.delete();
			p.send(message);
		});
		this._maybe_participants.forEach((p) => {
			this._messages.maybeParticipantsMessage[p.id]?.edit(message);
		});
	}

	private cancel() {
		this.setAllMessages(this.generateCancelledMessage());
		Logger.debug(`GameMeetup ${this.id} cancelled`);
		this.delete();
	}

	private over() {
		this.setAllMessages(this.generateOverMessage());
		Logger.debug(`GameMeetup ${this.id} over`);
		this.delete();
	}

	/*
	 ** this function create a category for the game meetup
	 ** then add two channels to the category, all are public
	 ** one for voice and one for text
	 */

	private async createChannels() {
		this._channels.categoryChannel = await this._info.guild.channels.create(
			`${this._info.game}-game-meetup`,
			{
				type: ChannelTypes.GUILD_CATEGORY,
			}
		);

		this._channels.textChannel = await this._info.guild.channels.create(
			`${this._info.game}-text`,
			{
				type: ChannelTypes.GUILD_TEXT,
				parent: this._channels.categoryChannel,
			}
		);

		this._channels.voiceChannel = await this._info.guild.channels.create(
			`${this._info.game}-voice`,
			{
				type: ChannelTypes.GUILD_VOICE,
				parent: this._channels.categoryChannel,
			}
		);
		// send message to text channel
		this._messages.channelMessage = await this._channels.textChannel.send(
			this.generateChannelMessage()
		);
		Logger.debug(`GameMeetup: created channels for ${this._info.game}`);
	}

	private async deleteChannels() {
		await this._channels.categoryChannel?.delete();
		await this._channels.textChannel?.delete();
		await this._channels.voiceChannel?.delete();
	}

	private sendMesageToParticipantsNotInChannel(message: MessageOptions) {
		this._participants.forEach((p) => {
			if (
				!this._channels.voiceChannel?.members.find((m) => m.id === p.id)
			)
				p.send(message);
		});
	}

	private checkForOver() {
		if (this._channels.voiceChannel?.members.size === 0) {
			Logger.debug(
				`GameMeetup ${this.id} over because no one in the voice channel`
			);
			this.over();
		}
	}

	private async setupTimers() {
		const reminder_time = this._info.meetdate.getTime() - 10 * 60 * 1000;
		if (reminder_time > Date.now()) {
			this._timers.push(
				setTimeout(() => {
					Logger.debug(`GameMeetup ${this.id} reminder`);
					this.sendMesageToParticipantsNotInChannel(
						this.generateReminderMessage()
					);
				}, reminder_time - Date.now())
			);
		}

		// 30 minutes before the meetup create channels else create channel now
		const channel_time = this._info.meetdate.getTime() - 30 * 60 * 1000;
		if (channel_time > Date.now()) {
			this._timers.push(
				setTimeout(() => {
					Logger.debug(`GameMeetup ${this.id} create channels`);
					this.createChannels();
				}, channel_time - Date.now())
			);
		} else await this.createChannels();

		// on the meetup date send a message to all participants not in the channel
		this._timers.push(
			setTimeout(() => {
				this.sendMesageToParticipantsNotInChannel(
					this.generateMeetupStartedMessage(true)
				);
				this._channels.textChannel?.send(
					this.generateMeetupStartedMessage(false)
				);
			}, this._info.meetdate.getTime() - Date.now())
		);

		// every 15 after the meetup started check every 15 minutes if there is still people in voice chat
		/*this._timers.push(
			setInterval(() => {
				if (
					this._channels.voiceChannel?.members.size === 0 &&
					this._channels.textChannel?.members.size === 0
				) {
					this.over();
				}
			}, 15 * 60 * 1000)
		);*/

		// 15 minuter after start

		const end_check_time = this._info.meetdate.getTime();
		this._timers.push(
			setTimeout(() => {
				this._timers.push(
					setInterval(() => {
						Logger.debug(`GameMeetup ${this.id} check for over`);
						this.checkForOver();
					}, 15 * 60 * 1000)
				);
			}, end_check_time - Date.now())
		);

		// after 5 minutes after the meetup send started a notification to the participants not connected in the voice chat
		// and to all maybe participants if the meetup is not full
		const absent_time = this._info.meetdate.getTime() + 5 * 60 * 1000;
		if (absent_time > Date.now()) {
			this._timers.push(
				setTimeout(() => {
					Logger.debug(`GameMeetup ${this.id} send absent message`);
					this.sendMesageToParticipantsNotInChannel(
						this.generateAbsentMessage()
					);
					if (
						this._info.max_participants >
						(this._channels.voiceChannel?.members.size || 0)
					) {
						this._maybe_participants.forEach((p) => {
							if (
								!this._channels.voiceChannel?.members.find(
									(m) => m.id === p.id
								)
							)
								p.send(this.generateYouCanStillJoinMessage());
						});
					}
				}, absent_time - Date.now())
			);
		}
	}

	constructor(gameMeetOptions: GameMeetupOptions) {
		this._id = GameMeetup._nextId++;
		this._info = {
			creator: gameMeetOptions.creator,
			game: gameMeetOptions.game,
			meetdate: gameMeetOptions.meetdate,
			max_participants: gameMeetOptions.max_participants,
			guild: gameMeetOptions.guild,
		};

		this._participants = [this._info.creator];
		this._maybe_participants = [];
		this._buttonHandler = gameMeetOptions.buttonHandler;
		this._removeMeetup = gameMeetOptions.removeMeetup;
		this._timers = [];

		const generalButtonsTable: MessageButton[] = [];
		generalButtonsTable.push(
			this._buttonHandler.registerButton({
				label: 'Join',
				style: 'SUCCESS',
				action: (interaction: ButtonInteraction) => {
					this.addParticipant(interaction.user);
				},
			})
		);
		generalButtonsTable.push(
			this._buttonHandler.registerButton({
				label: 'Maybe',
				style: 'SECONDARY',
				action: (interaction: ButtonInteraction) => {
					this.addMaybeParticipant(interaction.user);
				},
			})
		);
		const generalButtons = new MessageActionRow().addComponents(
			generalButtonsTable
		);

		const participantButtonsTable: MessageButton[] = [];
		participantButtonsTable.push(
			this._buttonHandler.registerButton({
				label: 'Cancel',
				style: 'DANGER',
				action: (interaction: ButtonInteraction) => {
					// find the message_maybeParticipantsMessage]

					const participant_message =
						this._messages.participantsMessage[interaction.user.id];

					if (participant_message) {
						participant_message.edit(
							MessageUtil.generateEmbedMessage(
								`Game Meetup: ${
									this._info.game
								} ${TimeUtils.formatDateTimeTZ(
									this._info.meetdate
								)}`,
								'You canceled your participation.',
								0xff0000
							)
						);
						delete this._messages.participantsMessage[
							interaction.user.id
						];
					}
					this.removeParticipant(interaction.user);
				},
			})
		);
		const participantButtons = new MessageActionRow().addComponents(
			participantButtonsTable
		);

		const maybeParticipantButtonsTable: MessageButton[] = [];
		maybeParticipantButtonsTable.push(
			this._buttonHandler.registerButton({
				label: 'Confirm',
				style: 'SUCCESS',
				action: (interaction: ButtonInteraction) => {
					this.addParticipant(interaction.user);
				},
			})
		);
		maybeParticipantButtonsTable.push(
			this._buttonHandler.registerButton({
				label: 'Cancel',
				style: 'DANGER',
				action: (interaction: ButtonInteraction) => {
					this.removeMaybeParticipant(interaction.user);
					// find the message
					this._messages.maybeParticipantsMessage[
						interaction.user.id
					]?.edit(
						MessageUtil.generateEmbedMessage(
							`Game Meetup: ${
								this._info.game
							} ${TimeUtils.formatDateTimeTZ(this._info.meetdate)}`,
							'You canceled your participation.',
							0xff0000
						)
					);
					delete this._messages.maybeParticipantsMessage[
						interaction.user.id
					];
				},
			})
		);
		const maybeParticipantButtons = new MessageActionRow().addComponents(
			maybeParticipantButtonsTable
		);

		const ownerButtonsTable: MessageButton[] = [];
		ownerButtonsTable.push(
			this._buttonHandler.registerButton({
				label: 'Cancel',
				style: 'DANGER',
				action: () => this.cancel(),
			})
		);
		const ownerButtons = new MessageActionRow().addComponents(
			ownerButtonsTable
		);

		this._buttons = {
			generalButtons,
			ownerButtons,
			participantButtons,
			maybeParticipantButtons,
		};

		(async () => {
			this._messages.generalMessage = await gameMeetOptions.channel.send(
				this.generateGeneralMessage()
			);
			this._messages.ownerMessage = await gameMeetOptions.creator.send(
				this.generateOwnerMessage()
			);
		})();

		// 10 minutes before the meetup send a reminder to all participants
		// if the meetup is sooner than 10 minutes do nothing
		this.setupTimers();
		Logger.info(
			`GameMeetup ${this._id} created for ${
				this._info.game
			} ${TimeUtils.formatDateTimeTZ(this._info.meetdate)}`
		);
	}
}
