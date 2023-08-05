import { clearIntervalAsync, setIntervalAsync, SetIntervalAsyncTimer } from 'set-interval-async/dynamic';
import { I2CADDR, MODE_EVENT_COUNTER } from './utils/constants';
import { PCF8583 } from './utils/PCF8583';
import { Series } from './utils/Series';
import { getPulsesFromSeries, runSave, WindSpeed } from './utils/utilities';

export class Anemometer {
	private readonly chip: PCF8583;
	private readInterval: SetIntervalAsyncTimer<[]> | null = null;
	private dataSeries: Series<number>;

	constructor(
		private readonly calc: (pulses: number, time: number) => WindSpeed,
		private readonly opts: AnemometerOptions = {}
	) {
		this.chip = new PCF8583(this.opts.address || I2CADDR, this.opts.bus || 1);
		this.dataSeries = new Series(this.opts.dataSeries?.expirationTime, this.opts.dataSeries?.maxElements);
	}

	get isReady() {
		return this.readInterval !== null;
	}

	async start() {
		if (this.readInterval !== null) {
			await clearIntervalAsync(this.readInterval);
			this.readInterval = null;
		}

		await this.resetChip();

		const evaluate = async () => {
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

			this.dataSeries.addData(count);

			if (count > 900000) {
				await this.chip.setCount(0);
				this.dataSeries.addData(0);
			}
		};

		this.readInterval = setIntervalAsync(async () => !!this.dataSeries.cleanUp() && (await evaluate()), this.opts.readInterval || 1000);
	}

	getData(time: number) {
		if (time <= 0 || time > this.dataSeries.expirationTime) {
			throw new Error(`The given time is not in range. Value is only valid between 1 and ${this.dataSeries.expirationTime}!`);
		}

		const { pulses, duration } = getPulsesFromSeries(this.dataSeries, time);

		return this.calc(pulses, duration);
	}

	async close() {
		if (this.readInterval !== null) {
			await clearIntervalAsync(this.readInterval);
			this.readInterval = null;
		}

		await this.chip.close();
	}

	private async resetChip() {
		await this.chip.reset();
		await this.chip.setMode(MODE_EVENT_COUNTER);

		await this.chip.setCount(0);
		this.dataSeries.addData(0);
	}
}

export type AnemometerOptions = {
	bus?: number;
	address?: number;
	readInterval?: number;
	retries?: number;
	readFailed?: (error: unknown) => void;
	dataSeries?: {
		expirationTime?: number;
		maxElements?: number;
	};
};

// Provide legacy support
export default Anemometer;

export { calcFactor, scanBus, WindSpeed, WindSpeedUnits } from './utils/utilities';
