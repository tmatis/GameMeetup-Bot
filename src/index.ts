import { DiscordBot } from './DiscordBot';
import { config } from 'dotenv';
import { Logger } from './Logger';

const main = async () => {
	if (process.env.RUN_ENV !== 'PROD') config();

	if (!process.env.PREFIX) {
		Logger.error('No PREFIX set in env');
		process.exit(1);
	}

	if (!process.env.BOT_TOKEN) {
		Logger.error('No BOT_TOKEN set in env');
		process.exit(1);
	}

	const discordBot = new DiscordBot(process.env.PREFIX);

	discordBot.login(process.env.BOT_TOKEN);
};

main();
