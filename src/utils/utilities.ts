
export enum WindSpeedUnits {
	kilometersPerHour = 'km/h',
	metersPerSecond = 'm/s',
	knots = 'kn'
}

export class WindSpeed {
	constructor(readonly value: number, readonly unit: WindSpeedUnits) {}

	rounded(decimalPlaces = 1) {
		return round(this.value, decimalPlaces);
	}

	toKilometersPerHour() {
		switch (this.unit) {
			case WindSpeedUnits.metersPerSecond: {
				return new WindSpeed(this.value * 3.6, WindSpeedUnits.kilometersPerHour);
			}
			case WindSpeedUnits.knots: {
				return new WindSpeed(this.value * 1.852, WindSpeedUnits.kilometersPerHour);
			}
			default:
				return this;
		}
	}

	toMetersPerSecond() {
		switch (this.unit) {
			case WindSpeedUnits.kilometersPerHour: {
				return new WindSpeed(this.value / 3.6, WindSpeedUnits.metersPerSecond);
			}
			case WindSpeedUnits.knots: {
				return new WindSpeed(this.value / 1.944, WindSpeedUnits.metersPerSecond);
			}
			default:
				return this;
		}
	}

	toKnots() {
		switch (this.unit) {
			case WindSpeedUnits.kilometersPerHour: {
				return new WindSpeed(this.value / 1.852, WindSpeedUnits.knots);
			}
			case WindSpeedUnits.metersPerSecond: {
				return new WindSpeed(this.value * 1.944, WindSpeedUnits.knots);
			}
			default:
				return this;
		}
	}
}

export function round(value: number, decimalPlaces: number) {
	if (value % 1 !== 0) {
		const i = Math.pow(10, decimalPlaces);
		return Math.round((value + Number.EPSILON) * i) / i;
	}

	return value;
}

export function calcFactor(radius: number, adjustment: number) {
	return ((2 * Math.PI * radius) / 100000) * 3600 * adjustment;
}

export function bcdToByte(value: number) {
	if (value >> 4 > 9 || (value & 0x0F) > 9) {
		throw new Error(`Invalid value for byte convertion: ${value.toString(16)}`);
	}

	return (value >> 4) * 10 + (value & 0x0f);
}

export function byteToBCD(value: number) {
	if(value >= 100) {
		throw new Error(`Invalid value for bcd convertion:  ${value}`);
	}

	return ((value / 10) << 4) + (value % 10);
}
