import Orbit from './main';
import { Class, isArray } from './lib/objects';
import ActionQueue from './action-queue';
import Operation from './operation';
import { assert } from './lib/assert';

var normalizeOperation = function(operation) {
  if (!(operation instanceof Operation)) {
    return new Operation(operation);
  }
  return operation;
};

export default Class.extend({
  target: null,

  queue: null,

  originalOperationIds: null,

  completedOperations: null,

  init: function(target, operations) {
    var _this = this;

    assert('_transform must be defined', target._transform);

    this.target = target;
    this.queue = new ActionQueue();
    this.completedOperations = [];
    this.originalOperationIds = [];

    if (isArray(operations)) {
      operations.forEach(function(operation) {
        _this.originalOperationIds.push(_this.pushOperation(operation).id);
      });

    } else if (operations) {
      this.originalOperationIds.push(this.pushOperation(operations).id);
    }
  },

  // TODO - use `spawnedFrom`
  verifyOperation: function(operation) {
    return true;
  },

  pushOperation: function(operation) {
    var _this = this;

    var o = normalizeOperation(operation);

    this.queue.push({
      id: o.id,
      data: o,
      process: function() {
        return _this._transform(this.data);
      }
    });

    // console.log('Transaction#pushOperation', o);

    return o;
  },

  pushCompletedOperation: function(operation, inverse) {
    this.completedOperations.push([normalizeOperation(operation), inverse]);

    // settle operations immediately
    if (!this.queue.processing) {
      this._settle();
    }
  },

  process: function() {
    var _this = this;

    return this.queue.process().then(function() {
      _this._settle();
    });
  },

  _transform: function(operation) {
    // console.log('transaction#_transform', operation);

    var res = this.target._transform(operation);

    if (res) {
      var _this = this;
      return res.then(function(inverse) {
        return _this._settle().then(function () {
          return inverse;
        });
      });

    } else {
      return this._settle();
    }
  },

  _settle: function() {
    var _this = this;

    var ops = this.completedOperations;

    // console.log('transaction#_settle', ops);

    if (!ops || !ops.length) {
      return new Orbit.Promise(function(resolve) {
        resolve();
      });
    }

    if (this.settlingTransforms) {
      return this.settlingTransforms;
    }

    return this.settlingTransforms = new Orbit.Promise(function(resolve) {
      var settleEach = function() {
        if (ops.length === 0) {
          _this.settlingTransforms = false;
          resolve();

        } else {
          var op = ops.shift();

          // console.log('settle#settleEach', _this.id, ops.length + 1, 'didTransform', op[0], op[1]);

          var response = _this.target.settle.call(_this.target, 'didTransform', op[0], op[1]);
          if (response) {
            return response.then(settleEach, settleEach);
          } else {
            settleEach();
          }
        }
      };

      settleEach();
    });
  }
});
