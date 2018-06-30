const { GraphQLScalarType } = require('graphql')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { User, Purchase } = require('./models/models')
const { getUserId } = require('./utils')

const JWT_SECRET = process.env.JWT_SECRET

const resolvers = {
  Query: {
    async showPurchase (_, {id}, context) {
      const user = getUserId(context)
      await Purchase.findById(id)
    },
    async purchases (_, {input}, context, info) {
      const user = getUserId(context)
      return await Purchase.find({
        user: ObjectId(user),
        $and : [
          {"$expr": { "$eq": [{ "$month": "$date" }, input.month] }},
          {"$expr": { "$eq": [{ "$year": "$date" }, input.year] }}
        ]
      }).sort({ date: -1 })

  },
  Mutation: {
    async createPurchase (_, {input}, context) {
      const user = getUserId(context)
      const {id, ...rest} = input
      const params = Object.assign(rest, {user, _id: id})
      const purchase = await Purchase.create(params)
      await purchase.save()
      return purchase
    },
    async updatePurchase (_, {input}, context) {
      const user = getUserId(context)
      const {id, ...rest} = input
      const purchase = await Purchase.findById(id)
      purchase.set(rest)
      await purchase.save()
      return purchase
    },
    async deletePurchase (_, {id}, context) {
      const user = getUserId(context)
      await Purchase.deleteOne({_id: id})
      return true
    },
    async signup (_, {input}) {
      const {email, password} = input
      const u = await User.findOne({email})
      if (u) {
        throw new Error('This email is already taken')
      }
      const user = await User.create({
        email,
        password: await bcrypt.hash(password, 10)
      })
      await user.save()

      const token = jwt.sign({id: user.id, email}, JWT_SECRET, { expiresIn: '1y' })
      return {token, user}
    },
    async login (_, {input}) {
      const {email, password} = input
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