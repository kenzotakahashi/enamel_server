const { GraphQLScalarType } = require('graphql')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { User, Folder, Project, Team, Group, Record } = require('./models/models')
const { getUserId } = require('./utils')

const JWT_SECRET = process.env.JWT_SECRET

async function folderCommon(context, name, shareWith) {
  const user = getUserId(context)
  const team = (await User.findById(user)).team
  return {
    name,
    subfolders: [],
    tasks: [],
    shareWith: shareWith.map(o => ({
      ...o,
      item: ObjectId(o.kind === 'Team' ? team : o.item)
    }))
  }
}

async function recursiveQuery(id_) {
  const tree = await Folder.findById(id_, 'name tasks subfolders shareWith').populate('subfolders')
  const promises = tree.subfolders.map(id => recursiveQuery(id))
  const subfolders = await Promise.all(promises)
  const { id, name, tasks, shareWith } = tree
  return {
    id,
    name,
    tasks,
    shareWith,
    subfolders
  }
}

const resolvers = {
  Query: {
    async getGroup (_, {id}) {
      const group = await Group.findById(group.ib).populate('users')
      return group
    },
    async folderTree (_, args, context) {
      const userId = getUserId(context)
      const user = await User.findById(userId)
      const groups = await Group.find({users: ObjectId(userId)}, '_id')
      // Group, and Team that the use belongs to + user id
      const ids = groups.map(o => o._id).concat([ObjectId(userId), user.team])
      const seedPromises = ids.map(id => Folder.find({'shareWith.item': id}))
      const seeds = (await Promise.all(seedPromises)).reduce((a, b) => a.concat(b))
      const treePromises = seeds.map(o => recursiveQuery(o.id))
      return await Promise.all(treePromises)
    },
  },
  Mutation: {
    async createFolder(_, {parent, name, shareWith}, context) {
      const folder = await Folder.create(await folderCommon(context, name, shareWith))
      if (parent) {
        await Folder.update(
          { _id: ObjectId(parent) },
          { $push: { subfolders: folder.id } }
        )
      }
      // Right now populating is unnecessary
      return await Folder.findById(folder.id).populate({
        path: 'shareWith.item',
        select: '_id'
      })
    },
    async createProject(_, {parent, name, owners, startDate, finishDate, shareWith}, context) {
      const common = await folderCommon(context, name, shareWith)
      const folder = await Project.create(Object.assign(common, {
        owners,
        startDate,
        finishDate,
        status: 'Green'
      }))
      if (parent) {
        await Folder.update(
          { _id: ObjectId(parent) },
          { $push: { subfolders: folder.id } }
        )
      }
      return await Project.findById(folder.id).populate('shareWith.item')
    },
    async captureEmail (_, {email}) {
      const isEmailTaken = await User.findOne({email})
      if (isEmailTaken) {
        throw new Error('This email is already taken')
      }
      const user = await User.create({
        email,
        role: 'Owner',
        status: 'pending'
      })
      return user
    },
    async invite (_, {emails, groups, role}, context) {
      const user = getUserId(context)
      const team = (await User.findById(user)).team
      const teamMembers = (await User.find({team}, 'email')).map(o => o.email)
      const users = []
      const existingUsers = []
      for (const email of emails) {
        if (teamMembers.includes(email)) {
          existingUsers.push(email)
        } else {
          const user = await User.create({
            email,
            team,
            role,
            status: 'pending'
          })
          users.push(user.id)          
        }
      }
      for (const id of groups) {
        const group = await Group.findById(id)
        group.users = users
        await group.save()
      }
      return existingUsers
    },
    async signup (_, {id, name, password}) {
      const user = await User.findById(id)
      if (user.password) {
        // throw new Error('You have already signed up')
      }
      const common = {
        name,
        password: await bcrypt.hash(password, 10),
        status: 'Active'
      }
      if (user.role === 'Owner') {
        const team = await Team.create({
          name: `${name}'s Team`
        })
        user.set(Object.assign(common, {team: team.id}))
      } else {
        user.set(common)
      }
      await user.save()
      const token = jwt.sign({id: user.id, email: user.email}, JWT_SECRET, { expiresIn: '1y' })
      return {token, user}
    },
    async login (_, {email, password}) {
      const user = await User.findOne({email})
      if (!user) {
        throw new Error('No user with that email')
      }
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        throw new Error('Incorrect password')
      }
      const token = jwt.sign({id: user.id, email}, JWT_SECRET, { expiresIn: '1d' })
      return {token, user}
    },
    async createGroup (_, {name, initials, avatarColor, users}, context) {
      const user = getUserId(context)
      const group = await Group.create({
        name, initials, avatarColor, users: users.map(o => ObjectId(o))
      })
      return group.id
    }
  },
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue: (value) => moment(value).toDate(), // value from the client
    serialize: (value) => value.getTime(), // value sent to the client
    parseLiteral: (ast) => ast
  }),
}

module.exports = resolvers