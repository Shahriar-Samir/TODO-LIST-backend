const express = require('express');
const cors = require('cors')
const port = process.env.PORT || 5000
const app = express()

app.use(express.json())
app.use(cors({
    origin: ['https://todo-list-frontend-eta.vercel.app','http://localhost:5173']
}))

app.get('/',(req,res)=>{
    res.send('TODO LIST SERVER')
})

app.listen(port, ()=>{
    console.log(`listening on port ${port}`)
})
