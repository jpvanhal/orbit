import Orbit from './main';
import Evented from './evented';
import ActionQueue from './action-queue';
import Transaction from './transaction';
import { isArray } from './lib/objects';
import { assert } from './lib/assert';

function transformOne(operation) {
  var ret = this.getTransaction(operation).pushOperation(operation);
  return ret.then(function(inverse) {
    return inverse;
  });
}

function transformMany(operations) {
  var _this = this,
      inverses = [],
      ret;

  operations.forEach(function(operation) {
    ret = transformOne.call(_this, operation).then(
      function(inverse) {
        inverses = inverses.concat(inverse);
      }
    );
  });

  // Allow `transform([])` to succeed
  if (!ret) {
    ret = new Orbit.Promise(function(resolve) { resolve(); });
  }

  return ret.then(function() {
    return inverses;
  });
}

var Transformable = {
  extend: function(object, actions) {
    if (object._transformable === undefined) {
      object._transformable = true;
      object.transformQueue = new ActionQueue();

      Evented.extend(object);

      object.getTransaction = function(operation) {
        var queue = object.transformQueue.queue;
        var transaction;

        for (var i = 0; i < queue.length; i++) {
          transaction = queue[i].data;
          if (transaction.verifyOperation(operation)) {
            return transaction;
          }
        }

        transaction = new Transaction(object);
        this.transformQueue.push({
          data: transaction,
          process: function() {
            console.log('process transaction', this.data);
            return this.data;
          }
        });
        return transaction;
      };

      object.didTransform = function(operation, inverse) {
        this.getTransaction(operation).pushCompletedOperation(operation, inverse);
      };

      object.transform = function(operation) {
        if (isArray(operation)) {
          return transformMany.call(this, operation);
        } else {
          return transformOne.call(this, operation);
        }
      };
    }

    return object;
  }
};

export default Transformable;
