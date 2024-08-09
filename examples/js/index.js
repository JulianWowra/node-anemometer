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

	// Wait 60 seconds to have a usable average value
	setTimeout(async () => {
		// '.getAverageWindSpeed()' calculates the average wind speed of the past x seconds
		const average = myAnemometer.getAverageWindSpeed({ recentSeconds: 60 });
		console.log(`Average wind speed: ${average.rounded(2)} ${average.unit}`);

		// '.getPeakWindGust()' calculates the peak wind guest of the past x seconds
		const peak = myAnemometer.getPeakWindGust({ recentSeconds: 60 });
		console.log(`Peak wind speed: ${peak.rounded(2)} ${peak.unit}`);

		// Herewith you can stop the reading process and close the i2c connection
		await myAnemometer.close();
	}, 60000);
}

start();
