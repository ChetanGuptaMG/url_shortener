const express = require('express');

const app = express();

// Middleware to parse JSON in incoming requests
app.use(express.json());

// Define a simple route
app.get('/', (req, res) => {
    res.send('Welcome to the Express app!');
});

// Set the port from environment or fallback to 3000
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});