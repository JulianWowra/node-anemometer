import type { SetIntervalAsyncTimer } from 'set-interval-async/dynamic';
import { clearIntervalAsync, setIntervalAsync } from 'set-interval-async/dynamic';
import { I2CADDR, PCF8583Mode } from './utils/constants';
import { type GetDataConditions, History, type TimeCondition } from './utils/History';
import { PCF8583 } from './utils/PCF8583';
import { getMaxIncreaseRate, getTotalPulses, runSave, type WindSpeed } from './utils/utilities';

/**
 * Represents an Anemometer device for measuring wind speed using a PCF8583 real-time clock module.
 * This class allows you to read wind speed data, calculate wind speed values, and maintain a history
 * of pulse counts to determine wind speed over time.
 */
export class Anemometer {
	private readonly chip: PCF8583;
	private readonly history: History<number>;
	private readInterval: SetIntervalAsyncTimer<[]> | null = null;

	/**
	 * Creates an instance of the Anemometer class, which interfaces with a PCF8583 module.
	 *
	 * @param calc A function that calculates WindSpeed based on pulse count and time.
	 * @param opts Optional configuration options for the Anemometer.
	 */
	constructor(
		private readonly calc: (pulses: number, time: number) => WindSpeed,
		private readonly opts: AnemometerOptions = {}
	) {
		this.chip = new PCF8583(this.opts.address ?? I2CADDR, this.opts.bus ?? 1);
		this.history = new History(this.opts.history?.expirationTime, this.opts.history?.maxElements);
	}

	/**
	 * Indicator of whether a connection has been established and the data is being read..
	 *
	 * @readonly
	 * @returns `true` if the connection is ready; otherwise, `false`.
	 */
	get isReady() {
		return this.readInterval !== null;
	}

	/*
	 * ==========================================
	 *             Private functions
	 * ==========================================
	 */

	/**
	 * Resets the PCF8583 chip to its default values and initializes it for event counting mode.
	 *
	 * @returns A promise that resolves when the chip is successfully reset and initialized.
	 */
	private async resetChip() {
		await this.chip.reset();
		await this.chip.setMode(PCF8583Mode.COUNTER);

		await this.chip.setCount(0);
		this.history.push(0);
	}

	/*
	 * ==========================================
	 *              Public functions
	 * ==========================================
	 */

	/**
	 * Opens the i2c connection and start the reading data.
	 *
	 * @returns A promise that resolves when the connection is successfully opened.
	 */
	async open() {
		if (this.readInterval !== null) {
			await clearIntervalAsync(this.readInterval);
			this.readInterval = null;
		}

		await this.chip.open();
		await this.resetChip();

		this.readInterval = setIntervalAsync(async () => {
			let count: number | null = null;

			for (let i = 0; i < (this.opts.retries ?? 3); i++) {
				count = await runSave(this.chip.getCount(), null, this.opts.readFailed);

				if (count !== null) {
					break;
				}
			}

			if (count === null) {
				return await runSave(this.resetChip());
			}

			this.history.clean();
			this.history.push(count);

			if (count > 900000) {
				await this.chip.setCount(0);
				this.history.push(0);
			}
		}, this.opts.readInterval ?? 1000);
	}

	/**
	 *  Calculates the average wind speed of the past x seconds.
	 *
	 * @deprecated Use `.getAverageWindSpeed()` instead of `.getData()`
	 * @param time The offset for which to retrieve wind speed data.
	 * @returns The average WindSpeed data for the specified time.
	 */
	getData(time: number) {
		if (time <= 0 || time > this.history.expirationTime) {
			throw new Error(`The given time is not in range. Value is only valid between 1 and ${this.history.expirationTime}!`);
		}

		const data = this.history.get({ recentSeconds: time });
		const { pulses, timeSpan } = getTotalPulses(data);

		return this.calc(pulses, timeSpan);
	}

	/**
	 * Retrieves data records based on the specified conditions.
	 *
	 * @param conditions The conditions to filter and retrieve the data records.
	 * @returns An copied array of data records. Each record includes a value and a timestamp.
	 */
	getHistoryData(conditions: GetDataConditions) {
		return this.history.get(conditions);
	}

	/**
	 * Calculates the average wind speed over a specified time period.
	 * The average wind speed is computed from the total pulses and the time span of the data records.
	 *
	 * @param conditions Optional time conditions to filter the data.
	 * @returns The average wind speed calculated from the data records.
	 */
	getAverageWindSpeed(conditions: TimeCondition = {}) {
		const data = this.history.get(conditions);
		const { pulses, timeSpan } = getTotalPulses(data);

		return this.calc(pulses, timeSpan);
	}

	/**
	 * Finds the peak wind gust within a specified time period.
	 * The peak wind gust is determined by finding the largest increase in pulse values and the corresponding time span.
	 *
	 * @param conditions Optional time conditions to filter the data.
	 * @returns The peak wind gust calculated from the data records.
	 */
	getPeakWindGust(conditions: TimeCondition = {}) {
		const data = this.history.get(conditions);
		const { step, timeSpan } = getMaxIncreaseRate(data);

		return this.calc(step, timeSpan);
	}

	/**
	 * Closes the i2c connection and stops reading prozess.
	 *
	 * @returns A promise that resolves when the Anemometer is successfully closed.
	 */
	async close() {
		if (this.readInterval !== null) {
			await clearIntervalAsync(this.readInterval);
			this.readInterval = null;
		}

		await this.chip.close();
	}
}

/**
 * Anemometer configuration options.
 */
export type AnemometerOptions = {
	bus?: number;
	address?: number;
	readInterval?: number;
	retries?: number;
	readFailed?: (error: unknown) => void;
	history?: {
		expirationTime?: number;
		maxElements?: number;
	};
};

// Provide legacy support
export default Anemometer;

export type { GetDataConditions, DataRecord as HistoryDataRecord, TimeCondition } from './utils/History';
export { calcFactor, scanBus, WindSpeed, WindSpeedUnits } from './utils/utilities';
