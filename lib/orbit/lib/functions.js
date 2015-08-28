/**
 Wraps a function that expects parameters with another that can accept the parameters as an array

 @method spread
 @for Orbit
 @param {Object} func
 @returns {function}
 */
var spread = function(func) {
  return function(args) {
    func.apply(null, args);
  };
};

var now = Date.now || function() {
  return new Date().getTime();
};

var debounce = function(func, wait, immediate) {
  var timeout, args, context, timestamp, result;

  var later = function() {
    var last = now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      }
    }
  };

  return function() {
    context = this;
    args = arguments;
    timestamp = now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };
};

export { spread, now, debounce };
