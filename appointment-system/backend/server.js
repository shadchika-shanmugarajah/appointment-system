const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3001;

// PostgreSQL Configuration
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'appointmentsystem',
    password: 'root',
    port: 5432,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to PostgreSQL database');
        release();
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, 'your_jwt_secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Auth endpoints
app.post('/api/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { email, password, name } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await client.query(
            `INSERT INTO Users (Email, PasswordHash, Name)
             VALUES ($1, $2, $3)
             RETURNING Id, Email, Name`,
            [email, hashedPassword, name]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/login', async (req, res) => {
    const client = await pool.connect();
    try {
        const { email, password } = req.body;
        
        const result = await client.query(
            'SELECT * FROM Users WHERE Email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.passwordhash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: user.id, email: user.email }, 'your_jwt_secret');
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Slots endpoints
app.get('/api/slots', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM Slots 
             WHERE IsAvailable = true 
             AND Date >= CURRENT_DATE
             ORDER BY Date, StartTime`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Appointments endpoints
app.post('/api/appointments', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { slot_id, notes } = req.body;
        const user_id = req.user.id;
        
        // Check if slot is available
        const slotCheck = await client.query(
            'SELECT * FROM Slots WHERE Id = $1 AND IsAvailable = true',
            [slot_id]
        );
        
        if (slotCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Slot no longer available' });
        }
        
        // Create appointment
        const result = await client.query(
            `INSERT INTO Appointments (UserId, SlotId, Notes)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [user_id, slot_id, notes]
        );
        
        // Update slot availability
        await client.query(
            'UPDATE Slots SET IsAvailable = false WHERE Id = $1',
            [slot_id]
        );
        
        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/appointments', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT a.*, s.Date, s.StartTime, s.EndTime 
             FROM Appointments a 
             JOIN Slots s ON a.SlotId = s.Id 
             WHERE a.UserId = $1 
             ORDER BY s.Date, s.StartTime`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/slots', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { date, start_time, end_time } = req.body;
        
        // Validate input
        if (!date || !start_time || !end_time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Insert new slot
        const result = await client.query(
            `INSERT INTO Slots (Date, StartTime, EndTime, IsAvailable)
             VALUES ($1, $2, $3, true)
             RETURNING *`,
            [date, start_time, end_time]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const appointment = await client.query(
            'SELECT SlotId FROM Appointments WHERE Id = $1 AND UserId = $2',
            [req.params.id, req.user.id]
        );
        
        if (appointment.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment not found' });
        }
        
        await client.query(
            'DELETE FROM Appointments WHERE Id = $1',
            [req.params.id]
        );
        
        await client.query(
            'UPDATE Slots SET IsAvailable = true WHERE Id = $1',
            [appointment.rows[0].slotid]
        );
        
        await client.query('COMMIT');
        res.json({ message: 'Appointment cancelled successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});