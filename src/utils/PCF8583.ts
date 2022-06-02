import { I2CBus, openSync } from 'i2c-bus';
import { promisify } from 'util';
import { LOCATION_CONTROL, LOCATION_COUNTER, MODE_TEST } from './constants';
import { bcdToByte, byteToBCD } from './utilities';

export class PCF8583 {
	private readonly wire: I2CBus;
	private readonly i2cScan: () => Promise<number[]>;

	constructor(private readonly address: number, private readonly bus: number) {
		this.wire = openSync(this.bus);

		this.i2cScan = promisify(this.wire.scan);
	}

	async scan(): Promise<unknown[]> {
		return this.i2cScan();
	}

	private async i2cRead(length: number): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			this.wire.i2cRead(this.address, length, Buffer.alloc(length), (err, bytesRead, buffer) => {
				if (err) {
					reject(err);
					return;
				}

				if (bytesRead !== length) {
					reject(new Error(`Expected to read ${length} bytes, but only read ${bytesRead} bytes`));
					return;
				}

				resolve(buffer);
			});
		});
	}

	private async i2cSendByte(byte: number): Promise<void> {
		if (byte < 0 || byte > 255) {
			throw new Error('Byte out of range!');
		}

		return new Promise((resolve, reject) => {
			this.wire.sendByte(this.address, byte, (err) => {
				if (err) {
					reject(err);
					return;
				}

				resolve();
			});
		});
	}

	private async i2cWriteBytes(cmd: number, bytes: number[]): Promise<void> {
		const buff = Buffer.from(bytes);

		return new Promise((resolve, reject) => {
			this.wire.writeI2cBlock(this.address, cmd, buff.length, buff, (err) => {
				if (err) {
					reject(err);
					return;
				}

				resolve();
			});
		});
	}

	private async getRegister(offset: number) {
		await this.i2cSendByte(offset);

		return (await this.i2cRead(1))[0];
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

		await this.i2cWriteBytes(LOCATION_COUNTER, [byteToBCD(value % 100), byteToBCD((value / 100) % 100), byteToBCD((value / 10000) % 100)]);

		await this.start();
	}

	async getCount() {
		await this.i2cSendByte(LOCATION_COUNTER);
		const read = await this.i2cRead(3);

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
