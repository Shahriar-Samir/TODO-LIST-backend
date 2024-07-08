const express = require('express');
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const app = express()
const http = require('http')
const cron = require('node-cron')
const server = http.createServer(app)
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser') 

app.use(express.json())
app.use(cors({
    origin: ['https://todo-list-frontend-eta.vercel.app','http://localhost:5173'],
    credentials: true,
}))
app.use(cookieParser())

const io = require('socket.io')(server,{
  cors: {
    origin: '*',
    credentials: true,
  }
})


const secureRoute = (req,res,next)=>{
      const {token} = req.cookies
       jwt.verify(token,process.env.SECRET,(err,decoded)=>{
          if(err){
           return  res.status(401).send('unauthorized access')
          }
          req.user = decoded
          next()
       })

}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@database1.g36ghl5.mongodb.net/?retryWrites=true&w=majority&appName=database1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("Check_IT").collection('Users')
    const taskCollection = client.db("Check_IT").collection('Tasks')
    const notificationCollection = client.db("Check_IT").collection('Notifications')

    

    const isPastDue = (dueDate, dueTime) => {
      const now = new Date();
      if(dueDate ==='' && dueTime===''){
        return false
      }
      const newDueTime = dueTime===''? '23:59' : dueTime 
      const dueDateTime = new Date(dueDate);
      const [time, modifier] = newDueTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours !== 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      dueDateTime.setHours(hours, minutes, 0, 0);
      return now > dueDateTime;
    };
    
    const isPastReminder = (dueDate, reminderTime) => {
      const now = new Date();
      if(reminderTime === ""){
        return false
      } 
      else{
        const dueDateTime = new Date(dueDate);
      const [time, modifier] = reminderTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours !== 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      dueDateTime.setHours(hours, minutes, 0, 0);
      return now > dueDateTime;
      }
    };

    function subtractTimes(time1, time2) {
      // Helper function to convert time to total minutes
      function timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      }
    
      // Convert times to total minutes
      const minutes1 = timeToMinutes(time1);
      const minutes2 = timeToMinutes(time2);
    
      // Calculate the difference in minutes
      let diff = minutes1 - minutes2;
    
      // Adjust for negative difference (time2 is later than time1)
      if (diff < 0) {
        diff += 24 * 60; // Assuming a 24-hour day
      }
    
      // Convert difference to hours and minutes
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
    
      // Determine how to format the result based on duration
      let formattedResult;
      if (hours > 0) {
        formattedResult = `${hours}:${mins < 10 ? '0' : ''}${mins} hours`;
      } else {
        formattedResult = `${mins} minutes`;
      }
    
      return formattedResult;
    }

    
    
    cron.schedule('* * * * * *', async () => {
  try {
    const tasks = await taskCollection.find({ status: 'upcoming' }).toArray();
    const updatePromises = tasks.map(async task => {
      if (isPastDue(task.dueDate, task.dueTime) && task.status === 'upcoming' ) {
        const notification = {
            title: `You've missed the task "${task.name}" to finish on time.`,
            uid: task?.uid,
            description: `The due date and time for the task "${task.name}" was ${task?.dueDate} ${task?.dueTime}. But you are late to finish the task on time.`,
            readStatus: false,  
            createdAt: Date.now()
        }
        await notificationCollection.insertOne(notification)
        return taskCollection.updateOne(
          { _id: task._id },
          { $set: { status: 'unfinished' } },
        );
      }
      if (isPastReminder(task.dueDate, task.reminderTime) && task.status === 'upcoming' && task.reminderTime !== '' && !task?.reminderStatus) {
        const notification = {
            title:`⚠️Reminder: You have ${subtractTimes(task.dueTime,task.reminderTime)} to finish the task "${task.name}".`,
            uid: task?.uid,
            description: `The task "${task.name}" has only ${subtractTimes(task.dueTime,task.reminderTime)} to finish on time.`,
            readStatus: false,
            createdAt: Date.now()
        }
        await notificationCollection.insertOne(notification)
        return taskCollection.updateOne(
          { _id: task._id },
          { $set: { status: 'upcoming', reminderStatus: true } }
        );
      }
    });
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error updating tasks:', error);
  }
});



    app.get('/',async(req,res)=>{
        res.send('Check It server')
    })  

    app.post('/jwt',async(req,res)=>{
      const data = req.body
      const token = jwt.sign(data,process.env.SECRET, {expiresIn: '1h'})
      res.cookie('token', token, {httpOnly:true, sameSite: 'none', secure:true })
      .send()
  })
  app.post('/logout',async(req,res)=>{
      res
      .clearCookie('token', {maxAge: 0, httpOnly: true,secure: true, sameSite: 'none'})
      .send()
  })

    app.get('/user/:uid',secureRoute,async(req,res)=>{
      const {uid} = req.params
      if(req?.user?.uid !== uid){
       return res.status(401).send('unauthorized access')
      }
       const getData = await userCollection.findOne({uid})
       res.send(getData)
    })
    app.get('/userExist/:uid',async(req,res)=>{
        const {uid} = req.params
        const getData = await userCollection.findOne({uid})
        if(getData){
          return res.send(true)
        }
        res.send(false)
    })

    app.get('/notifications/:uid',secureRoute,async(req,res)=>{
        const {uid} = req.params
        if(req?.user?.uid !== uid){
          return res.status(401).send('unauthorized access')
         }
        const getData = await notificationCollection.find({uid}).sort({createdAt:-1}).toArray()
        res.send(getData)
    })
  

    app.get('/userTasksAll/:uid',secureRoute,async(req,res)=>{
        const {uid} = req.params
        if(req?.user?.uid !== uid){
          return res.status(401).send('unauthorized access')
         }
        const getAllTasks = await taskCollection.find({uid, status: {$in:['upcoming','unfinished']}}).sort({createdAt:-1}).toArray()
        res.send(getAllTasks)
    })
    app.get('/searchTasks',secureRoute,async(req,res)=>{
        const {uid,query} = req.query
        if(req?.user?.uid !== uid){
          return res.status(401).send('unauthorized access')
         }
        const getAllTasks = await taskCollection.find({uid, name: {$regex:query, $options:'i'} ,status: {$in:['upcoming','unfinished']}}).sort({createdAt:-1}).toArray()
        res.send(getAllTasks)
    })
    app.get('/userTasksAllEvents/:uid',secureRoute,async(req,res)=>{
        const {uid} = req.params
        if(req?.user?.uid !== uid){
          return res.status(401).send('unauthorized access')
         }
        const getAllTasks = await taskCollection.find({uid}).sort({createdAt:-1}).toArray()
        res.send(getAllTasks)
    })
    app.get('/userTasksAllAmounts/:uid',secureRoute,async(req,res)=>{
        const {uid} = req.params
        if(req?.user?.uid !== uid){
          return res.status(401).send('unauthorized access')
         }
        const getFinishedTasks = await taskCollection.find({uid, status:'finished'}).toArray()
        const getUnfinishedTasks = await taskCollection.find({uid, status: 'unfinished'}).toArray()
        const getUpcomingTasks = await taskCollection.find({uid, status:'upcoming'}).toArray()
        const finishedTasksLength =  getFinishedTasks.length
        const unfinishedTasksLength =  getUnfinishedTasks.length
        const upcomingTasksLength =  getUpcomingTasks.length
        res.send({finishedTasksLength,unfinishedTasksLength,upcomingTasksLength})
    })

    app.patch('/markAsRead/:id',secureRoute,async(req,res)=>{
        const {id} = req.params
        const options = {upsert:true}
        const updatedData = {
          $set:{
            readStatus: true
          }
        }
        const markAsRead = await notificationCollection.updateOne({_id: new ObjectId(id)}, updatedData, options)
        res.send(markAsRead)
    })

    
    app.get('/userTasksAmounts/:uid',secureRoute,async(req,res)=>{
        const {uid} = req.params
        if(req?.user?.uid !== uid){
          return res.status(401).send('unauthorized access')
         }
        const date = new Date()
        const currentDate = date.toDateString()
        const getTodayTasks = await taskCollection.find({uid, dueDate:currentDate, status: {$in:['upcoming','unfinished']}}).toArray()
        const getAllTasks = await taskCollection.find({uid, status: {$in:['upcoming','unfinished']}}).toArray()
        const allTasksLength = getAllTasks.length
        const todayTasksLength = getTodayTasks.length
        res.send({allTasksLength, todayTasksLength})
    })

    app.get('/userNotiLengths/:uid',secureRoute,async(req,res)=>{
          const {uid} = req.params
          if(req?.user?.uid !== uid){
            return res.status(401).send('unauthorized access')
           }
          const getNotifications = await notificationCollection.find({uid, readStatus: false}).sort({createdAt:-1}).toArray()
          const notificationsLength = getNotifications.length
          res.send({notiLen: notificationsLength})
    })


    app.delete('/deleteUserTask/:id',secureRoute,async(req,res)=>{
        const {id} = req.params
        const deleteTask = await taskCollection.deleteOne({_id: new ObjectId(id)})
        res.send(deleteTask)
    })

    app.get('/userTasksToday/:uid',secureRoute,async(req,res)=>{
        const date = new Date()
        const currentDate = date.toDateString()
        const {uid} = req.params
        if(req?.user?.uid !== uid){
          return res.status(401).send('unauthorized access')
         }
        const getAllTasks = await taskCollection.find({uid, dueDate:currentDate, status:{$in:['upcoming','unfinished']}}).sort({createdAt:-1}).toArray()
        res.send(getAllTasks)
    })

    app.post('/addUser',async(req,res)=>{
        const userData = req.body
        const addData = await userCollection.insertOne(userData)
        res.send(addData)
    })
    app.post('/addUserTask',secureRoute,async(req,res)=>{
        const userTask = req.body
        if(req?.user?.uid !== userTask.uid){
          return res.status(401).send('unauthorized access')
         }
        userTask.createdAt = Date.now()
        const addData = await taskCollection.insertOne(userTask)
        res.send(addData)
    })
    app.patch('/updateUserTask/:id',secureRoute,async(req,res)=>{
      const taskData = req.body
      const {id} = req.params
      const filter = {_id: new ObjectId(id)}
      const options = {upsert:true}
      const updatedData = {
        $set:{
          name : taskData.name,
          description: taskData.description,
          dueDate: taskData.dueDate,
          dueTime: taskData.dueTime,
          reminderTime: taskData.reminderTime,
          priority: taskData.priority, 
          createdAt: Date.now()
        }
      }
        
        const updateData = await taskCollection.updateOne(filter,updatedData,options)
        res.send(updateData)
    })

    app.patch('/checkTask/:id', secureRoute,async(req,res)=>{
          const {id} = req.params
          const filter = new ObjectId(id)
          const options = {upsert:true}
          const data = {
            $set:{
              status: 'finished'
            }
          }
          const checkTask = await taskCollection.updateOne({_id:filter},data,options)
          res.send(checkTask)
        })


    app.patch('/updateUser',secureRoute, (req,res)=>{
          const userData = req.body
          const filter = {uid:userData.uid}
          const options = {upsert:true}
          const updatedData = {
            $set:{
              displayName : userData.displayName,
              photoURL : userData.photoURL,
              phoneNumber : userData.phoneNumber,
            }
          }
          const updateUser = userCollection.updateOne(filter,updatedData,options)
          res.send(updateUser)
    })

  

    io.use((socket,next)=>{
      const tokenCookie = socket.handshake.headers.cookie
      const token = tokenCookie?.substring(6)
      if(token){
        jwt.verify(token,process.env.SECRET,(err,decoded)=>{
            if(err){
              return next(new Error("Authentication Error"))
            }
            socket.user = decoded
            next()
        })
      }
      else{
        next(new Error("Authentication Error"))
      }
    })

    io.on('connection', async (socket) => {
      const userUid = socket?.user?.uid;
      if (userUid) {
          socket.on('searchTasks', async (query) => {
              const getSearchTasks = await taskCollection.find({ uid: userUid, name: { $regex: query, $options: 'i' }, status: { $in: ['upcoming', 'unfinished'] } }).sort({ createdAt: -1 }).toArray();
              socket.emit('getSearchTasks', getSearchTasks);
          });
  
          const notificationsWatch = notificationCollection.watch();
          notificationsWatch.on('change', async (change) => {
              if (change.operationType === 'insert' ) {
                  if (change.fullDocument.uid === userUid) {
                      const getNotifications = await notificationCollection.find({ uid: userUid, readStatus: false }).sort({ createdAt: -1 }).toArray();
                      const notificationsLength = getNotifications.length;
                 
                      socket.emit('notificationsLength', { notiLen: notificationsLength });
                  }
              }
              if(change.operationType === 'update'){
                  const notification =  await notificationCollection.findOne({_id: change.documentKey._id})
                  if(notification.uid === userUid){
                   const [getAllNotifications,getNotifications] = await Promise.all([notificationCollection.find({uid: userUid}).sort({createdAt:-1}).toArray(),notificationCollection.find({ uid: userUid, readStatus: false }).sort({ createdAt: -1 }).toArray()])
                      const notificationsLength = getNotifications.length;
                 
                      socket.emit('notificationsLength', { notiLen: notificationsLength });
                          socket.emit('notifications', getAllNotifications)
                  }
              }
          });
  
          const tasksWatch = taskCollection.watch();
          tasksWatch.on('change', async (change) => {

  
              if (['insert', 'delete', 'update'].includes(change.operationType)) {
                  const postId = change.documentKey._id;
  
                  // Handle document deletion
                  let postFound = null;
                  if (change.operationType !== 'delete') {
                      postFound = await taskCollection.findOne({ _id: new ObjectId(postId) });
                  } else {
                      postFound = change;
                  }
  
                  if (postFound && (change.operationType === 'delete' || postFound.uid === userUid)) {
                      const date = new Date();
                      const currentDate = date.toDateString();
  
                      // Combining multiple queries into a single batch request
                      const [getAllTasks, getTodayTasks, getFinishedTasks, getUnfinishedTasks, getUpcomingTasks] = await Promise.all([
                          taskCollection.find({ uid: userUid, status: { $in: ['upcoming', 'unfinished'] } }).sort({ createdAt: -1 }).toArray(),
                          taskCollection.find({ uid: userUid, dueDate: currentDate, status: { $in: ['upcoming', 'unfinished'] } }).sort({ createdAt: -1 }).toArray(),
                          taskCollection.find({ uid: userUid, status: 'finished' }).toArray(),
                          taskCollection.find({ uid: userUid, status: 'unfinished' }).toArray(),
                          taskCollection.find({ uid: userUid, status: 'upcoming' }).toArray(),
                      ]);
  
                      const allTasksLength = getAllTasks.length;
                      const todayTasksLength = getTodayTasks.length;
                      const finishedTasksLength = getFinishedTasks.length;
                      const unfinishedTasksLength = getUnfinishedTasks.length;
                      const upcomingTasksLength = getUpcomingTasks.length;
  
                      socket.emit('getAllTasks', getAllTasks);
                      socket.emit('eventTasksAmount', { finishedTasksLength, unfinishedTasksLength, upcomingTasksLength });
                      socket.emit('todayTasks', getTodayTasks);
                      socket.emit('amounts', { allTasksLength, todayTasksLength });
  
                      // Assuming getAllEventTasks is not too performance-intensive
                      const getAllEventTasks = await taskCollection.find({ uid: userUid }).sort({ createdAt: -1 }).toArray();
                      socket.emit('allEventTasks', getAllEventTasks);
                  }
              }
          });
      }
  
      socket.on('disconnect', () => {
          // console.log('Client disconnected');
      });
  });
  
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, ()=>{
    console.log(`listening on port ${port}`)
})
server.listen(5001,()=>{
  console.log(`Socket io listening on port ${5001}`)
})