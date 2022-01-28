import {
	CategoryChannel,
	Guild,
	Message,
	MessageActionRow,
	TextChannel,
	User,
	VoiceChannel,
} from 'discord.js';
import { ButtonHandler } from '../ButtonHandler';
import { GenericChannel } from '../MessageUtil';
import { GameMeetup } from './GameMeetup';

export type GameMeetupOptions = {
	channel: GenericChannel;
	creator: User;
	game: string;
	meetdate: Date;
	buttonHandler: ButtonHandler;
	max_participants: number;
	guild: Guild;
	removeMeetup: (meetup: GameMeetup) => void;
};

export type GameMeetupInfo = {
	creator: User;
	game: string;
	meetdate: Date;
	max_participants: number;
	guild: Guild;
};

export type GameMeetupButtons = {
	generalButtons: MessageActionRow;
	ownerButtons: MessageActionRow;
	participantButtons: MessageActionRow;
	maybeParticipantButtons: MessageActionRow;
};

export type GameMeetupMessages = {
	generalMessage?: Message;
	ownerMessage?: Message;
	channelMessage?: Message;
	participantsMessage: { [userid: string]: Message | undefined };
	maybeParticipantsMessage: { [userid: string]: Message | undefined };
};

export type GameMeetupChannels = {
	categoryChannel?: CategoryChannel;
	textChannel?: TextChannel;
	voiceChannel?: VoiceChannel;
};
