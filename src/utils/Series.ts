export class Series<T> {
	/**
	 * **Flow direction:**
	 * old data  <--  new data
	 */
	private data: DataRecord<T>[] = [];

	/**
	 * @param expirationTime Indication after how many seconds a data record loses validity
	 * @param maxElements Specifies the maximum number of data records to be stored temporarily. 0 is no limit.
	 */
	constructor(readonly expirationTime = 600, readonly maxElements = 700) {}

	private getUnixTS() {
		return Math.floor(new Date().getTime() / 1000);
	}

	addData(value: T) {
		if (this.maxElements !== 0 && this.data.length >= this.maxElements) {
			this.data.shift();
		}

		this.data.push({ value, timestamp: this.getUnixTS() });
	}

	getData(offset: number) {
		const ts = this.getUnixTS() - offset;
		return this.data.filter((data) => data.timestamp >= ts).sort((a, b) => (a.timestamp >= b.timestamp ? 1 : -1));
	}

	async cleanUp() {
		if (this.maxElements !== 0) {
			while (this.data.length > this.maxElements) {
				this.data.shift();
			}
		}

		const beginOfValidData = this.getUnixTS() - this.expirationTime + 1;

		for (const x of this.data) {
			if (x.timestamp >= beginOfValidData) {
				break;
			}

			this.data.shift();
		}
	}
}

export interface DataRecord<T> {
	value: T;
	timestamp: number;
}
