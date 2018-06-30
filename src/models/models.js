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
  subfolders: [{ type: ObjectId, ref: 'Folder' }],
  tasks: [{ type: ObjectId, ref: 'Task' }],
  shareWith: [{
    kind: String,
    item: { type: ObjectId, refPath: 'shareWith.kind' }
  }]
})
module.exports.Folder = Folder

module.exports.Project = Folder.discriminator('Project', new Schema({
  owners: [{ type: ObjectId, ref: 'User' }],
  startDate: Date,
  finishDate: Date,
  status: String
}, {timestamps: true}))

module.exports.Task = buildModel('Task', {
  subTasks: [{ type: ObjectId, ref: 'Task' }],
  assignees: [{ type: ObjectId, ref: 'User' }],
  shareWith: [{
    kind: String,
    item: { type: ObjectId, refPath: 'shareWith.kind' }
  }],
  name: String,
  startDate: Date,
  finishDate: Date,
  importance: String,
  status: String,
})

module.exports.Team = buildModel('Team', {
  name: String,
})

module.exports.Group = buildModel('Group', {
  name: String,
  initials: String,
  avatarColor: String,
  users: [{ type: ObjectId, ref: 'User' }],
  // sharedFolders: [{ type: ObjectId, ref: 'Folder' }],
  // sharedTasks: [{ type: ObjectId, ref: 'Task' }],
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
  // sharedFolders: [{ type: ObjectId, ref: 'Folder' }],
  // sharedTasks: [{ type: ObjectId, ref: 'Task' }],
  team: { type: ObjectId, ref: 'Team' },
  role: String,
  status: String
})