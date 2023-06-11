import { I2CADDR, MODE_EVENT_COUNTER } from './utils/constants';
import { PCF8583 } from './utils/PCF8583';
import { Series } from './utils/Series';
import { getPulsesFromSeries, WindSpeed } from './utils/utilities';

export class Anemometer {
	private readonly chip: PCF8583;
	private readInterval: NodeJS.Timer | null = null;
	private dataSeries: Series<number>;

	constructor(private readonly calc: (pulses: number, time: number) => WindSpeed, private readonly opts: AnemometerOptions = {}) {
		this.chip = new PCF8583(this.opts.address || I2CADDR, this.opts.bus || 1);
		this.dataSeries = new Series(this.opts.dataSeries?.expirationTime, this.opts.dataSeries?.maxElements);
		this.init();
	}

	private async init() {
		if (this.readInterval !== null) {
			clearInterval(this.readInterval);
			this.readInterval = null;
		}

		await this.chip.reset();
		await this.chip.setMode(MODE_EVENT_COUNTER);
		await this.chip.setCount(0);

		this.readInterval = setInterval(async () => {
			try {
				const count = await this.chip.getCount();
				this.dataSeries.addData(count);

				if (count > 900000) {
					await this.chip.setCount(0);
					this.dataSeries.addData(0);
				}

				this.dataSeries.cleanUp();
			} catch (e) {
				if (this.opts.readFailed !== undefined) {
					this.opts.readFailed(e);
				}
			}
		}, this.opts.readInterval || 1000);
	}

	/**
	 * Returns an array of numbers, where each number represents the I2C address of a detected device.
	 * @see https://github.com/fivdi/i2c-bus#busscanstartaddr-endaddr-cb
	 */
	async scan() {
		return this.chip.scan();
	}

	getData(time: number) {
		if (time <= 0 || time > this.dataSeries.expirationTime) {
			throw new Error(`The given time is not in range. Value is only valid between 1 and ${this.dataSeries.expirationTime}!`);
		}

		const { pulses, duration } = getPulsesFromSeries(this.dataSeries, time);

		return this.calc(pulses, duration);
	}

	isReady() {
		if (this.readInterval !== null) {
			return true;
		}

		return false;
	}

	async cleanUp() {
		if (this.readInterval !== null) {
			clearInterval(this.readInterval);
			this.readInterval = null;
		}

		await this.chip.cleanUp();
	}
}

export interface AnemometerOptions {
	bus?: number;
	address?: number;
	readInterval?: number;
	readFailed?: (error: unknown) => void;
	dataSeries?: {
		expirationTime?: number;
		maxElements?: number;
	};
}

// Provide legacy support
export default Anemometer;

export { calcFactor, WindSpeed, WindSpeedUnits } from './utils/utilities';
