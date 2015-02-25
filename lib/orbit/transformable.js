import Orbit from './main';
import Evented from './evented';
import ActionQueue from './action-queue';
import Transaction from './transaction';
import Operation from './operation';
import { isArray } from './lib/objects';
import { assert } from './lib/assert';

function normalizeOperation(operation) {
  if (operation instanceof Operation) {
    return operation;
  } else {
    return new Operation(operation);
  }
}

function transactionFor(operation) {
  if (!isArray(operation)) {
    var queue = this._transactionQueue.content;
    var transaction;

    console.log('transactionFor', operation, queue.length);

    for (var i = 0; i < queue.length; i++) {
      transaction = queue[i].data;
      if (transaction.verifyOperation(operation)) {
        return transaction;
      }
    }
  }
}

function createTransaction(operation) {
  var transaction = new Transaction(this, operation);

  this._transactionQueue.push({
    data: transaction,
    process: function() {
      return transaction.process();
    }
  });

  return transaction;
}

var Transformable = {
  extend: function(object, actions) {
    if (object._transformable === undefined) {
      object._transformable = true;
      object._transactionQueue = new ActionQueue();
//TODO-remove
      object._transactionQueue.id = 'transaction';

      Evented.extend(object);

      object.didTransform = function(operation, inverse) {
        var normalized = normalizeOperation(operation);
        var transaction = transactionFor.call(this, normalized);
        if (!transaction) {
          console.log('didTransform - createTransaction', this.id, normalized, inverse);
          transaction = createTransaction.call(this);
        } else {
          console.log('didTransform - matching transaction found', this.id, normalized, inverse);
        }

        transaction.pushCompletedOperation(normalized, inverse);
      };

      object.transform = function(operation) {
        var transaction;
        var normalized;

        if (isArray(operation)) {
          normalized = operation.map(function(o) {
            return normalizeOperation(o);
          });
        } else {
          normalized = normalizeOperation(operation);
          transaction = transactionFor.call(this, normalized);
        }

        if (!transaction) {
          console.log('transform - createTransaction', this.id, normalized);
          transaction = createTransaction.call(this, normalized);
        } else {
          console.log('transform - matching transaction found', this.id, normalized);
        }

        return transaction.process();
      };

      object.settleTransforms = function() {
        return this._transactionQueue.process();
      };
    }

    return object;
  }
};

export default Transformable;
