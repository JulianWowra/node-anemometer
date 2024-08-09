import { type I2CBus, open as openConnection, type OpenOptions } from 'i2c-bus';
import { LOCATION_CONTROL, LOCATION_COUNTER, MODE_TEST } from './constants';
import { bcdToByte, byteToBCD } from './utilities';

export class PCF8583 {
	private wire: I2CBus | null = null;

	/**
	 * Creates an instance of PCF8583.
	 *
	 * @param address The I2C address of the PCF8583 module.
	 * @param bus The I2C bus number.
	 */
	constructor(
		readonly address: number,
		readonly bus: number,
		readonly i2cOptions?: OpenOptions
	) {}

	/*
	 * ==========================================
	 *             Private functions
	 * ==========================================
	 */

	private async i2cWriteBytes(register: number, bytes: number[]) {
		const buff = Buffer.from(bytes);

		return new Promise<void>((resolve, reject) => {
			if (!this.wire) {
				throw new Error('Open a connection before you can access the bus!');
			}

			this.wire.writeI2cBlock(this.address, register, buff.length, buff, (err: Error) => {
				if (err) {
					return reject(err);
				}

				resolve();
			});
		});
	}

	private async i2cReadBytes(register: number, length: number) {
		const buff = Buffer.alloc(length);

		return await new Promise<Buffer>((resolve, reject) => {
			if (!this.wire) {
				throw new Error('Open a connection before you can access the bus!');
			}

			this.wire.readI2cBlock(this.address, register, buff.length, buff, (err: Error, _bytesRead, buffer) => {
				if (err) {
					return reject(err);
				}

				resolve(buffer);
			});
		});
	}

	private async i2cReadRegister(offset: number) {
		return (await this.i2cReadBytes(offset, 1))[0];
	}

	private async i2cWriteRegister(offset: number, value: number) {
		await this.i2cWriteBytes(offset, [value]);
	}

	private async start() {
		let control = await this.i2cReadRegister(LOCATION_CONTROL);
		control &= 0x7f;

		await this.i2cWriteRegister(LOCATION_CONTROL, control);
	}

	private async stop() {
		let control = await this.i2cReadRegister(LOCATION_CONTROL);
		control |= 0x80;

		await this.i2cWriteRegister(LOCATION_CONTROL, control);
	}

	/*
	 * ==========================================
	 *              Public functions
	 * ==========================================
	 */

	/**
	 * Opens the I2C connection to the PCF8583 module.
	 *
	 * @returns Resolves when the connection is successfully opened.
	 * @throws If the i2c connection is allready opened.
	 */
	async open() {
		this.wire = await new Promise<I2CBus>((resolve, reject) => {
			if (this.wire) {
				return reject(new Error('Connection already open.'));
			}

			resolve(
				openConnection(this.bus, this.i2cOptions ?? { forceAccess: false }, (err: Error) => {
					if (err) {
						reject(err);
					}
				})
			);
		});
	}

	/**
	 * Closes the I2C connection to the PCF8583 module and stops the clock.
	 *
	 * @returns  Resolves when the connection is successfully closed.
	 * @throws If the i2c connection is allready closed.
	 */
	async close() {
		if (this.wire) {
			await this.stop();
		}

		this.wire = await new Promise<null>((resolve, reject) => {
			if (!this.wire) {
				return reject(new Error('Connection already closed.'));
			}

			this.wire.close((err: Error) => {
				if (err) {
					reject(err);
				}
			});

			resolve(null);
		});
	}

	/**
	 * Sets the clock mode of the PCF8583 module.
	 *
	 * @param mode The mode to set.
	 * @returns Resolves when the mode is successfully set.
	 */
	async setMode(mode: number) {
		let control = await this.i2cReadRegister(LOCATION_CONTROL);
		control = (control & ~MODE_TEST) | (mode & MODE_TEST);

		await this.i2cWriteRegister(LOCATION_CONTROL, control);
	}

	/**
	 * Resets the PCF8583 module to its default values.
	 *
	 * @returns Resolves when the module is successfully reset.
	 */
	async reset() {
		await this.i2cWriteBytes(LOCATION_CONTROL, [
			0x04, // 00 control/status (alarm enabled by default)
			0x00, // 01 set hundreds-of-seconds
			0x00, // 02 set second
			0x00, // 03 set minute
			0x00, // 04 set hour (24h format)
			0x01, // 05 set day
			0x01, // 06 set month
			0x00, // 07 set timer
			0x00, // 08 set alarm control
			0x00, // 09 set alarm hundreds-of-seconds
			0x00, // 0A set alarm second
			0x00, // 0B set alarm minute
			0x00, // 0C set alarm hour
			0x01, // 0D set alarm day
			0x01, // 0E set alarm month
			0x00, // 0F set alarm timer
			0x00, // 10 set year offset to 0
			0x00 // 11 set last read value for year to 0
		]);
	}

	/**
	 * Sets the counter value of the PCF8583 module.
	 *
	 * @param value The value to set in the counter.
	 * @returns Resolves when the counter value is successfully set.
	 */
	async setCount(value: number) {
		await this.stop();

		await this.i2cWriteBytes(LOCATION_COUNTER, [
			byteToBCD(value % 100),
			byteToBCD((value / 100) % 100),
			byteToBCD((value / 10000) % 100)
		]);

		await this.start();
	}

	/**
	 * Retrieves the current counter value from the PCF8583 module.
	 *
	 * @returns Resolves with the current counter value.
	 */
	async getCount() {
		const read = await this.i2cReadBytes(LOCATION_COUNTER, 3);

		let count = bcdToByte(read[0]);
		count += bcdToByte(read[1]) * 100;
		count += bcdToByte(read[2]) * 10000;

		return count;
	}
}
