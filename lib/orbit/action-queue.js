import Orbit from './main';
import Action from './action';
import Evented from './evented';
import { assert } from './lib/assert';
import { Class } from './lib/objects';

/**
 `ActionQueue` is a FIFO queue of actions that should be performed sequentially.

 All actions are calls to the same function and context. However, arguments for
 each call can vary in both value and length.

 If action calls return a promise, then that promise will be settled before the
 next action is de-queued and called. If action calls don't return anything,
 then the next action will be de-queued and called immediately.

 @example

 ``` javascript
 var transform = function(operation) {
   // perform operation here
 };

 var queue = new ActionQueue(transform);

 // push operations into queue synchronously so that they'll be performed
 // sequentially
 queue.push({op: 'add', path: ['planets', '123'], value: 'Mercury'});
 queue.push({op: 'add', path: ['planets', '234'], value: 'Venus'});
 ```

 @class ActionQueue
 @namespace Orbit
 @param {Object}   [options]
 @param {Boolean}  [options.autoProcess=true] Are actions automatically
                   processed as soon as they are pushed?
 @constructor
 */
 export default Class.extend({
  processing: false,

  current: null,

  init: function(options) {
    assert('ActionQueue requires Orbit.Promise to be defined', Orbit.Promise);

    Evented.extend(this);

    options = options || {};
    this.autoProcess = options.autoProcess !== undefined ? options.autoProcess : true;

    this.queue = [];
  },

  push: function(action) {
    var actionObject;

    if (action instanceof Action) {
      actionObject = action;
    } else {
      actionObject = new Action(action);
    }

    this.queue.push(actionObject);

    if (this.autoProcess) this.process();

    return actionObject;
  },

  process: function() {
    if (!this.processing) {
      var _this = this;

      var settleEach = function() {
        if (_this.queue.length === 0) {
          _this.current = null;
          _this.processing = false;
          _this.emit('queueComplete');

        } else {
          var action = _this.current = _this.queue[0];

          _this.processing = true;

          var settleNext = function() {
            _this.queue.shift();

            _this.emit('actionComplete', action);

            settleEach();
          };

          action.process().then(settleNext, settleNext);
        }
      };

      settleEach();
    }

    return this;
  },

  then: function(success, failure) {
    var _this = this;

    return new Orbit.Promise(function(resolve) {
      if (_this.processing) {
        _this.one('queueComplete', function () {
          resolve();
        });
      } else {
        resolve();
      }
    }).then(success, failure);
  }
});
