import { I2CBus, openSync } from 'i2c-bus';
import { LOCATION_CONTROL, LOCATION_COUNTER, MODE_TEST } from './constants';
import { bcdToByte, byteToBCD } from './utilities';

export class PCF8583 {
	private readonly wire: I2CBus;

	constructor(
		readonly address: number,
		readonly bus: number
	) {
		this.wire = openSync(this.bus);
	}

	private async i2cWriteBytes(cmd: number, bytes: number[]) {
		const buff = Buffer.from(bytes);

		return new Promise<void>((resolve, reject) => {
			this.wire.writeI2cBlock(this.address, cmd, buff.length, buff, (err) => {
				if (err) {
					reject(err);
					return;
				}

				resolve();
			});
		});
	}

	private async i2cReadBytes(cmd: number, length: number) {
		const buff = Buffer.alloc(length);

		return await new Promise<Buffer>((resolve, reject) => {
			this.wire.readI2cBlock(this.address, cmd, buff.length, buff, (err, _bytesRead, buffer) => {
				if (err) {
					reject(err);
					return;
				}

				resolve(buffer);
			});
		});
	}

	private async getRegister(offset: number) {
		return (await this.i2cReadBytes(offset, 1))[0];
	}

	private async setRegister(offset: number, value: number) {
		await this.i2cWriteBytes(offset, [value]);
	}

	private async start() {
		let control = await this.getRegister(LOCATION_CONTROL);
		control &= 0x7f;

		await this.setRegister(LOCATION_CONTROL, control);
	}

	private async stop() {
		let control = await this.getRegister(LOCATION_CONTROL);
		control |= 0x80;

		await this.setRegister(LOCATION_CONTROL, control);
	}

	async setMode(mode: number) {
		let control = await this.getRegister(LOCATION_CONTROL);
		control = (control & ~MODE_TEST) | (mode & MODE_TEST);

		await this.setRegister(LOCATION_CONTROL, control);
	}

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

	async setCount(value: number) {
		await this.stop();

		await this.i2cWriteBytes(LOCATION_COUNTER, [
			byteToBCD(value % 100),
			byteToBCD((value / 100) % 100),
			byteToBCD((value / 10000) % 100)
		]);

		await this.start();
	}

	async getCount() {
		const read = await this.i2cReadBytes(LOCATION_COUNTER, 3);

		let count = bcdToByte(read[0]);
		count += bcdToByte(read[1]) * 100;
		count += bcdToByte(read[2]) * 10000;

		return count;
	}

	async cleanUp() {
		await this.stop();
		this.wire.closeSync();
	}
}
