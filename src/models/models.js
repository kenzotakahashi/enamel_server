const mongoose = require("mongoose")
const timeZone = require('mongoose-timezone')
const moment = require('moment')
const Schema = mongoose.Schema

function buildModel(name, schema, options={}) {
  return mongoose.model(name, new Schema(schema, Object.assign({timestamps: true}, options)))
}

module.exports.Folder = buildModel('Folder', {
  subFolders: [{ type: Schema.Types.ObjectId, ref: 'Folder' }],
  tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  name: String
})

module.exports.Project = Folder.discriminator('Project', new Schema({
  owners: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  startDate: Date,
  finishDate: Date,
  status: String
}, {timestamps: true}))

module.exports.Task = buildModel('Task', {
  subTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
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
  folders: [{ type: Schema.Types.ObjectId, ref: 'Folder' }],
})

module.exports.Record = buildModel('Record', {
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  task: { type: Schema.Types.ObjectId, ref: 'Task' },
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
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  folders: [{ type: Schema.Types.ObjectId, ref: 'Folder' }],
  tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  role: String,
  status: String
})