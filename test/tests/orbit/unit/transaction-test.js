import Orbit from 'orbit/main';
import Transaction from 'orbit/transaction';
import Operation from 'orbit/operation';
import { Promise, all } from 'rsvp';

///////////////////////////////////////////////////////////////////////////////

var target;

module("Orbit - Transaction", {
  setup: function() {
    Orbit.Promise = Promise;

    target = {
      _transform: function() {
      }
    };
  },

  teardown: function() {
    Orbit.Promise = null;
  }
});

test("it exists", function() {
  var transaction = new Transaction(target);
  ok(transaction);
});
