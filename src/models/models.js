const mongoose = require("mongoose")
const timeZone = require('mongoose-timezone')
const moment = require('moment')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId

function buildModel(name, schema, options={}) {
  return mongoose.model(name, new Schema(schema, Object.assign({timestamps: true}, options)))
}

const Folder = buildModel('Folder', {
  name: String,
  description: String,
  shareWith: [{
    kind: String,
    item: { type: ObjectId, refPath: 'shareWith.kind' }
  }],
  subfolders: [{ type: ObjectId, ref: 'Folder' }],
  // tasks: [{ type: ObjectId, ref: 'Task' }]
})
module.exports.Folder = Folder

module.exports.Project = Folder.discriminator('Project', new Schema({
  owners: [{ type: ObjectId, ref: 'User' }],
  startDate: Date,
  finishDate: Date,
  status: String
}, {timestamps: true}))

module.exports.Task = buildModel('Task', {
  folder: String,
  subtasks: [{ type: ObjectId, ref: 'Task' }],
  assignees: [{ type: ObjectId, ref: 'User' }],
  shareWith: [{
    kind: String,
    item: { type: ObjectId, refPath: 'shareWith.kind' }
  }],
  name: String,
  description: {
    type: String,
    default: ''
  },
  creator: { type: ObjectId, ref: 'User' },
  startDate: {
    type: Date,
  },
  finishDate: {
    type: Date,
  },
  importance: {
    type: String,
    default: 'Normal'
  },
  status: {
    type: String,
    default: 'New'
  },
})

module.exports.Comment = buildModel('Comment', {
  body: String,
  parent: {
    kind: String,
    item: { type: ObjectId, refPath: 'parent.kind' }
  },
  task: { type: ObjectId, ref: 'Task' },
  user: { type: ObjectId, ref: 'User' }
})

module.exports.Team = buildModel('Team', {
  name: String,
})

module.exports.Group = buildModel('Group', {
  name: String,
  initials: String,
  avatarColor: String,
  users: [{ type: ObjectId, ref: 'User' }],
})

module.exports.Record = buildModel('Record', {
  user: { type: ObjectId, ref: 'User' },
  task: { type: ObjectId, ref: 'Task' },
  date: Date,
  timeSpent: Number
})

module.exports.User = buildModel('User', {
  name: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
  },
  avatarColor: String,
  initials: String,
  team: { type: ObjectId, ref: 'Team' },
  role: String,
  status: String
})