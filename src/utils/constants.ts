export const I2CADDR = 0x50;
export const I2CADDR_SECOND = 0x51;

// Register offsets
export const LOCATION_CONTROL = 0x00;
export const LOCATION_COUNTER = 0x01;

// Function modes
export enum PCF8583Mode {
	// CLOCK = 0x00 << 4,
	// ALARM = 0x01 << 4,
	COUNTER = 0x02 << 4
	// TEST = 0x03 << 4
}
