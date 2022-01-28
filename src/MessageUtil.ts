import {
	DMChannel,
	MessageEmbed,
	MessageOptions,
	NewsChannel,
	PartialDMChannel,
	TextChannel,
	ThreadChannel,
} from 'discord.js';

export type GenericChannel =
	| DMChannel
	| PartialDMChannel
	| NewsChannel
	| TextChannel
	| ThreadChannel;

export class MessageUtil {
	public static sendErrorMessage(channel: GenericChannel, error: string) {
		const embed = new MessageEmbed();

		embed.setTitle('Error');
		embed.setDescription(error);
		embed.setColor('#ff0000');

		channel.send({ embeds: [embed] });
	}

	public static generateEmbedMessage(
		title: string,
		description: string,
		color: number
	): MessageOptions {
		const embed = new MessageEmbed();

		embed.setTitle(title);
		embed.setDescription(description);
		embed.setColor(color);

		return { embeds: [embed], components: [] };
	}
}
