import { Class, clone } from './lib/objects';
import { uuid } from './lib/uuid';

function includeValue(operation) {
  return operation.op !== 'remove';
}

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
    if (includeValue(this)) {
      this.value = options.value;
    }

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

  spawn: function(data) {
    return new Operation({
      op: data.op,
      path: data.path,
      value: data.value,
      parent: this
    });
  },

  serialize: function() {
    var serialized = {
      op: this.op,
      path: this.path.join('/')
    };

    if (includeValue(this)) {
      serialized.value = this.value;
    }

    return serialized;
  }
});

export default Operation;
