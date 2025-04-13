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
	 * Returns the current Unix timestamp in seconds.
	 *
	 * @returns The current Unix timestamp.
	 */
	private getUnixTS() {
		return Math.floor(new Date().getTime() / 1000);
	}

	/**
	 * Inserts a new data record into the history.
	 *
	 * @param value The value to be added to the history.
	 */
	push(value: T) {
		if (this.maxElements > 0 && this.data.length + 1 >= this.maxElements) {
			this.data.shift();
		}

		this.data.push({ value, timestamp: this.getUnixTS() });
	}

	/**
	 * Retrieves data records based on specified conditions.
	 *
	 * @param conditions The conditions to filter the data records.
	 * @returns An array of data records that match the conditions.
	 */
	get(conditions: GetDataConditions) {
		let result = this.data.slice(0);

		// Filter by startTime and endTime
		if ('startTime' in conditions || 'endTime' in conditions) {
			const startTime = conditions.startTime ? Math.floor(conditions.startTime.getTime() / 1000) : -Infinity;
			const endTime = conditions.endTime ? Math.floor(conditions.endTime.getTime() / 1000) : Infinity;

			result = result.filter((record) => record.timestamp >= startTime && record.timestamp <= endTime);
		}

		// Filter by offset (timestamp in seconds from current time)
		if ('recentSeconds' in conditions && conditions.recentSeconds !== undefined) {
			const recentTime = this.getUnixTS() - conditions.recentSeconds;
			result = result.filter((record) => record.timestamp >= recentTime);
		}

		// Sort by order
		if (conditions.order && conditions.order.toLowerCase() === 'asc') {
			result = result.sort((a, b) => a.timestamp - b.timestamp);
		}

		// Limit the number of results
		if (conditions.limit && conditions.limit > 0) {
			result = result.slice(0, conditions.limit);
		}

		return result;
	}

	/**
	 * Removes outdated data records from the history.
	 */
	clean() {
		const beginOfValidData = this.getUnixTS() - this.expirationTime + 1;

		if (this.maxElements > 0) {
			this.data = this.data.slice(-this.maxElements);
		}

		this.data = this.data.filter((record) => record.timestamp >= beginOfValidData);
	}
}

/**
 * Represents a data record of the history with a timestamp.
 */
export type DataRecord<T> = {
	value: T;
	timestamp: number;
};

/**
 * Specifies the time conditions to retrieve data records from the history.
 */
export type TimeCondition =
	| {
			/**
			 * The start time for filtering records. Records older than this time will be excluded.
			 */
			startTime?: Date;

			/**
			 * The end time for filtering records. Records newer than this time will be excluded.
			 */
			endTime?: Date;
	  }
	| {
			/**
			 * The number of seconds from the current time to filter records.
			 * Only records within this recent time span will be included.
			 */
			recentSeconds?: number;
	  };

/**
 * Specifies conditions to retrieve data records from the history.
 */
export type GetDataConditions = TimeCondition & {
	/**
	 * The maximum number of records to retrieve. If not specified, all matching records will be retrieved.
	 */
	limit?: number;

	/**
	 * The order in which to sort the records. 'ASC' or 'asc' for ascending order, 'DESC' or 'desc' for descending order.
	 */
	order?: 'ASC' | 'DESC' | 'asc' | 'desc';
};
