import { openSync } from 'i2c-bus';
import type { DataRecord } from './History';

export enum WindSpeedUnits {
	kilometersPerHour = 'km/h',
	metersPerSecond = 'm/s',
	knots = 'kn'
}

/**
 * Represents a WindSpeed unit with the specified value and unit type.
 */
export class WindSpeed {
	/**
	 * Creates an instance of WindSpeed with a numeric value and unit type.
	 *
	 * @param value The numeric value of the WindSpeed.
	 * @param unit The unit type (e.g., km/h, m/s, kn).
	 */
	constructor(
		readonly value: number,
		readonly unit: WindSpeedUnits
	) {}

	/**
	 * Rounds the WindSpeed value to a specified number of decimal places.
	 *
	 * @param decimalPlaces The number of decimal places to round to.
	 * @returns The rounded WindSpeed value.
	 */
	rounded(decimalPlaces = 1) {
		return round(this.value, decimalPlaces);
	}

	/**
	 * Converts the WindSpeed value to kilometers per hour (km/h).
	 *
	 * @returns A new WindSpeed instance with the value converted to km/h.
	 */
	toKilometersPerHour() {
		switch (this.unit) {
			case WindSpeedUnits.metersPerSecond:
				return new WindSpeed(this.value * 3.6, WindSpeedUnits.kilometersPerHour);

			case WindSpeedUnits.knots:
				return new WindSpeed(this.value * 1.852, WindSpeedUnits.kilometersPerHour);

			default:
				return this;
		}
	}

	/**
	 * Converts the WindSpeed value to meters per second (m/s).
	 *
	 * @returns A new WindSpeed instance with the value converted to m/s.
	 */
	toMetersPerSecond() {
		switch (this.unit) {
			case WindSpeedUnits.kilometersPerHour:
				return new WindSpeed(this.value / 3.6, WindSpeedUnits.metersPerSecond);

			case WindSpeedUnits.knots:
				return new WindSpeed(this.value / 1.944, WindSpeedUnits.metersPerSecond);

			default:
				return this;
		}
	}

	/**
	 * Converts the WindSpeed value to knots (kn).
	 *
	 * @returns A new WindSpeed instance with the value converted to knots.
	 */
	toKnots() {
		switch (this.unit) {
			case WindSpeedUnits.kilometersPerHour:
				return new WindSpeed(this.value / 1.852, WindSpeedUnits.knots);

			case WindSpeedUnits.metersPerSecond:
				return new WindSpeed(this.value * 1.944, WindSpeedUnits.knots);

			default:
				return this;
		}
	}
}

/**
 * Rounds a number to a specified number of decimal places.
 *
 * @param value The number to be rounded.
 * @param decimalPlaces The number of decimal places to round to.
 * @returns The rounded number.
 * Sleeps for a specified number of milliseconds.
 * @param ms The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified time.
 */
export async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
 */
export function round(value: number, decimalPlaces: number) {
	if (value % 1 !== 0) {
		const i = Math.pow(10, decimalPlaces);
		return Math.round((value + Number.EPSILON) * i) / i;
	}

	return value;
}

/**
 * Calculates the animeter factor based on radius and adjustment.
 *
 * __Calculation explained:__
 * 1. Scope calculation (π * r * 2)
 * 2. Convert centimeter to kilometer ( / 100000)
 * 3. Convert to kilometers per hour ( * 3600)
 * 4. Multiply adjustment
 *
 * @param radius Radius between midpoint and edge of a cup in centimeters.
 * @param adjustment Power loss due to mechanics (approximately 1.18).
 * @returns The calculated factor.
 */
export function calcFactor(radius: number, adjustment: number) {
	return ((Math.PI * radius * 2) / 100000) * 3600 * adjustment;
}

/**
 * Converts a Binary-Coded Decimal (BCD) value to a byte.
 *
 * @param value The BCD value to convert.
 * @returns The converted byte value.
 */
export function bcdToByte(value: number) {
	if (value >> 4 > 9 || (value & 0x0f) > 9) {
		throw new Error(`Invalid value for byte convertion: ${value.toString(16)}`);
	}

	return (value >> 4) * 10 + (value & 0x0f);
}

/**
 * Converts a byte value to Binary-Coded Decimal (BCD) format.
 *
 * @param value The byte value to convert.
 * @returns The converted BCD value.
 * @throws If the input value is invalid.
 */
export function byteToBCD(value: number) {
	if (value >= 100) {
		throw new Error(`Invalid value for bcd convertion:  ${value}`);
	}

	return ((value / 10) << 4) + (value % 10);
}

/**
 * Returns an array of numbers, where each number represents the I2C address of a detected device.
 * @see https://github.com/fivdi/i2c-bus#busscanstartaddr-endaddr-cb
 */
export function scanBus(...args: Parameters<typeof openSync>) {
	const wire = openSync(...args);
	const result = wire.scanSync();

	wire.closeSync();
	return result;
}

/**
 * Runs a promise and handles any errors, optionally providing a fallback value.
 *
 * @param promise The promise to run.
 * @param returnOnFail The value to return on failure.
 * @param onCatch A callback function to handle errors.
 *
 * @returns A promise that resolves with the result of the promise or the fallback value.
 */
export async function runSave<T extends Promise<unknown>, U = undefined>(
	promise: T,
	returnOnFail?: U,
	onCatch?: (error: unknown) => void
): Promise<Awaited<T> | U> {
	try {
		return await promise;
	} catch (e) {
		if (onCatch) {
			try {
				onCatch(e);
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (e) {
				// do nothing
			}
		}
	}

	return returnOnFail as U;
}

/**
 * Evaluates the total pulses and the duration based on the data records.
 * This function calculates the total number of pulses (revolutions) considering possible sensor resets
 * and the time span between the first and last record.
 *
 * @param data An array of data records containing the value and timestamp of each record.
 * @returns An object with the total pulses and the duration in seconds.
 */
export function getTotalPulses(data: DataRecord<number>[]) {
	if (data.length === 0) {
		return { pulses: 0, timeSpan: 0 };
	}

	let pulses = 0;
	let previousValue = data[0].value;

	for (const record of data) {
		if (record.value >= previousValue) {
			pulses += record.value - previousValue;
		} else {
			pulses += record.value;
		}

		previousValue = record.value;
	}

	const timeSpan = data[data.length - 1].timestamp - data[0].timestamp;
	return { pulses, timeSpan };
}

/**
 * Calculates the maximum rate of increase between consecutive data records.
 * This function identifies the maximum rate of increase (pulses per second) between any two consecutive records,
 * along with the step (number of pulses) and time span (in seconds) for that maximum rate.
 *
 * @param data An array of data records containing the value and timestamp of each record.
 * @returns An object with the maximum rate of increase, the corresponding step, and time span.
 */
export function getMaxIncreaseRate(data: DataRecord<number>[]) {
	if (data.length < 2) {
		return { rate: 0, step: 0, timeSpan: 0 };
	}

	let maxRate = 0;
	let maxStep = 0;
	let maxTimeSpan = 0;

	for (let i = 0; i < data.length - 1; i++) {
		const startRecord = data[i];
		const endRecord = data[i + 1];

		const step = endRecord.value - startRecord.value;
		const timeSpan = endRecord.timestamp - startRecord.timestamp;

		if (timeSpan > 0) {
			const rate = step / timeSpan;

			if (rate > maxRate) {
				maxRate = rate;
				maxStep = step;
				maxTimeSpan = timeSpan;
			}
		}
	}

	return { rate: maxRate, step: maxStep, timeSpan: maxTimeSpan };
}
