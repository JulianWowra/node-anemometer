import { openSync } from 'i2c-bus';
import { promisify } from 'util';
import { History } from './History';

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
	 * @param {number} value The numeric value of the WindSpeed.
	 * @param {WindSpeedUnits} unit The unit type (e.g., km/h, m/s, kn).
	 */
	constructor(
		readonly value: number,
		readonly unit: WindSpeedUnits
	) {}

	/**
	 * Rounds the WindSpeed value to a specified number of decimal places.
	 *
	 * @param {number} decimalPlaces The number of decimal places to round to.
	 * @returns {number} The rounded WindSpeed value.
	 */
	rounded(decimalPlaces = 1) {
		return round(this.value, decimalPlaces);
	}

	/**
	 * Converts the WindSpeed value to kilometers per hour (km/h).
	 *
	 * @returns {WindSpeed} A new WindSpeed instance with the value converted to km/h.
	 */
	toKilometersPerHour() {
		switch (this.unit) {
			case WindSpeedUnits.metersPerSecond: {
				return new WindSpeed(this.value * 3.6, WindSpeedUnits.kilometersPerHour);
			}
			case WindSpeedUnits.knots: {
				return new WindSpeed(this.value * 1.852, WindSpeedUnits.kilometersPerHour);
			}
			default:
				return this;
		}
	}

	/**
	 * Converts the WindSpeed value to meters per second (m/s).
	 *
	 * @returns {WindSpeed} A new WindSpeed instance with the value converted to m/s.
	 */
	toMetersPerSecond() {
		switch (this.unit) {
			case WindSpeedUnits.kilometersPerHour: {
				return new WindSpeed(this.value / 3.6, WindSpeedUnits.metersPerSecond);
			}
			case WindSpeedUnits.knots: {
				return new WindSpeed(this.value / 1.944, WindSpeedUnits.metersPerSecond);
			}
			default:
				return this;
		}
	}

	/**
	 * Converts the WindSpeed value to knots (kn).
	 *
	 * @returns {WindSpeed} A new WindSpeed instance with the value converted to knots.
	 */
	toKnots() {
		switch (this.unit) {
			case WindSpeedUnits.kilometersPerHour: {
				return new WindSpeed(this.value / 1.852, WindSpeedUnits.knots);
			}
			case WindSpeedUnits.metersPerSecond: {
				return new WindSpeed(this.value * 1.944, WindSpeedUnits.knots);
			}
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
 * @param {number} radius Radius between midpoint and edge of a cup in centimeters.
 * @param {number} adjustment Power loss due to mechanics (approximately 1.18).
 * @returns {number} The calculated factor.
 */
export function calcFactor(radius: number, adjustment: number) {
	return ((Math.PI * radius * 2) / 100000) * 3600 * adjustment;
}

/**
 * Converts a Binary-Coded Decimal (BCD) value to a byte.
 *
 * @param {number} value The BCD value to convert.
 * @returns {number} The converted byte value.
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
 * @param {number} value The byte value to convert.
 * @returns {number} The converted BCD value.
 * @throws {Error} If the input value is invalid.
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
 *
 * @async
 */
export async function scanBus(bus: number) {
	const wire = openSync(bus);
	const result = await promisify<number[]>(wire.scan)();

	wire.closeSync();
	return result;
}

/**
 * Runs a promise and handles any errors, optionally providing a fallback value.
 *
 * @async
 * @param {Promise<unknown>} promise The promise to run.
 * @param {U} returnOnFail The value to return on failure.
 * @param {(error: unknown) => void} onCatch A callback function to handle errors.
 * @returns {Promise<Awaited<Promise<unknown>> | U>} A promise that resolves with the result of the promise or the fallback value.
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
			} catch (e) {
				// do nothing
			}
		}
	}

	return returnOnFail as U;
}

/**
 * Calculates the sum of pulses from a history object within a specified offset.
 *
 * @param {History<number>} history The history object containing pulse data.
 * @param {number} time The offset for which to calculate the sum of pulses.
 * @returns {object} An object containing the sum of pulses and duration within the specified time offset.
 */
export function sumPulsesFromHistory(history: History<number>, time: number) {
	const data = history.get(time);

	if (data.length === 0) {
		return { pulses: 0, duration: 0 };
	}

	const duration = data[data.length - 1].timestamp - data[0].timestamp;
	const startValue = data[0].value;
	let count = 0;

	for (let i = 0; i < data.length; i++) {
		if ((data[i + 1]?.value || 0) < data[i].value) {
			count += data[i].value;
		}
	}

	return { pulses: count - startValue, duration };
}
