const { Anemometer, WindSpeed, WindSpeedUnits, calcFactor } = require('../../dist');

const calc = (pulses, time) => {
	// You cannot divide by 0
	if (time <= 0) {
		return new WindSpeed(0, WindSpeedUnits.kilometersPerHour);
	}

	// More about the calculation can you find in the readme file
	const windSpeed = (pulses / 2 / time) * calcFactor(9, 1.18);

	// You must always return a class of the type WindSpeed
	return new WindSpeed(windSpeed, WindSpeedUnits.kilometersPerHour);
};

// Initialize the class for your anemometer.
// Never initialize two classes for the same address on the same bus!
// For more options on initializing the class, read the documentation
const myAnemometer = new Anemometer(calc);

async function start() {
	// Establish an i2c connection to the PCF8583 and start the reading process
	await myAnemometer.open();

	// Wait 15 seconds to have a usable average value
	setTimeout(() => {
		// '.getData()' calculates the average wind speed of the past x seconds
		const data = myAnemometer.getData(10);

		console.log(`Wind speed: ${data.rounded(2)} ${data.unit}`);

		// Herewith you can stop the reading process and close the i2c connection
		myAnemometer.close();
	}, 15000);
}

start();
