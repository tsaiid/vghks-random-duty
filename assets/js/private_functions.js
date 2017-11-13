/* exported randomIntFromInterval */
/* exported standardDeviation */
/* exported shuffle */
/* exported is_worker_env */

/**
 * Get a random integer from a given interval.
 * @param {number} min The lower limit.
 * @param {number} max The upper limit.
 * @return {number} The random integer.
 */
function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Get a random integer from a given interval.
 * @param {Array} data The array of numbers.
 * @return {number} The average number.
 */
function average(data) {
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
function standardDeviation(values) {
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
function shuffle(array) {
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
 function is_worker_env() {
    return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
}

// currently unused
/*
function entropy(arr) {
    var counts = {};
    for (var i = 0; i < arr.length; i++) {
        var num = arr[i];
        counts[num] = counts[num] ? counts[num] + 1 : 1;
    }
    //console.log(counts);
    var sum = 0;
    var total = arr.length;
    for (var k in counts) {
        var p = counts[k] / total;
        sum -= p * Math.log(p) / Math.log(2);
        //console.log(sum);
    }
    return sum;
};

// entropy.js MIT License © 2014 James Abney http://github.com/jabney
// Calculate the Shannon entropy of a string in bits per symbol.
(function(shannon) {
    'use strict';

    // Create a dictionary of character frequencies and iterate over it.
    function process(s, evaluator) {
        var h = Object.create(null),
            k;
        s.split('').forEach(function(c) {
            h[c] && h[c]++ || (h[c] = 1);
        });
        if (evaluator)
            for (k in h) evaluator(k, h[k]);
        return h;
    };

    // Measure the entropy of a string in bits per symbol.
    shannon.entropy = function(s) {
        var sum = 0,
            len = s.length;
        process(s, function(k, f) {
            var p = f / len;
            sum -= p * Math.log(p) / Math.log(2);
        });
        return sum;
    };

    // Measure the entropy of a string in total bits.
    shannon.bits = function(s) {
        return shannon.entropy(s) * s.length;
    };

    // Log the entropy of a string to the console.
    shannon.log = function(s) {
        console.log('Entropy of "' + s + '" in bits per symbol:', shannon.entropy(s));
    };
})(window.shannon = window.shannon || Object.create(null));
*/
