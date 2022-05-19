const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');
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

const verifyJwt = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).send({ message: 'unauthorized' });
  }
  const token = header.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'forbidden' });
    }
    req.decoded = decoded;
    next();
  });
};

var sendEmailOption = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY,
  },
};
const emailClient = nodemailer.createTransport(sgTransport(sendEmailOption));

const sendAppointmentMail = (email, name, date, slot,treatment) => {
  var email = {
    from: process.env.EMAIL_SENDER,
    to: email,
    subject: `Your appointment for ${treatment} in on ${date} at ${slot} is confirmed`,
    text: `Your appointment for ${treatment} in on ${date} at ${slot} is confirmed`,
    html: '<b>Hello world</b>',
  };
  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log('Message sent: ' , info);
    }
  });
};

async function run() {
  client.connect();
  const collection = client.db('doctorDb').collection('doctorCollection');
  const bookingCollection = client.db('doctorDb').collection('booking');
  const userCollection = client.db('doctorDb').collection('user');
  const doctorCollection = client.db('doctorDb').collection('doctors');

  try {
    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = collection.find(query).project({ name: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        bookingDate: booking.bookingDate,
        patientName: booking.patientName,
      };
      const exists = await bookingCollection.findOne(query);

      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      sendAppointmentMail(
        booking.patientEmail,
        booking.patientName,
        booking.bookingDate,
        booking.slot,
        booking.treatment
      );
      res.send({ success: true, result });
    });

    app.get('/available', async (req, res) => {
      const date = req.query.date || 'may 15, 2022';

      // step 1:  get all services
      const services = await collection.find().toArray();

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const query = { bookingDate: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service
      services.forEach((service) => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map((book) => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        //step 7: set available to slots to make it easier
        service.slots = available;
      });

      res.send(services);
    });

    app.get('/booking', verifyJwt, async (req, res) => {
      const patientEmail = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === patientEmail) {
        const query = { patientEmail: patientEmail };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: 'forbidden' });
      }
    });

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, option);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: '1h',
      });
      res.send({ result, token });
    });
    app.put('/user/admin/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === 'admin') {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: 'forbidden' });
      }
    });

    app.get('/users', verifyJwt, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      console.log(user);
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    });

    app.post('/doctor', async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log('App is listening at ', port);
});
