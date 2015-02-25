import Orbit from './main';
import Evented from './evented';
import { Class } from './lib/objects';

export default Class.extend({
  id: null,
  data: null,
  _process: null,
  processing: null,
  processed: false,

  init: function(options) {
    Evented.extend(this);

    this.id = options.id;
    this.data = options.data;
    this._process = options.process;
  },

  process: function() {
    var _this = this;
    var processing = this.processing;

    if (!processing) {
      var ret = this._process.call(this);

      var didComplete = function() {
        _this.processed = true;
        _this.emit('actionComplete');
      };

      processing = this.processing = new Orbit.Promise(function(resolve) {
        _this.one('actionComplete', function () {
          resolve();
        });
      });

      if (ret) {
        ret.then(didComplete, didComplete);
      } else {
        didComplete();
      }
    }

    return processing;
  }
});
