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
	// With the initialization of the class an I2C connection is automatically established.
	// Now you can start the reading process for the class
	await myAnemometer.start();

	// Wait 15 seconds to have a usable average value
	setTimeout(() => {
		// '.getData()' calculates the average wind speed of the past x seconds
		const data = myAnemometer.getData(10);

		console.log(`Wind speed: ${data.rounded(2)} ${data.unit}`);

		// Herewith you can stop the permanent reading process and close the I2C connection.
		// After that, the class can no longer be used
		myAnemometer.close();
	}, 15000);
}

start();
