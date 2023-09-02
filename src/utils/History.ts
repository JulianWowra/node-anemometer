/**
 * Represents a history of data records.
 */
export class History<T> {
	/**
	 * **Flow direction:**
	 * old data  <--  new data
	 */
	private data: DataRecord<T>[] = [];

	/**
	 * Creates a new instance of the History class.
	 *
	 * @param expirationTime Specifies after how many seconds a data record should be deleted.
	 * @param maxElements Specifies the maximum number of data records to be stored. 0 means no limit.
	 */
	constructor(
		readonly expirationTime = 600,
		readonly maxElements = 700
	) {}

	/**
	 * Inserts a new data record into the history.
	 *
	 * @param value The value to be added to the history.
	 */
	push(value: T) {
		if (this.maxElements !== 0 && this.data.length >= this.maxElements) {
			this.data.shift();
		}

		this.data.push({ value, timestamp: this.getUnixTS() });
	}

	/**
	 * Retrieves data records from the history based on specified conditions.
	 *
	 * @param conditions The conditions for retrieving data records.
	 * @returns An array of data records that match the specified conditions.
	 */
	get(offset: number) {
		const ts = this.getUnixTS() - offset;
		const result: DataRecord<T>[] = [];

		for (const x of this.data) {
			if (x.timestamp >= ts) {
				result.push(x);
			}
		}

		return result;
	}

	/**
	 * Removes outdated data records from the history.
	 */
	async clean() {
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

	private getUnixTS() {
		return Math.floor(new Date().getTime() / 1000);
	}
}

/**
 * Represents a data record of the history with a timestamp.
 */
export type DataRecord<T> = {
	value: T;
	timestamp: number;
};
