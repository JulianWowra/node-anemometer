import { Anemometer, calcFactor, WindSpeed, WindSpeedUnits } from '../../dist';

const calc = (pulses: number, time: number): WindSpeed => {
	// You cannot divide by 0
	if (time <= 0) {
		return new WindSpeed(0, WindSpeedUnits.kilometersPerHour);
	}

	// More about the calculation can you find in the readme file
	const windSpeed = (pulses / 2 / time) * calcFactor(9, 1.18);

	// You must always return a class of the type WindSpeed
	return new WindSpeed(windSpeed, WindSpeedUnits.kilometersPerHour);
};

// With the initialization of the class it starts to measure the wind speed and stores it in a cache
// Create a maximum of only one instance per anemometer!
const myAnemometer = new Anemometer(calc);

// Wait 15 seconds to have a usable average value
setTimeout(() => {
	// '.getData()' calculates the average wind speed of the past x seconds
	const data = myAnemometer.getData(10);

	console.log(`Wind speed: ${data.rounded(2)} ${data.unit}`);

	// Herewith you can stop the permanent reading process
	// After that, the class can no longer be used
	myAnemometer.cleanUp();
}, 15000);
