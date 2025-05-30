const express = require('express');
const mysql = require('mysql2/promise');
const bcryptjs = require('bcryptjs'); // Explicitly using bcryptjs
const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://your-frontend-domain.com' : 'http://localhost:3000', // Restrict in production
  credentials: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'venuetiming',
  multipleStatements: true,
  connectionLimit: 10,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
}

// Initialize database
async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lecturers (
        id VARCHAR(20) PRIMARY KEY,
        title VARCHAR(10) NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(15) NOT NULL,
        department VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        block VARCHAR(20) NOT NULL,
        capacity INT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lecturer_id VARCHAR(20) NOT NULL,
        venue_id INT NOT NULL,
        date DATE NOT NULL,
        time_interval VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE,
        UNIQUE (venue_id, date, time_interval)
      )
    `);
    const [admins] = await connection.query('SELECT * FROM lecturers WHERE id = ? LIMIT 1', ['JACOB01']);
    if (admins.length === 0) {
      const hashedPassword = await bcryptjs.hash('Jacob12!', 10);
      await connection.query(
        'INSERT INTO lecturers (id, title, name, email, phone, department, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['JACOB01', 'Admin', 'System Administrator', 'jacob@must.edu', '0765897012', 'ICT', hashedPassword, true]
      );
      console.log('Default admin created');
    }
    const [venues] = await connection.query('SELECT COUNT(*) as count FROM venues');
    if (venues[0].count === 0) {
      const venueInserts = [];
      for (let i = 101; i <= 201; i++) {
        venueInserts.push(['Room ' + i, 'A', 50, `Lecture room ${i} in Block A`]);
      }
      for (let i = 10; i <= 101; i++) {
        venueInserts.push(['Room ' + i, 'B', 40, `Lecture room ${i} in Block B`]);
      }
      for (let i = 30; i <= 50; i++) {
        venueInserts.push(['Room ' + i, 'C', 30, `Lecture room ${i} in Block C`]);
      }
      for (let i = 1; i <= 5; i++) {
        venueInserts.push(['Library Room ' + i, 'Library', 20, `Library room ${i}`]);
      }
      for (let i = 1; i <= 20; i++) {
        venueInserts.push(['Lab ' + i, 'ComputerLab', 30, `Computer laboratory ${i}`]);
      }
      for (const venue of venueInserts) {
        await connection.query(
          'INSERT INTO venues (name, block, capacity, description) VALUES (?, ?, ?, ?)',
          venue
        );
      }
      console.log('Venues initialized');
    }
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Authentication middleware
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Authentication failed: No token provided');
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  const userId = authHeader.split(' ')[1];
  try {
    const [users] = await pool.query('SELECT * FROM lecturers WHERE id = ?', [userId]);
    if (users.length === 0) {
      console.error('Authentication failed: Invalid user ID', userId);
      return res.status(401).json({ message: 'Unauthorized: Invalid user ID' });
    }
    req.user = users[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.user.is_admin) {
    console.error('Admin access denied for user:', req.user.id);
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
}

// Login endpoint
app.post('/api/login', async (req, res) => {
  console.log('Login request:', req.body.id);
  const { id, password } = req.body;
  if (!id || !password) {
    console.error('Missing ID or password');
    return res.status(400).json({ message: 'Lecturer ID and password required' });
  }
  try {
    const [users] = await pool.query('SELECT * FROM lecturers WHERE id = ?', [id]);
    if (users.length === 0) {
      console.error('Invalid lecturer ID:', id);
      return res.status(401).json({ message: 'Invalid lecturer ID or password' });
    }
    const user = users[0];
    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) {
      console.error('Invalid password for ID:', id);
      return res.status(401).json({ message: 'Invalid lecturer ID or password' });
    }
    console.log('Login successful for ID:', id);
    res.json({ user: { id: user.id, title: user.title, name: user.name, is_admin: user.is_admin } });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  console.log('Register request:', req.body);
  const { id, title, name, email, phone, department, password } = req.body;
  if (!id || !title || !name || !email || !phone || !department || !password) {
    console.error('Missing fields');
    return res.status(400).json({ message: 'All fields are required' });
  }
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordPattern.test(password)) {
    console.error('Weak password for ID:', id);
    return res.status(400).json({ message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' });
  }
  try {
    const [existingId] = await pool.query('SELECT * FROM lecturers WHERE id = ?', [id]);
    if (existingId.length) {
      console.error('Duplicate lecturer ID:', id);
      return res.status(400).json({ message: 'Lecturer ID already in use' });
    }
    const [existingEmail] = await pool.query('SELECT email FROM lecturers WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      console.error('Duplicate email:', email);
      return res.status(400).json({ message: 'Email already in use' });
    }
    const hashedPassword = await bcryptjs.hash(password, 10);
    await pool.query(
      'INSERT INTO lecturers (id, title, name, email, phone, department, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, title, name, email, phone, department, hashedPassword]
    );
    console.log('User registered:', id);
    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get venues by block
app.get('/api/venues', async (req, res) => {
  console.log('Venues request:', req.query);
  const { block } = req.query;
  if (!block) {
    console.error('Missing block parameter');
    return res.status(400).json({ message: 'Block parameter required' });
  }
  try {
    const [venues] = await pool.query('SELECT * FROM venues WHERE block = ?', [block]);
    res.json({ venues });
  } catch (error) {
    console.error('Error fetching venues:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user bookings
app.get('/api/bookings', authenticateUser, async (req, res) => {
  console.log('Bookings request for user:', req.user.id, 'Filter:', req.query.filter);
  const { filter } = req.query;
  const lecturerId = req.user.id;
  try {
    let conditions = ['b.lecturer_id = ?'];
    const params = [lecturerId];

    if (filter === 'upcoming') {
      conditions.push('(b.date > CURDATE() OR (b.date = CURDATE() AND SUBSTRING_INDEX(b.time_interval, "-", -1) > DATE_FORMAT(NOW(), "%H:%i"))');
    } else if (filter === 'past') {
      conditions.push('(b.date < CURDATE() OR (b.date = CURDATE() AND SUBSTRING_INDEX(b.time_interval, "-", -1) <= DATE_FORMAT(NOW(), "%H:%i"))');
    }

    const query = `
      SELECT b.*, v.name as venue_name, v.block
      FROM bookings b
      JOIN venues v ON b.venue_id = v.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.date, b.time_interval
    `;
    console.log('Executing query:', query);
    console.log('With params:', params);

    const [bookings] = await pool.query(query, params);
    res.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single booking
app.get('/api/bookings/:id', authenticateUser, async (req, res) => {
  console.log('Booking details request:', req.params);
  const bookingId = req.params.id;
  const lecturerId = req.user.id;
  try {
    const [bookings] = await pool.query(
      'SELECT b.*, v.name as venue_name, v.block, v.id as venue_id FROM bookings b JOIN venues v ON b.venue_id = v.id WHERE b.id = ? AND (b.lecturer_id = ? OR ? = TRUE)',
      [bookingId, lecturerId, req.user.is_admin]
    );
    if (bookings.length === 0) {
      console.error('Booking not found:', bookingId);
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ booking: bookings[0] });
  } catch (error) {
    console.error('Error fetching booking:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create booking
app.post('/api/bookings', authenticateUser, async (req, res) => {
  console.log('Booking creation request:', req.body);
  const { venue_id, date, time_interval } = req.body;
  const lecturerId = req.user.id;
  if (!venue_id || !date || !time_interval) {
    console.error('Missing fields in booking');
    return res.status(400).json({ message: 'All fields required' });
  }
  const timePattern = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  if (!timePattern.test(time_interval)) {
    console.error('Invalid time interval format:', time_interval);
    return res.status(400).json({ message: 'Invalid time interval format (use HH:MM-HH:MM)' });
  }
  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isNaN(bookingDate) || bookingDate < today) {
    console.error('Invalid or past date:', date);
    return res.status(400).json({ message: 'Invalid date or cannot book in the past' });
  }
  try {
    const [existingBookings] = await pool.query(
      'SELECT * FROM bookings WHERE venue_id = ? AND date = ? AND time_interval = ?',
      [venue_id, date, time_interval]
    );
    if (existingBookings.length > 0) {
      console.error('Venue already booked:', { venue_id, date, time_interval });
      return res.status(400).json({ message: 'Venue already booked for this time slot' });
    }
    const [result] = await pool.query(
      'INSERT INTO bookings (lecturer_id, venue_id, date, time_interval) VALUES (?, ?, ?, ?)',
      [lecturerId, venue_id, date, time_interval]
    );
    console.log('Booking created:', result.insertId);
    res.status(201).json({ message: 'Booking created successfully', bookingId: result.insertId });
  } catch (error) {
    console.error('Error creating booking:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Venue already booked for this time slot' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update booking
app.put('/api/bookings/:id', authenticateUser, async (req, res) => {
  console.log('Booking update request:', req.params.id, req.body);
  const bookingId = req.params.id;
  const { venue_id, date, time_interval } = req.body;
  const lecturerId = req.user.id;
  if (!venue_id || !date || !time_interval) {
    console.error('Missing fields in update request');
    return res.status(400).json({ message: 'All fields required' });
  }
  const timePattern = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  if (!timePattern.test(time_interval)) {
    console.error('Invalid time interval format:', time_interval);
    return res.status(400).json({ message: 'Invalid time interval format (use HH:MM-HH:MM)' });
  }
  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isNaN(bookingDate) || bookingDate < today) {
    console.error('Invalid or past date:', date);
    return res.status(400).json({ message: 'Invalid date or cannot book in the past' });
  }
  try {
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE id = ? AND lecturer_id = ?',
      [bookingId, lecturerId]
    );
    if (bookings.length === 0) {
      console.error('Booking not found or unauthorized:', bookingId);
      return res.status(404).json({ message: 'Booking not found or unauthorized' });
    }
    const [existingBookings] = await pool.query(
      'SELECT * FROM bookings WHERE venue_id = ? AND date = ? AND time_interval = ? AND id != ?',
      [venue_id, date, time_interval, bookingId]
    );
    if (existingBookings.length > 0) {
      console.error('Venue already booked for update:', { venue_id, date, time_interval });
      return res.status(400).json({ message: 'Venue already booked for this time slot' });
    }
    await pool.query(
      'UPDATE bookings SET venue_id = ?, date = ?, time_interval = ? WHERE id = ?',
      [venue_id, date, time_interval, bookingId]
    );
    console.log('Booking updated:', bookingId);
    res.json({ message: 'Booking updated successfully' });
  } catch (error) {
    console.error('Error updating booking:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Venue already booked for this time slot' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete booking
app.delete('/api/bookings/:id', authenticateUser, async (req, res) => {
  console.log('Booking deletion request:', req.params.id);
  const bookingId = req.params.id;
  const lecturerId = req.user.id;
  try {
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE id = ? AND (lecturer_id = ? OR ? = TRUE)',
      [bookingId, lecturerId, req.user.is_admin]
    );
    if (bookings.length === 0) {
      console.error('Booking not found or unauthorized:', bookingId);
      return res.status(404).json({ message: 'Booking not found or unauthorized' });
    }
    await pool.query('DELETE FROM bookings WHERE id = ?', [bookingId]);
    console.log('Booking deleted:', bookingId);
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin endpoints
app.get('/api/lecturers', authenticateUser, requireAdmin, async (req, res) => {
  console.log('Lecturers request received');
  try {
    const [lecturers] = await pool.query(
      'SELECT id, title, name, email, phone, department, is_admin, created_at FROM lecturers ORDER BY name'
    );
    res.json({ lecturers });
  } catch (error) {
    console.error('Error handling lecturers:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/bookings/all', authenticateUser, requireAdmin, async (req, res) => {
  console.log('All bookings request received');
  try {
    const [bookings] = await pool.query(
      'SELECT b.*, v.name as venue_name, l.name as lecturer_name, l.title FROM bookings b JOIN venues v ON b.venue_id = v.id JOIN lecturers l ON b.lecturer_id = l.id ORDER BY b.date DESC'
    );
    bookings.forEach((booking) => {
      booking.lecturer_name = `${booking.title} ${booking.lecturer_name}`;
    });
    res.json({ bookings });
  } catch (error) {
    console.error('Error handling all bookings:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
async function startServer() {
  try {
    await testDatabaseConnection();
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}
startServer();