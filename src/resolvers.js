const { GraphQLScalarType } = require('graphql')
const { withFilter } = require('graphql-yoga')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const req = require('request')
const moment = require('moment')
const nodeMailer = require('nodemailer')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
// const sg = require('@sendgrid/mail')
// sg.setApiKey(process.env.SENDGRID_API_KEY)

const { User, Folder, Project, Team, Group, Record, Task,
  Log, LogCreated, LogStatus, LogAssign, Comment } = require('./models')
const { getUserId } = require('./utils')
const { welcomeEmail, invitationEmail, notificationNewUser } = require('./emails')

const JWT_SECRET = process.env.JWT_SECRET

const transporter = nodeMailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_ACCOUNT,
      pass: process.env.GMAIL_PASSWORD
    }
})

async function folderCommon(request, parent, name, shareWith) {
  const userId = getUserId(request)
  return {
    name,
    parent: parent || undefined,
    shareWith: shareWith.concat(parent
      ? []
      : [{
        kind: 'Team',
        item: (await User.findById(userId)).team
      }].concat(['External User', 'Collaborator']
        .includes((await User.findById(userId)).role)
        ? [{kind: 'User', item: userId}] : [])
    ),
    order: moment().valueOf()
  }
}

async function deleteSubTasks(id) {
  await Comment.deleteMany({'parent.item': id})
  const tasks = await Task.find({parent: id})
  for (const task of tasks) {
    await deleteSubTasks(task.id)
    await Task.deleteOne({_id: task.id})
  }
}

async function deleteSubfolders(id) {
  const tasks = await Task.find({ folders: id })
  for (const task of tasks) {
    await Task.deleteOne({_id: task.id})
    deleteSubTasks(task.id)
  }
  const folders = await Folder.find({parent: id})
  for (const folder of folders) {
   await deleteSubfolders(folder.id)
   await Folder.deleteOne({_id: folder.id})
  } 
}

function populateTask(promise) {
  return promise
    .populate('folders', 'name')
    .populate('parent', 'name')
    .populate('assignees', 'name email firstname lastname avatarColor')
    .populate('creator', 'name email firstname lastname')
    .populate('shareWith')
}

function randomChoice(arr) {
  return arr[Math.floor(arr.length * Math.random())]
}

const avatarColors = [
  "D81B60","F06292","F48FB1","FFB74D","FF9800","F57C00","00897B","4DB6AC","80CBC4",
  "80DEEA","4DD0E1","00ACC1","9FA8DA","7986CB","3949AB","8E24AA","BA68C8","CE93D8"
]

async function getTasks_(parent, folder) {
  if (parent) {
    return await populateTask(Task.find({ parent })).sort({ order: 1 })
  } else {
    return await populateTask(Task.find({ folders: folder })).sort({ order: -1 })
  }
}

async function getSubfolders(id) {
  const folders = await Folder.find({ parent: id })
  let list = []
  for (const folder of folders) {
    list.push(folder.id)
    list = list.concat(await getSubfolders(folder.id))
  }
  return list
}

async function getFolders_(parent, userId) {
  if (parent) {
    return await Folder.find({parent}).sort({ order: 1 })
  } else {
    const user = await User.findById(userId)
    const groups = await Group.find({users: ObjectId(userId)}, '_id')
    const ids = groups.map(o => o._id).concat(
      ['External User', 'Collaborator'].includes(user.role)
      ? [ObjectId(userId)]
      : [ObjectId(userId), user.team]
    )
    return await Folder.find({ 'shareWith.item': ids })
      .populate('shareWith').sort({ order: 1 })
  }
}

async function getRootFolder(folder) {
  let f = folder
  while (f.parent) {
    f = await Folder.findById(f.parent)
  }
  return f
}

async function getRootTask(task) {
  let t = task
  while (t.parent) {
    t = await Task.findById(t.parent)
  }
  return t
}

const resolvers = {
  Query: {
    async getTeam (_, args, {request, pubsub}) {
      const userId = getUserId(request)
      const user = await User.findById(userId)
      return await Team.findById(user.team)
    },
    async getGroup (_, {id}, {request}) {
      const userId = getUserId(request)
      const group = await Group.findById(id).populate('users')
      return group
    },
    async getGroups (_, args, {request}) {
      const userId = getUserId(request)
      const team = (await User.findById(userId)).team
      return await Group.find({team}).sort({ createdAt: -1 })
      return group
    },
    async getFolders (_, {parent}, {request}) {
      const userId = getUserId(request)
      return getFolders_(parent, userId)
    },
    async getFolder (_, args, {request}) {
      const userId = getUserId(request)
      return await Folder.findById(args.id).populate('shareWith')
    },
    async getTasks (_, {parent, folder}, {request}) {
      const userId = getUserId(request)
      return getTasks_(parent, folder)
    },
    async getTask (_, {id}, {request}) {
      const userId = getUserId(request)
      const task = await populateTask(Task.findById(id))
      if (!task) {
        throw new Error('Task with that id does not exist')
      }
      return task
    },
    async getAllTasks (_, {folder}, {request}) {
      const userId = getUserId(request)
      const folders = await getSubfolders(folder)
      folders.push(folder)
      return await populateTask(Task.find({ folders: {$in: folders} }))
    },
    async getUser (_, {id}, {request}) {
      const userId = getUserId(request)
      return await User.findById(id || userId)
    },
    async getUsers (_, args, {request}) {
      const userId = getUserId(request)
      const team = (await User.findById(userId)).team
      return await User.find({team})
    },
    async getComments (_, {target}, {request}) {
      return await Comment.find({'target.item': ObjectId(target)})
                          .populate('user', 'firstname lastname avatarColor')
    },
    async getLogs (_, args, {request}) {
      const userId = getUserId(request)
      const team = (await User.findById(userId)).team
      const teamMembers = await User.find({
        team,
        _id: { $ne: userId }
      })

      return await Log.find({user: {$in: teamMembers.map(o => o.id)}})
        .limit(30)
        .sort({ createdAt: -1 })
        .populate('user', 'firstname lastname avatarColor')
        .populate('target.item', 'name')
    },
    async getRecord (_, {id, task, date}, {request}) {
      const user = getUserId(request)
      if (id) {
        return await Record.findById(id)       
      } else {
        return await Record.findOne({
          user,
          task,
          date: {
            $gte: moment(date).startOf('day'),
            $lte: moment(date).endOf('day')
          }
        })
      }
    }
  },
  Mutation: {
    async createComment(_, {body, target}, {request}) {
      const userId = getUserId(request)
      const comment = await Comment.create({
        body,
        user: userId,
        target,
      })

      if (target.kind === 'Task') {
        const task = await Task.findById(target.item)
        const rootTask = await getRootTask(task)
        const f = await Folder.findById(rootTask.folders[0])
        const rootFolder = await getRootFolder(f)
        if (rootFolder.slack) {
          const user = await User.findById(userId)
          const link = `${process.env.CLIENT_URL}/w/folder/${rootFolder.id}/list/${task.id}`
          req.post(rootFolder.slack, {json: {"attachments": [{
              "fallback": `${user.name} commented - ${body} ${link}`,
              "text": body,
              "author_name": user.name,
              "title": task.name,
              "title_link": link
            }]}},
            function (error, response, body) {
              if (!error && response.statusCode == 200) {
                console.log(body)
              }
            }
          )
        }        
      }

      return await Comment.findById(comment.id)
        .populate('user', 'firstname lastname avatarColor')
    },
    async deleteComment (_, {id}, {request}) {
      const userId = getUserId(request)
      await Comment.deleteOne({_id: id})
      return true
    },
    async createTask(_, {folder, parent, name}, {request, pubsub}) {
      const userId = getUserId(request)
      const task = await Task.create({
        name,
        parent,
        folders: folder ? [folder] : [],
        creator: userId,
        order: moment().valueOf()
      })
      LogCreated.create({
        user: userId,
        target: {
          kind: 'Task',
          item: task.id
        }
      })
      if (!task.parent) {
        const f = await Folder.findById(folder)
        const rootFolder = await getRootFolder(f)
        if (rootFolder.slack) {
          const user = await User.findById(userId)
          const link = `${process.env.CLIENT_URL}/w/folder/${rootFolder.id}/list/${task.id}`
          req.post(rootFolder.slack, {json: {"attachments": [{
              "fallback": `${user.name} added new task - ${task.name} ${link}`,
              "text": "Added new task",
              "author_name": user.name,
              "title": task.name,
              "title_link": link
            }]}},
            function (error, response, body) {
              if (!error && response.statusCode == 200) {
                console.log(body)
              }
            }
          )
        }        
      }

      return await populateTask(Task.findById(task.id))
    },
    async updateTask(_, {id, input}, {request}) {
      const userId = getUserId(request)
      return await populateTask(Task.findOneAndUpdate(
        { _id: id },
        { $set: input },
        { new: true }
      ))
    },
    async sortTasks(_, {tasks, orders, parent, folder}, {request}) {
      const userId = getUserId(request)
      for (const [i, id] of tasks.entries()) {
        await Task.findOneAndUpdate(
          { _id: id },
          { $set: {order: orders[i]} },
        )
      }
      return getTasks_(parent, folder)
    },
    async deleteTask(_, {id}, {request}) {
      const userId = getUserId(request)
      await Task.deleteOne({_id: id})
      deleteSubTasks(id)
      return true
    },
    async createFolder(_, {parent, name, shareWith}, {request}) {
      const folder = await Folder.create(await folderCommon(request, parent, name, shareWith))
      return await Folder.findById(folder.id).populate('shareWith.item')
    },
    async createProject(_, {parent, name, shareWith, owners, startDate, finishDate}, {request}) {
      const common = await folderCommon(request, parent, name, shareWith)
      const folder = await Project.create(Object.assign(common, {
        owners,
        startDate,
        finishDate,
        status: 'Green'
      }))
      return await Project.findById(folder.id).populate('shareWith.item')
    },
    async updateFolder(_, {id, input}, {request}) {
      const userId = getUserId(request)
      return await Folder.findOneAndUpdate(
        { _id: id },
        { $set: input },
        { new: true }
      ).populate('shareWith')
    },
    async sortFolders(_, {folders, orders, parent}, {request}) {
      const userId = getUserId(request)
      for (const [i, id] of folders.entries()) {
        await Folder.findOneAndUpdate(
          { _id: id },
          { $set: {order: orders[i]} },
        )
      }
      return getFolders_(parent, userId)
    },
    async deleteFolder(_, {id}, {request}) {
      const userId = getUserId(request)
      await Folder.deleteOne({_id: id})
      deleteSubfolders(id)
      return true
    },
    async captureEmail (_, {email}) {
      const isEmailTaken = await User.findOne({email})
      if (isEmailTaken) {
        throw new Error('This email is already taken')
      }
      const user = await User.create({
        email,
        role: 'Owner',
        status: 'Pending'
      })
      // sg.send(welcomeEmail(email, user))
      // sg.send(notificationNewUser(email, user))
      transporter.sendMail(welcomeEmail(email, user))
      transporter.sendMail(notificationNewUser(email, user))

      return user
    },
    async invite (_, {emails, groups, role}, {request}) {
      const userId = getUserId(request)
      const thisUser = await User.findById(userId)
      const team = thisUser.team
      const teamMembers = (await User.find({team}, 'email')).map(o => o.email)
      const users = []
      for (const email of emails) {
        if (teamMembers.includes(email)) {
        } else {
          const user = await User.create({
            email,
            team,
            role,
            status: 'Pending'
          })
          users.push(user)
          transporter.sendMail(invitationEmail(email, user, thisUser))
        }
      }
      const userIds = users.map(o => o.id)
      for (const id of groups) {
        const group = await Group.findById(id)
        group.users = userIds
        await group.save()
      }
      return users
    },
    async decline (_, {id}) {
      await User.findOneAndUpdate(
        { _id: id },
        { $set: { status: 'Declined' } },
      )
      return true
    },
    async signup (_, {id, firstname, lastname, password}) {
      const user = await User.findById(id)
      const common = {
        firstname,
        lastname,
        name: `${firstname} ${lastname}`,
        avatarColor: randomChoice(avatarColors),
        password: await bcrypt.hash(password, 10),
        status: 'Active'
      }
      if (user.role === 'Owner') {
        const team = await Team.create({
          name: `${common.name}'s Team`
        })
        user.set(Object.assign(common, {
          team: team.id,
          jobTitle: 'CEO/Owner/Founder'
        }))
      } else {
        user.set(common)
      }
      await user.save()
      const token = jwt.sign({id: user.id, email: user.email}, JWT_SECRET)
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
      const token = jwt.sign({id: user.id, email}, JWT_SECRET)
      return {token, user}
    },
    // async deleteUser (_, {id, groups, notify}, context) {
    //   const userId = getUserId(request)
    //   await User.deleteOne({_id: id})
    //   await Group.update(
    //     {_id: { $in: groups} },
    //     { },
    //     { multi: true }
    //   )
    //   return true
    // },
    async createGroup (_, {name, initials, avatarColor, users}, {request}) {
      const userId = getUserId(request)
      const team = (await User.findById(userId)).team
      return await Group.create({
        name,
        team,
        initials,
        avatarColor,
        users
      })
    },
    async addUsersToGroup (_, {id, users}, {request}) {
      const userId = getUserId(request)
      return await Group.findOneAndUpdate(
        { _id: id },
        { $push: { users: { $each: users } } },
        { new: true }
      )
    },
    async removeUsersFromGroup (_, {id, users}, {request}) {
      const userId = getUserId(request)
      return await Group.findOneAndUpdate(
        { _id: id },
        { $pullAll: { users } },
        { new: true }
      )
    },
    async updateGroup (_, {id, name, initials, avatarColor}, {request}) {
      const userId = getUserId(request)
      return await Group.findOneAndUpdate(
        { _id: id },
        { $set: { name, initials, avatarColor } },
        { new: true }
      )
    },
    async deleteGroup (_, {id}, {request}) {
      const userId = getUserId(request)
      await Group.deleteOne({_id: id})
      return true
    },
    async updateUser(_, {id, input}, {request}) {
      const userId = getUserId(request)
      return await User.findOneAndUpdate(
        { _id: id || userId },
        { $set: input },
        { new: true }
      )
    },
    async createRecord (_, {input}, {request}) {
      const user = getUserId(request)
      return await Record.create({
        ...input,
        user
      })
    },
    async updateRecord (_, {id, input}, {request}) {
      const userId = getUserId(request)
      return await Record.findOneAndUpdate(
        { _id: id },
        { $set: input },
        { new: true }
      )
    },
    async deleteRecord (_, {id}, {request}) {
      const userId = getUserId(request)
      await Record.deleteOne({_id: id})
      return true      
    }
  },
  // Subscription: {
  //   taskAdded: {
  //     subscribe: withFilter(
  //       (parent, args, { pubsub }) => pubsub.asyncIterator('taskAdded'),
  //       (payload, variables) => {
  //         console.log(payload)
  //         console.log(variables)
  //         return true
  //       }
  //     )
  //   }
  // },
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue: (value) => moment(value).toDate(), // value from the client
    serialize: (value) => value.getTime(), // value sent to the client
    parseLiteral: (ast) => ast
  })
}

module.exports = resolvers
