import moment from 'moment';
import { I2CADDR, MODE_EVENT_COUNTER } from './utils/constants';
import { PCF8583 } from './utils/PCF8583';
import { Series } from './utils/Series';
import { WindSpeed } from './utils/utilities';

export class Anemometer {
	private readonly chip: PCF8583;
	private readInterval: NodeJS.Timer | null = null;
	private dataSeries = new Series();

	constructor(
		private readonly calc: (pulses: number, time: number) => WindSpeed,
		private readonly address = I2CADDR,
		private readonly bus = 1
	) {
		this.chip = new PCF8583(this.address, this.bus);
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
				console.error(e);
			}
		}, 1000);
	}

	async scan() {
		return this.chip.scan();
	}

	getData(time: number) {
		if (time <= 0 || time > this.dataSeries.maxTime) {
			throw new Error(`The given time is not in range. Value is only valid between 1 and ${this.dataSeries.maxTime}!`);
		}

		const { pulses, duration } = this.calculatePulsesFromSeries(time);

		return this.calc(pulses, duration);
	}

	private calculatePulsesFromSeries(time: number) {
		const data = this.dataSeries.getData(time);

		if (data.length === 0) {
			return { pulses: 0, duration: 0 };
		}

		const valueArray = data.map((data) => data.value);
		const nullPoint = valueArray[0] || 0;
		let count = 0;

		for (let i = 0; i < valueArray.length; i++) {
			if ((valueArray[i + 1] || 0) < valueArray[i]) {
				count += valueArray[i];
			}
		}

		const duration = moment.duration(moment(data[data.length - 1].unixTS).diff(moment(data[0].unixTS)));

		return { pulses: count - nullPoint, duration: duration.asSeconds() };
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

// Provide legacy support
export default Anemometer;

export { calcFactor, WindSpeed, WindSpeedUnits } from './utils/utilities';
