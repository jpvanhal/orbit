import Orbit from './main';
import { Class, isArray } from './lib/objects';
import ActionQueue from './action-queue';
import Evented from './evented';
import Operation from './operation';
import { assert } from './lib/assert';

export default Class.extend({
  target: null,

  queue: null,

  originalOperationIds: null,

  completedOperations: null,

  inverseOperations: null,

  init: function(target) {
    var _this = this;

    assert('_transform must be defined', target._transform);

    Evented.extend(this);

    this.target = target;
    this.queue = new ActionQueue({autoProcess: false});
    this.completedOperations = [];
    this.originalOperationIds = [];
    this.inverseOperations = [];
  },

  verifyOperation: function(operation) {
    var id;
    for (var i = 0; i < this.originalOperationIds.length; i++) {
      id = this.originalOperationIds[i];
      if (operation.id === id || operation.spawnedFrom(id)) {
        console.log('Transaction#verifyOperation - TRUE', this.target.id, operation);
        return true;
      }
    }
    console.log('Transaction#verifyOperation - FALSE', this.target.id, operation);
    return false;
  },

  push: function(operation) {
    var _this = this;

    if (isArray(operation)) {
      if (_this.originalOperationIds.length === 0) {
        operation.forEach(function(o) {
          _this.originalOperationIds.push(o.id);
        });
      }

      return operation.map(function(o) {
        return _this.push(o);
      });

    } else {
      assert('operation must be an `Operation`', operation instanceof Operation);

      console.log('Transaction#push - queued', _this.target.id, operation);

      if (_this.originalOperationIds.length === 0) {
        _this.originalOperationIds.push(operation.id);
      }

      if (_this.currentOperation && operation.spawnedFrom(_this.currentOperation)) {
        console.log('!!! transaction spawned from current op');

        return _this._transform(operation);

      } else {
        return this.queue.push({
          id: operation.id,
          data: operation,
          process: function() {
            _this.currentOperation = this.data;
            return _this._transform(this.data).then(function() {
              _this.currentOperation = null;
            });
          }
        });
      }
    }
  },

  didTransform: function(operation, inverse) {
    assert('completed operation must be an `Operation`', operation instanceof Operation);

    if (this.originalOperationIds.length === 0) {
      this.originalOperationIds.push(operation.id);
    }

    this.inverseOperations = this.inverseOperations.concat(inverse);
    this.completedOperations.push([operation, inverse]);
  },

  process: function() {
    var _this = this;
    var processing = this.processing;

    console.log('Transaction#process', _this.target.id, this.queue.content);

    if (!processing) {
      processing = this.processing = this.queue.process().then(function() {
        return _this._settle().then(function() {
          console.log('Transaction#process settled', _this.target.id);
          // _this.emit('didProcess');
          return _this.inverseOperations;
        // }, function() {
          // _this.emit('didNotProcess');
        });
      });
    }

    return processing;
  },

  _transform: function(operation) {
    console.log('transaction#_transform', this.target.id, operation);
    var res = this.target._transform(operation);
    if (res) {
      var _this = this;
      return res.then(function(inverse) {
        console.log('Transaction#_transform promise resolved - not yet settled', _this.target.id);
        return _this._settle();
      });

    } else {
      return this._settle();
    }
  },

  _settle: function() {
    var _this = this;

    var ops = this.completedOperations;

    console.log('transaction#_settle', this.target.id, ops);

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
          console.log('Transaction#_settle complete', _this.target.id);
          _this.settlingTransforms = false;
          resolve();

        } else {
          var op = ops.shift();

          console.log('settle#settleEach', _this.target.id, ops.length + 1, 'didTransform', op[0], op[1]);

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
