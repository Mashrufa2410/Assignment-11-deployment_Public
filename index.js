require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB setup
if (!process.env.DB_USER || !process.env.DB_PASS) {
  console.error('Error: Missing DB_USER or DB_PASS in environment variables.');
  process.exit(1);
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8bbir.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  tls: true,
  serverSelectionTimeoutMS: 5000,
});

let foodsCollection, purchasesCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db('Assignment-11');
    foodsCollection = db.collection('all-foods');
    purchasesCollection = db.collection('purchases');

    console.log('Connected to MongoDB and initialized collections');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit if the database connection fails
  }
}

connectDB();

// Get all food items or filter by user email
app.get('/foods', async (req, res) => {
  const { userEmail } = req.query;

  try {
    const query = userEmail ? { userEmail } : {};
    const foods = await foodsCollection.find(query).toArray();

    if (!foods.length) {
      return res.status(404).json({ message: 'No foods found' });
    }

    res.status(200).json(foods);
  } catch (error) {
    console.error('Error fetching foods:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get trending food items
app.get('/trendingFoods', async (req, res) => {
  try {
    const trendingFoods = await foodsCollection
      .find({})
      .sort({ quantity: -1 })
      .limit(5)
      .toArray();

    res.status(200).json(trendingFoods);
  } catch (error) {
    console.error('Error fetching trending foods:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get food by ID
app.get('/foods/:id', async (req, res) => {
  const foodId = req.params.id;

  if (!ObjectId.isValid(foodId)) {
    return res.status(400).json({ message: 'Invalid food ID format' });
  }

  try {
    const foodItem = await foodsCollection.findOne({ _id: new ObjectId(foodId) });

    if (!foodItem) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    res.json(foodItem);
  } catch (error) {
    console.error('Error fetching food details:', error);
    res.status(500).json({ message: 'Error fetching food details' });
  }
});

// Add new food item
app.post('/foods', async (req, res) => {
    const {
      name,
      price,
      quantity,
      foodImage,
      category,
      description,
      foodOrigin,
      purchases,
      userEmail,
    } = req.body;
  
    if (!name || !price || !quantity || !foodImage || !category || !description || !foodOrigin || !userEmail) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    try {
      const newFood = {
        name,
        price: parseFloat(price), // Ensure price is a float
        quantity: parseInt(quantity, 10), // Ensure quantity is an integer
        foodImage,
        category,
        description,
        foodOrigin,
        purchases: purchases || 0, // Default value if not provided
        userEmail,
        dateAdded: new Date(),
      };
  
      const result = await foodsCollection.insertOne(newFood);
      res.status(201).json({ ...newFood, _id: result.insertedId });
    } catch (error) {
      console.error('Error adding food item:', error);
      res.status(500).json({ message: 'Failed to add food item' });
    }
  });
  
  

// Process purchase
app.post('/purchases', async (req, res) => {
  const { foodId, quantity } = req.body;

  if (!foodId || !quantity) {
    return res.status(400).json({ message: 'Food ID and Quantity are required' });
  }

  try {
    const food = await foodsCollection.findOne({ _id: new ObjectId(foodId) });

    if (!food) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    if (food.quantity < quantity) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    await foodsCollection.updateOne(
      { _id: new ObjectId(foodId) },
      { $inc: { quantity: -quantity } }
    );

    await purchasesCollection.insertOne({
      foodId: new ObjectId(foodId),
      quantity: parseInt(quantity, 10),
      date: new Date(),
    });

    res.status(201).json({ message: 'Purchase processed successfully' });
  } catch (error) {
    console.error('Error processing purchase:', error);
    res.status(500).json({ message: 'Failed to process purchase' });
  }
});

app.get('/', (req, res) => {
    res.send('Server is running!');
  });

// Start server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = app;