import Orbit from './main';
import Evented from './evented';
import ActionQueue from './action-queue';
import Transaction from './transaction';
import { isArray } from './lib/objects';
import { assert } from './lib/assert';

function transactionFor(operation) {
  if (!isArray(operation)) {
    var queue = this._transactionQueue.content;
    var transaction;

    // console.log('transactionFor', operation, queue.length);

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

      Evented.extend(object);

      object.didTransform = function(operation, inverse) {
        var transaction = transactionFor.call(this, operation);
        if (!transaction) {
          // console.log('didTransform - createTransaction', operation, inverse);
          transaction = createTransaction.call(this);
        // } else {
        //   console.log('didTransform - matching transaction found', operation, inverse);
        }

        transaction.pushCompletedOperation(operation, inverse);
      };

      object.transform = function(operation) {
        var transaction;

        if (!isArray(operation)) {
          transaction = transactionFor.call(this, operation);
        }

        if (!transaction) {
          // console.log('transform - createTransaction', operation);
          transaction = createTransaction.call(this, operation);
        // } else {
        //   console.log('transform - matching transaction found', operation);
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
