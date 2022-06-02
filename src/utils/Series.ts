import moment from 'moment';

interface DataSet {
	value: number;
	unixTS: number;
}

export class Series {
	// Flow direction
	// old data    <----    new data
	private data: DataSet[] = [];

	constructor(
		readonly maxTime = 600, // Seconds
		readonly maxEntries = 700 // Set the value to 0 if there should be no limit
	) {}

	addData(value: number) {
		if (this.maxEntries !== 0 && this.data.length >= this.maxEntries) {
			this.data.shift();
		}

		this.data.push({ value, unixTS: moment().valueOf() });
	}

	getData(time: number) {
		const ts = moment()
			.utc()
			.subtract(time + 1, 'seconds');

		const s = (a: DataSet, b: DataSet) => {
			if (moment(a.unixTS).utc().isSameOrAfter(b.unixTS)) {
				return 1;
			}

			return -1;
		};

		return this.data.filter((data) => ts.isSameOrBefore(data.unixTS, 'seconds')).sort(s);
	}

	async cleanUp() {
		if (this.maxEntries !== 0) {
			while (this.data.length > this.maxEntries) {
				this.data.shift();
			}
		}

		for (const x of this.data) {
			if (moment().valueOf() <= moment(x.unixTS).add(this.maxTime, 'seconds').valueOf()) {
				break;
			}

			this.data.shift();
		}
	}
}
