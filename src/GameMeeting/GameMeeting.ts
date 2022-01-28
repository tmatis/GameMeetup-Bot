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
	GameMeetingButtons,
	GameMeetingChannels,
	GameMeetingInfo,
	GameMeetingMessages,
	GameMeetingOptions,
} from './GMTypes';
import { MessageUtil } from '../MessageUtil';

/*
 ** Game Meeting
 ** - The owner receive a message with the meeting information and a cancel button
 ** - the channel where the meeting is created receive a message with the meeting information and joins button
 ** - if someone joins, he receive a message with the meeting information and a cancel button
 ** - a notification is sent 10 minutes before the meeting
 ** - a second notification is sent 5 minutes after the meeting if the user is not in the voice channel
 ** - the category, voice channel and text channel are created 30 minutes before the meeting of instant if
 ** the meeting date is bellow 30 minutes
 ** - every 30 minutes the meeting check if the meeting is still active, if not, it is removed
 ** - if the meeting is removed, the channel is deleted
 ** - if the ownder cancel the meeting, the channel is deleted
 ** - if the meeting is not full ask maybe participants to join 5 minutes before the meeting
 */

export class GameMeeting {
	private static _nextId = 0;

	private _id: number;
	private _participants: User[];
	private _maybe_participants: User[];
	private _buttonHandler: ButtonHandler;
	private _removeMeeting: (meeting: GameMeeting) => void;
	private _timers: NodeJS.Timeout[];

	private _info: GameMeetingInfo;
	private _buttons: GameMeetingButtons;
	private _messages: GameMeetingMessages = {
		generalMessage: undefined,
		ownerMessage: undefined,
		channelMessage: undefined,
		participantsMessage: {},
		maybeParticipantsMessage: {},
	}; // we need to init here to avoid ts error

	private _channels: GameMeetingChannels = {
		categoryChannel: undefined,
		textChannel: undefined,
		voiceChannel: undefined,
	}; // we need to init here to avoid ts error

	/*
	 ** format date to string HH:MM
	 */

	public static formatDate(date: Date): string {
		// we need to add 0 if only one digit
		const hours =
			date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
		const minutes =
			date.getMinutes() < 10
				? `0${date.getMinutes()}`
				: date.getMinutes();
		return `${hours}:${minutes}`;
	}

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
		this.updateMessages();
	}

	private generateEmbed(): MessageEmbed {
		const embed = new MessageEmbed();

		// the title will be in the format "Game Meeting: <game> hh:mm"
		const title = `Game Meeting: ${
			this._info.game
		} ${GameMeeting.formatDate(this._info.meetdate)}`;
		embed.setTitle(title);
		embed.setColor(0x00ff00);
		embed.setDescription(
			`${this._info.creator.username} created this game meeting.`
		);

		// add field about number of participants

		if (this._info.max_participants !== Infinity)
			embed.addField(
				'Participants',
				`${this._participants.length}/${this._info.max_participants}${
					this._participants.length >= this._info.max_participants
						? ' (full)'
						: ''
				}`,
				false
			);

		// add the participants each participant is a field

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
				'You created this game meeting, you can cancel it by clicking the button below.',
			embeds: [this.generateEmbed()],
			components: [this._buttons.ownerButtons],
		};
	}

	private generateParticipantMessage(): MessageOptions {
		return {
			content: 'You joined a game meeting, please be present or cancel.',
			embeds: [this.generateEmbed()],
			components: [this._buttons.participantButtons],
		};
	}

	private generateMaybeParticipantMessage(): MessageOptions {
		return {
			content:
				'You are maybe participating in a game meeting, confirm or cancel.',
			embeds: [this.generateEmbed()],
			components:
				this._participants.length >= this._info.max_participants
					? []
					: [this._buttons.maybeParticipantButtons],
		};
	}

	private generateCancelledMessage(): MessageOptions {
		const message = MessageUtil.generateEmbedMessage(
			'Game Meeting Cancelled',
			`The game meeting for ${this._info.game} was cancelled by ${this._info.creator.username}.`,
			0xff0000
		);
		message.content = 'Canceled';
		return message;
	}

	private generateReminderMessage(): MessageOptions {
		return MessageUtil.generateEmbedMessage(
			'Game Meeting Reminder',
			`The game of ${this._info.game} is starting in 10 mins.`,
			0xffff00
		);
	}

	private generateOverMessage(): MessageOptions {
		return MessageUtil.generateEmbedMessage(
			'Game Meeting Over',
			`The game of ${this._info.game} is over.
			The participants were: ${this._participants.map((p) => p.username).join(', ')}
			Thank you for using GameMeeting. If you find any bugs report to Frost`,
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

	private generateAbsentMessage(): MessageOptions {
		return MessageUtil.generateEmbedMessage(
			'Absent to Game Meeting',
			`You are absent from the game meeting for ${this._info.game}, please join or cancel.`,
			0xff0000
		);
	}

	private generateMeetingStartedMessage(): MessageOptions {
		return MessageUtil.generateEmbedMessage(
			'Game Meeting Started',
			`The game of ${this._info.game} is starting.`,
			0xffff00
		);
	}

	/*
	 ** this function will update all messages they act like components that will be refreshed
	 ** every time the game meeting is updated
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
	}

	private delete() {
		this._timers.forEach((t) => clearTimeout(t));
		this.destroyButtons();
		this.deleteChannels();
		this._removeMeeting(this);
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
		this.delete();
	}

	private over() {
		this.setAllMessages(this.generateOverMessage());
		this.delete();
	}

	/*
	 ** this function create a category for the game meeting
	 ** then add two channels to the category, all are public
	 ** one for voice and one for text
	 */

	private async createChannels() {
		this._channels.categoryChannel = await this._info.guild.channels.create(
			`${this._info.game}-game-meeting`,
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

	private setupTimers() {
		const reminder_time = this._info.meetdate.getTime() - 10 * 60 * 1000;
		if (reminder_time > Date.now()) {
			this._timers.push(
				setTimeout(() => {
					this.sendMesageToParticipantsNotInChannel(
						this.generateReminderMessage()
					);
				}, reminder_time - Date.now())
			);
		}

		// 30 minutes before the meeting create channels else create channel now
		const channel_time = this._info.meetdate.getTime() - 30 * 60 * 1000;
		if (channel_time > Date.now()) {
			this._timers.push(
				setTimeout(() => {
					this.createChannels();
				}, channel_time - Date.now())
			);
		} else this.createChannels();

		// on the meeting date send a message to all participants not in the channel
		this._timers.push(
			setTimeout(() => {
				this.sendMesageToParticipantsNotInChannel(
					this.generateMeetingStartedMessage()
				);
				this._channels.textChannel?.send(
					this.generateMeetingStartedMessage()
				);
			}, this._info.meetdate.getTime() - Date.now())
		);

		// every 15 after the meeting started check every 15 minutes if there is still people in voice chat
		const check_time = this._info.meetdate.getTime() + 15 * 60 * 1000;
		this._timers.push(
			setInterval(() => {
				if (check_time < Date.now()) {
					if (
						this._channels.voiceChannel &&
						this._channels.voiceChannel.members.size === 0
					) {
						this.over();
					}
				}
			}, 15 * 60 * 1000)
		);

		// after 5 minutes after the meeting send started a notification to the participants not connected in the voice chat
		const absent_time = this._info.meetdate.getTime() + 5 * 60 * 1000;
		if (absent_time > Date.now()) {
			this._timers.push(
				setTimeout(() => {
					this.sendMesageToParticipantsNotInChannel(
						this.generateAbsentMessage()
					);
				}, absent_time - Date.now())
			);
		}
	}

	constructor(gameMeetOptions: GameMeetingOptions) {
		this._id = GameMeeting._nextId++;
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
		this._removeMeeting = gameMeetOptions.removeMeeting;
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
								`Game Meeting: ${
									this._info.game
								} ${GameMeeting.formatDate(
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
							`Game Meeting: ${
								this._info.game
							} ${GameMeeting.formatDate(this._info.meetdate)}`,
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

		// 10 minutes before the meeting send a reminder to all participants
		// if the meeting is sooner than 10 minutes do nothing
		this.setupTimers();
	}
}