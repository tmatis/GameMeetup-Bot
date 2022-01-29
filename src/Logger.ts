/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 ** colored logs
 */

export class Logger {
	static info(message?: any, ...optionalParams: any[]) {
		console.log(
			'[\x1b[1m\x1b[37mINFO\x1b[0m\x1b[0m]',
			message,
			...optionalParams
		);
	}

	static error(message?: any, ...optionalParams: any[]) {
		console.log('[\x1b[31mERROR\x1b[0m]', message, ...optionalParams);
	}

	static warn(message?: any, ...optionalParams: any[]) {
		console.log('[\x1b[33mWARN\x1b[0m]', message, ...optionalParams);
	}

	static debug(message?: any, ...optionalParams: any[]) {
		if (process.env.RUN_ENV === 'DEBUG')
			console.log('[\x1b[34mDEBUG\x1b[0m]', message, ...optionalParams);
	}

	static success(message?: any, ...optionalParams: any[]) {
		console.log('[\x1b[32mSUCCESS\x1b[0m]', message, ...optionalParams);
	}

	static log(message?: any, ...optionalParams: any[]) {
		console.log(message, ...optionalParams);
	}
}
