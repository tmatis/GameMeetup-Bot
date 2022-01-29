export class TimeUtils {
	public static formatDateTimeTZ(date: Date): string {
		// we need to add 0 if only one digit
		const timeZoneDate: Date = date;
		const hours = timeZoneDate.getHours() < 10 ? `0${timeZoneDate.getHours()}` : timeZoneDate.getHours();
		const minutes = timeZoneDate.getMinutes() < 10 ? `0${timeZoneDate.getMinutes()}` : timeZoneDate.getMinutes();
		return `${hours}:${minutes}`;
	}

	/*
	** parse date as hh:mm
	*/
	public static parseDateTZ(date_string: string): Date {
		if (!/^[0-9]{2}:[0-9]{2}$/.test(date_string)) {
			throw new Error('Bad date format! Use `need hh:mm`');
		}
		const date = new Date();
		const hour = parseInt(date_string.split(':')[0]);
		const minute = parseInt(date_string.split(':')[1]);
		date.setHours(hour);
		date.setMinutes(minute);
		// timezone offset apply

		const actualDate = new Date();

		if (date.getTime() < actualDate.getTime()) {
			date.setDate(date.getDate() + 1);
		}

		if (isNaN(date.getTime())) {
			throw new Error('the date is not valid');
		}
		return date;
	}
}
