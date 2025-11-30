/**
 * Get a random integer from a given interval.
 * @param {number} min The lower limit.
 * @param {number} max The upper limit.
 * @return {number} The random integer.
 */
export function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Get a random integer from a given interval.
 * @param {Array} data The array of numbers.
 * @return {number} The average number.
 */
export function average(data) {
    var sum = data.reduce(function(sum, value) {
        return sum + value;
    }, 0);

    var avg = sum / data.length;
    return avg;
}

/**
 * Get the standard deviation of the given numbers.
 * @param {Array} values The array of numbers.
 * @return {number} The standard deviation.
 */
export function standardDeviation(values) {
    var avg = average(values);

    var squareDiffs = values.map(function(value) {
        var diff = value - avg;
        var sqrDiff = diff * diff;
        return sqrDiff;
    });

    var avgSquareDiff = average(squareDiffs);

    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
}

/**
 * Shuffle the array.
 * @param {Array} array The array to be shuffled.
 * @return {number} The standard deviation.
 */
export function shuffle(array) {
    var counter = array.length;
    var temp;
    var index;

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}

Array.prototype.multiIndexOf = function(el) {
    var idxs = [];
    for (var i = this.length - 1; i >= 0; i--) {
        if (this[i] === el) {
            idxs.unshift(i);
        }
    }
    return idxs;
};

/**
 * Check current thread Is or Not in a worker environment.
 * @return {boolean} Is or Not in a worker environment.
 */
export function is_worker_env() {
    return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
}