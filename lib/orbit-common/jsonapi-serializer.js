import Serializer from './serializer';
import { clone, isArray, isObject } from 'orbit/lib/objects';

var JSONAPISerializer = Serializer.extend({
  resourceKey: function(type) {
    return 'id';
  },

  resourceType: function(type) {
    return this.schema.pluralize(type);
  },

  resourceLink: function(type, link) {
    return link;
  },

  resourceAttr: function(type, attr) {
    return attr;
  },

  typeFromResourceType: function(resourceType) {
    return this.schema.singularize(resourceType);
  },

  resourceId: function(type, id) {
    if (isArray(id)) {
      var ids = [];
      for (var i = 0, l = id.length; i < l; i++) {
        ids.push(this.resourceId(type, id[i]));
      }

      return ids;
    }

    var primaryKey = this.schema.models[type].primaryKey.name;
    var resourceKey = this.resourceKey(type);

    if (isObject(id)) {
      if (id[resourceKey]) {
        return id[resourceKey];
      }
      id = id[primaryKey];
    }

    if (resourceKey === primaryKey) {
      return id;
    } else {
      return this.schema.primaryToSecondaryKey(type, resourceKey, id);
    }
  },

  idFromResourceId: function(type, resourceId) {
    var primaryKey = this.schema.models[type].primaryKey;
    var pk = primaryKey.name;
    var rk = this.resourceKey(type);

    if (resourceId !== null && typeof resourceId === 'object') {
      if (resourceId[pk]) {
        return resourceId[pk];
      }
      resourceId = resourceId[rk];
    }

    var id;

    if (rk === pk) {
      id = resourceId;
    } else {
      id = this.schema.secondaryToPrimaryKey(type, rk, resourceId, true);
    }

    return id;
  },

  serialize: function(type, records) {
    var json = {},
        resourceType = this.resourceType(type);

    if (isArray(records)) {
      json[resourceType] = this.serializeRecords(type, records);
    } else {
      json[resourceType] = this.serializeRecord(type, records);
    }

    return json;
  },

  serializeRecords: function(type, records) {
    var json = [];

    records.forEach(function(record) {
      json.push(this.serializeRecord(type, record));
    }, this);

    return json;
  },

  serializeRecord: function(type, record) {
    var json = {};

    this.serializeKeys(type, record, json);
    this.serializeAttributes(type, record, json);
    this.serializeLinks(type, record, json);

    return json;
  },

  serializeKeys: function(type, record, json) {
    var modelSchema = this.schema.models[type];
    var resourceKey = this.resourceKey(type);
    var value = record[resourceKey];

    if (value) {
      json[resourceKey] = value;
    }
  },

  serializeAttributes: function(type, record, json) {
    var modelSchema = this.schema.models[type];

    Object.keys(modelSchema.attributes).forEach(function(attr) {
      this.serializeAttribute(type, record, attr, json);
    }, this);
  },

  serializeAttribute: function(type, record, attr, json) {
    json[this.resourceAttr(type, attr)] = record[attr];
  },

  serializeLinks: function(type, record, json) {
    var modelSchema = this.schema.models[type];
    var linkNames = Object.keys(modelSchema.links);

    if (linkNames.length > 0) {
      json.links = {};

      linkNames.forEach(function (link) {
        var linkDef = modelSchema.links[link];
        var value = record.__rel[link];

        if (linkDef.type === 'hasMany') {
          value = Object.keys(value);
        }

        json.links[link] = value;

      }, this);
    }
  },

  deserialize: function(type, id, data) {
    var records = {};
    var schema = this.schema;
    var resourceType = this.resourceType(type);
    var primaryData = data[resourceType];

    if (isArray(primaryData)) {
      records[type] = this.deserializeRecords(type, id, primaryData);
    } else {
      records[type] = this.deserializeRecord(type, id, primaryData);
    }

    var linkedData = data.linked;

    if (linkedData) {
      var relType;
      var relKey;
      var relData;

      records.linked = {};

      Object.keys(linkedData).forEach(function(linkedResourceType) {
        relType = this.typeFromResourceType(linkedResourceType);
        relData = linkedData[linkedResourceType];
        records.linked[relType] = this.deserializeRecords(relType, null, relData);
      }, this);
    }

    this.assignLinks(type, records);

    return records;
  },

  deserializeLink: function(type, data) {
    var resourceType = this.resourceType(type);
    return data[resourceType];
  },

  deserializeRecords: function(type, ids, data) {
    var records = [];

    data.forEach(function(recordData, i) {
      var id = ids && ids[i] ? ids[i] : null;

      records.push(this.deserializeRecord(type, id, recordData));
    }, this);

    return records;
  },

  deserializeRecord: function(type, id, data) {
    if (id) {
      data[this.schema.models[type].primaryKey.name] = id;
    }
    return this.schema.normalize(type, data);
  },

  assignLinks: function(type, data) {
    var primaryData = data[type];
    var linkedData = data.linked;

    if (isArray(primaryData)) {
      this.assignLinksToRecords(type, primaryData);
    } else {
      this.assignLinksToRecord(type, primaryData);
    }

    if (linkedData) {
      Object.keys(linkedData).forEach(function(linkedType) {
        this.assignLinksToRecords(linkedType, linkedData[linkedType]);
      }, this);
    }
  },

  assignLinksToRecords: function(model, records) {
    records.forEach(function(record) {
      this.assignLinksToRecord(model, record);
    }, this);
  },

  assignLinksToRecord: function(model, record) {
    if (record.links) {
      record.__meta.links = record.__meta.links || {};

      var meta = record.__meta.links;
      var schema = this.schema;
      var linkSchema;
      var linkValue;
      var id;

      Object.keys(record.links).forEach(function(link) {
        linkValue = record.links[link];
        linkSchema = schema.models[model].links[link];

        if (!linkSchema) return;

        if (linkSchema.type === 'hasMany' && isArray(linkValue)) {
          record.__rel[link] = record.__rel[link] || [];

          var rels = record.__rel[link];
          linkValue.forEach(function(resourceId) {
            id = this.idFromResourceId(linkSchema.model, resourceId);
            record.__rel[link][id] = true;
          }, this);

        } else if (linkSchema.type === 'hasOne' && (typeof linkValue === 'string' || typeof linkValue === 'number')) {
          id = this.idFromResourceId(linkSchema.model, linkValue);
          record.__rel[link] = id;

        } else {
          meta[link] = linkValue;
        }

      }, this);

      delete record.links;
    }
  }
});

export default JSONAPISerializer;
