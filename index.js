const express = require('express');
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const app = express()

app.use(express.json())
app.use(cors({
    origin: ['https://todo-list-frontend-eta.vercel.app','http://localhost:5173']
}))



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

    app.get('/',async(req,res)=>{
        res.send('Check It server')
    })

    app.get('/user/:uid',async(req,res)=>{
        const {uid} = req.params
        const getData = await userCollection.findOne({uid})
        res.send(getData)
    })
    app.get('/userTasksAll/:uid',async(req,res)=>{
        const {uid} = req.params
        const getAllTasks = await taskCollection.find({uid}).sort({createdAt:-1}).toArray()
        res.send(getAllTasks)
    })
    app.get('/userTasksToday/:uid',async(req,res)=>{
        const date = new Date()
        const currentDate = date.toDateString()
        const {uid} = req.params
        const getAllTasks = await taskCollection.find({uid, dueDate:currentDate}).sort({createdAt:-1}).toArray()
        res.send(getAllTasks)
    })

    app.post('/addUser',async(req,res)=>{
        const userData = req.body
        const addData = await userCollection.insertOne(userData)
        res.send(addData)
    })
    app.post('/addUserTask',async(req,res)=>{
        const userTask = req.body
        userTask.createdAt = Date.now()
        const addData = await taskCollection.insertOne(userTask)
        res.send(addData)
    })
    app.put('/updateUserTask/:id',async(req,res)=>{
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
          createdAt: Date.now()
        }
      }
        
        const updateData = await taskCollection.updateOne(filter,updatedData,options)
        res.send(updateData)
    })

    app.patch('/updateUser', (req,res)=>{
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
