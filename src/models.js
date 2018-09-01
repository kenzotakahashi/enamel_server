const mongoose = require("mongoose")
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
  parent: { type: ObjectId, ref: 'Folder' },
  order: {
    type: Number
  },
  slack: String
})
module.exports.Folder = Folder

module.exports.Project = Folder.discriminator('Project', new Schema({
  owners: [{ type: ObjectId, ref: 'User' }],
  startDate: Date,
  finishDate: Date,
  status: String
}, {timestamps: true}))

module.exports.Team = Folder.discriminator('Team', new Schema({
}, {timestamps: true}))

module.exports.Task = buildModel('Task', {
  folders: [{ type: ObjectId, ref: 'Folder' }],
  parent: { type: ObjectId, ref: 'Task' },
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
  duration: {
    type: Number
  },
  importance: {
    type: String,
    default: 'Normal'
  },
  status: {
    type: String,
    default: 'New'
  },
  order: {
    type: Number
  }
})

const Log = buildModel('Log', {
  user: { type: ObjectId, ref: 'User' },
  target: {
    kind: String,
    item: { type: ObjectId, refPath: 'target.kind' }
  }  
})
module.exports.Log = Log

module.exports.LogCreated = Log.discriminator('LogCreated', new Schema({
}, {timestamps: true}))

module.exports.LogStatus = Log.discriminator('LogStatus', new Schema({
  status: String
}, {timestamps: true}))

module.exports.LogAssign = Log.discriminator('LogAssign', new Schema({
  assignee: { type: ObjectId, ref: 'User' }
}, {timestamps: true}))

module.exports.Comment = Log.discriminator('Comment', new Schema({
  body: String
}, {timestamps: true}))


module.exports.Reaction = buildModel('Reaction', {
  emoji: String,
  comment: { type: ObjectId, ref: 'Comment' },
  user: { type: ObjectId, ref: 'User' }
})

module.exports.Group = buildModel('Group', {
  team: { type: ObjectId, ref: 'Team' },
  name: String,
  initials: String,
  avatarColor: String,
  users: [{ type: ObjectId, ref: 'User' }],
})

module.exports.Record = buildModel('Record', {
  user: { type: ObjectId, ref: 'User' },
  task: { type: ObjectId, ref: 'Task' },
  date: Date,
  timeSpent: String,
  comment: String
})

module.exports.User = buildModel('User', {
  name: {
    type: String,
    default: ''
  },
  firstname: String,
  lastname: String,
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
  },
  jobTitle: {
    type: String,
    default: ''
  },
  avatarColor: String,
  team: { type: ObjectId, ref: 'Team' },
  role: String,
  rate: Number,
  rateType: String,
  status: String,
  readNotificationsAt: Date
})
