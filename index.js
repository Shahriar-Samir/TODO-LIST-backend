const express = require('express');

const port = process.env.PORT || 5000
const app = express()

app.get('/',(req,res)=>{
    res.send('TODO LIST SERVER')
})

app.listen(port, ()=>{
    console.log(`listening on port ${port}`)
})
