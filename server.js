const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'super-secret-key';

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500']
}));

app.use(express.json());

let users = [
    { id: 1, firstName: 'Admin', lastName: 'User', email: 'admin@example.com', password: 'UNHASHED', role: 'admin', verified: true},
    { id: 2, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', password: 'UNHASHED', role: 'user', verified: true}
];

if (!users[0].password.includes('$2a$')) {
    users[0].password = bcrypt.hashSync('admin123', 10);
    users[1].password = bcrypt.hashSync('user123', 10);
}

// POST Register Route
app.post('/api/register', async (req, res) => {
   const {firstName, lastName, email, password, role = 'user'} = req.body;
   
   if (!firstName || !lastName || !email|| !password) {
    return res.status(400).json({error: 'All fields are required'});
   }

   const existing = users.find(u => u.email === email);
   if (existing) {
    return res.status(409).json({ error: 'User already exists'});
   }

   const hashedPassword = await bcrypt.hash(password, 10);
   const newUser = {
    id: users.length + 1,
    firstName,
    lastName,
    email,
    password: hashedPassword,
    role,
    verified: false
   };

   users.push(newUser);
   res.status(201).json ({ message: 'User registered', firstName, lastName, email, role});
});

// POST Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        SECRET_KEY,
        { expiresIn: '1h'}
    );

    res.json({ token, user: { firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } });
});

// Profile Route
app.get('/api/profile', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

app.get('/api/users', authenticateToken, authorizeRole('admin'), (req, res) => {
    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json({ users: safeUsers });
});

// DELETE User Route
app.delete('/api/users/:email', authenticateToken, authorizeRole('admin'), (req, res) => {
    const email = req.params.email;
    const protectedEmails = ['admin@example.com', 'alice@example.com'];

    if (protectedEmails.includes(email)) {
        return res.status(403).json({ error: 'Cannot delete default system accounts.' });
    }

    const index = users.findIndex(u => u.email === email);
    if (index === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    users.splice(index, 1);
    res.json({ message: 'User deleted' });
});
    
app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({ message: 'Welcome to admin dashboard!', data: 'Secret admin info' });
});

app.get('/api/content/guest', (req, res) => {
    res.json({ message: 'Public content for all visitors' });
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

function authorizeRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        next();
    };
}

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
    console.log(`🔐 Try logging in with:`);
    console.log(`   - Admin: email=admin@example.com, password=admin123`);
    console.log(`   - User:  email=alice@example.com, password=user123`);
});

