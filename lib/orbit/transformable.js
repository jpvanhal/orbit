import Orbit from './main';
import Evented from './evented';
import ActionQueue from './action-queue';
import Transaction from './transaction';
import Operation from './operation';
import { isArray } from './lib/objects';
import { assert } from './lib/assert';

function normalize(operation) {
  if (isArray(operation)) {
    return operation.map(function(o) {
      return normalize(o);
    });

  } else {
    if (operation instanceof Operation) {
      return operation;
    } else {
      return new Operation(operation);
    }
  }
}

function transactionFor(operation) {
  var transaction;
  var i;

  if (isArray(operation)) {
    for (i = 0; i < operation.length; i++) {
      var t = transactionFor.call(this, operation[i]);
      if (transaction) {
        if (t !== transaction) return;
      } else {
        transaction = t;
      }
    }
    return transaction;

  } else {
    var queue = this._transactionQueue.content;

    // console.log('transactionFor', operation, queue.length);

    for (i = 0; i < queue.length; i++) {
      transaction = queue[i].data;
      if (transaction.verifyOperation(operation)) {
        return transaction;
      }
    }
  }
}

function queueTransaction(transaction) {
  var _this = this;

  var processor = this._transactionQueue.push({
    data: transaction,
    process: function() {
      return transaction.process().then(function() {
        console.log('transaction complete1');
      });
    }
  });

  processor.on('didProcess', function() {
    console.log('transaction complete2');
  });

  return processor;
}

var Transformable = {
  extend: function(object, actions) {
    if (object._transformable === undefined) {
      object._transformable = true;
      object._transactionQueue = new ActionQueue();

      Evented.extend(object);

      object.didTransform = function(operation, inverse) {
        var normalized = normalize(operation);
        var transaction = transactionFor.call(this, normalized);
        if (!transaction) {
          console.log('didTransform - createTransaction', this.id, normalized, inverse);
          transaction = new Transaction(this);
          queueTransaction.call(this, transaction);

        } else {
          console.log('didTransform - matching transaction found', this.id, normalized, inverse);
        }
        transaction.didTransform(normalized, inverse);
      };

      object.transaction = function(operation) {
        var normalized = normalize(operation);

        console.log('Transformable#transaction', this.id, normalized);

        var transaction = new Transaction(this);
        transaction.push(normalized);

        var transactionProcessor = queueTransaction.call(this, transaction);

        return transactionProcessor.complete;
      };

      object.transform = function(operation) {
        var normalized = normalize(operation);
        var transaction = transactionFor.call(this, normalized);
        var action;

        if (!transaction) {
          console.log('transform - createTransaction', this.id, normalized);
          transaction = new Transaction(this);
          action = transaction.push(normalized);
          queueTransaction.call(this, transaction);

        } else {
          console.log('transform - matching transaction found', this.id, normalized);
          action = transaction.push(normalized);
        }

        if (isArray(action)) {
          return action[action.length - 1].complete;
        } else {
          return action.complete;
        }
      };

      object.settleTransforms = function() {
        return this._transactionQueue.process();
      };
    }

    return object;
  }
};

export default Transformable;
