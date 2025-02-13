const mongoose = require('mongoose');

const mongoURI = process.env.MONGO_URI || 'mongodb+srv://new8779:asdffdsa@cluster0.yressct.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

module.exports = mongoose.connection;
