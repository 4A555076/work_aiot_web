const express = require('express');
const cors = require('cors');
const app = express();
const router = express.Router();
const path = require('path');
require('dotenv').config();


const fireRoutes = require('./routes/fireRoutes');
const userRoutes = require('./routes/userRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const stationRoutes = require('./routes/stationRoutes');
const openDataRoutes = require('./routes/openDataRoutes');
const chartRoutes = require('./routes/chartRoutes');


router.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cors());
app.use('/aiot',express.static(path.join(__dirname, 'dist')));

app.use('/aiot', router);
app.use('/aiot', fireRoutes);
app.use('/aiot', userRoutes);
app.use('/aiot', sensorRoutes);
app.use('/aiot', stationRoutes);
app.use('/aiot', openDataRoutes);
app.use('/aiot', chartRoutes);

const port = process.env.port || 4000;
app.listen(port, () => {
  console.log(`service is running on:: [${port}]`);
});
