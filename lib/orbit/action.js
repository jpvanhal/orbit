import Orbit from './main';
import Evented from './evented';
import { Class } from './lib/objects';

export default Class.extend({
  id: null,
  data: null,
  _process: null,
  processing: false,
  processed: false,

  init: function(options) {
    Evented.extend(this);

    this.id = options.id;
    this.data = options.data;
    this._process = options.process;
  },

  process: function() {
    var _this = this;

    this.processing = true;

    var ret = this._process.call(this);

    var didComplete = function() {
      _this.processing = false;
      _this.processed = true;
      _this.emit('actionComplete');
    };

    if (ret) {
      ret.then(didComplete, didComplete);
    } else {
      didComplete();
    }

    return this;
  },

  then: function(success, failure) {
    var _this = this;

    return new Orbit.Promise(function(resolve) {
      if (_this.processed) {
        resolve();
      } else {
        _this.one('actionComplete', function () {
          resolve();
        });
      }
    }).then(success, failure);
  }
});
