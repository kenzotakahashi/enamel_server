const { GraphQLScalarType } = require('graphql')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { User, Folder, Project, Team, Group, Record } = require('./models/models')
const { getUserId } = require('./utils')

const JWT_SECRET = process.env.JWT_SECRET

const resolvers = {
  Query: {
    async folders () {
      return []
    },
    async getGroup (_, {id}) {
      const group = await Group.findById(group.ib).populate('users')
      return group
    }
  },
  Mutation: {
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
      await user.save()
      return user.id
    },
    async invite (_, {team, emails, groups, role}) {
      const teamMembers = User.find({team}, 'email').map(o => o.email)
      const groups = groups.map(id => Group.findById(id))
      const users = []
      const existingUsers = []
      for (const email of emails) {
        if (teamMembers.includes(email)) {
          existingUsers.push(email)
        } else {
          const user = User.create({
            email,
            team,
            role,
            status: 'pending'
          })
          user.save()
          users.push(user.id)          
        }
      }
      return existingUsers
    },
    async signup (_, {id, name, password}) {
      const user = await User.findById(id)
      if (user.password) {
        throw new Error('You have already signed up')
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
        await team.save()
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
    async createGroup (_, {name, initials, avatarColor, users}) {
      const group = await Group.create({
        name, initials, avatarColor, users: users.map(o => ObjectId(o))
      })
      await group.save()
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