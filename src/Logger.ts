/*
 ** colored logs
 */

export class Logger {
	static info(message: string) {
		console.log(`[\x1b[1m\x1b[37mINFO\x1b[0m\x1b[0m] ${message}`);
	}

	static error(message: string) {
		console.log(`[\x1b[31mERROR\x1b[0m] ${message}`);
	}

	static warn(message: string) {
		console.log(`[\x1b[33mWARN\x1b[0m] ${message}`);
	}

	static debug(message: string) {
		console.log(`[\x1b[34mDEBUG\x1b[0m] ${message}`);
	}

	static success(message: string) {
		console.log(`[\x1b[32mSUCCESS\x1b[0m] ${message}`);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static log(message?: any, ...optionalParams: any[]) {
		if (process.env.RUN_ENV === 'DEBUG')
			console.log(message, ...optionalParams);
	}
}
