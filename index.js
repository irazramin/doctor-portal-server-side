const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@doctor.qievb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  client.connect();
  const collection = client
    .db('treatmentDb')
    .collection('treatmentCollections');

  try {
    app.get('/service', (req, res) => {
      res.send('Successful');
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log('App is listening at ', port);
});
