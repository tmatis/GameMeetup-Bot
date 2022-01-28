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
import { GameMeeting } from './GameMeeting';

export type GameMeetingOptions = {
	channel: GenericChannel;
	creator: User;
	game: string;
	meetdate: Date;
	buttonHandler: ButtonHandler;
	max_participants: number;
	guild: Guild;
	removeMeeting: (meeting: GameMeeting) => void;
};

export type GameMeetingInfo = {
	creator: User;
	game: string;
	meetdate: Date;
	max_participants: number;
	guild: Guild;
};

export type GameMeetingButtons = {
	generalButtons: MessageActionRow;
	ownerButtons: MessageActionRow;
	participantButtons: MessageActionRow;
	maybeParticipantButtons: MessageActionRow;
};

export type GameMeetingMessages = {
	generalMessage?: Message;
	ownerMessage?: Message;
	channelMessage?: Message;
	participantsMessage: { [userid: string]: Message | undefined };
	maybeParticipantsMessage: { [userid: string]: Message | undefined };
};

export type GameMeetingChannels = {
	categoryChannel?: CategoryChannel;
	textChannel?: TextChannel;
	voiceChannel?: VoiceChannel;
};
