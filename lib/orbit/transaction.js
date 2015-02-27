import Orbit from './main';
import { Class, isArray } from './lib/objects';
import ActionQueue from './action-queue';
import Operation from './operation';
import { assert } from './lib/assert';

export default Class.extend({
  target: null,

  queue: null,

  originalOperationIds: null,

  completedOperations: null,

  inverseOperations: null,

  init: function(target, operations) {
    var _this = this;

    assert('_transform must be defined', target._transform);

    this.target = target;
    this.queue = new ActionQueue({autoProcess: false});
    this.completedOperations = [];
    this.originalOperationIds = [];
    this.inverseOperations = [];

    if (isArray(operations)) {
      operations.forEach(function(operation) {
        _this.pushOperation(operation);
        _this.originalOperationIds.push(operation.id);
      });

    } else if (operations) {
      var operation = operations;
      _this.pushOperation(operation);
      _this.originalOperationIds.push(operation.id);
    }
  },

  verifyOperation: function(operation) {
    var id;
    for (var i = 0; i < this.originalOperationIds.length; i++) {
      id = this.originalOperationIds[i];
      if (operation.id === id || operation.spawnedFrom(id)) {
        // console.log('Transaction#verifyOperation - TRUE', operation);
        return true;
      }
    }
    // console.log('Transaction#verifyOperation - FALSE', operation);
    return false;
  },

  pushOperation: function(operation) {
    assert('operation must be an `Operation`', operation instanceof Operation);

    var _this = this;

    this.queue.push({
      id: operation.id,
      data: operation,
      process: function() {
        return _this._transform(this.data);
      }
    });

    // console.log('Transaction#pushOperation', operation);
  },

  pushCompletedOperation: function(operation, inverse) {
    assert('completed operation must be an `Operation`', operation instanceof Operation);

    this.inverseOperations = this.inverseOperations.concat(inverse);
    this.completedOperations.push([operation, inverse]);
  },

  process: function() {
    var _this = this;
    var processing = this.processing;

    if (!processing) {
      processing = this.processing = this.queue.process().then(function() {
        return _this._settle().then(function() {
          return _this.inverseOperations;
        });
      });
    }

    return processing;
  },

  _transform: function(operation) {
    // console.log('transaction#_transform', operation);
    var res = this.target._transform(operation);

    if (res) {
      var _this = this;
      return res.then(function(inverse) {
        // console.log('Transaction#_transform promise resolved - not settled');
        return _this._settle();
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
          // console.log('Transaction#_settle complete');
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
