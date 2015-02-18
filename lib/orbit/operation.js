import { Class } from './lib/objects';
import { uuid } from './lib/uuid';

var Operation = Class.extend({
  op: null,
  path: null,
  value: null,
  log: null,

  init: function(options) {
    var path = options.path;
    if (typeof path === 'string') path = path.split('/');

    this.op = options.op;
    this.path = path;
    this.value = options.value;

    this.id = uuid();

    if (options.parent) {
      this.log = options.parent.log.concat(options.parent.id);
    } else {
      this.log = [];
    }

    // console.log('Operation.init', this.id, this.op, this.path.join('/'), this.value, this.log);
  },

  spawnedFrom: function(operation) {
    return this.log.indexOf(operation.id || operation) > -1;
  },

  spawn: function(options) {

  },

  serialize: function() {
    return {
      op: this.op,
      path: this.path.join('/'),
      value: this.value
    };
  }
});

export default Operation;
