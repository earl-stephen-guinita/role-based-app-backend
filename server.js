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

// POST Admin Add Account Route
app.post('/api/users', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { firstName, lastName, email, password, role = 'user', verified = false } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = users.find(u => u.email === email);
    if (existing) {
        return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ id: users.length + 1, firstName, lastName, email, password: hashedPassword, role, verified });
    res.status(201).json({ message: 'Account created' });
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

// PATCH Reset Password Route
app.patch('/api/users/:email/password', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { password } = req.body;
    const email = req.params.email;

    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = await bcrypt.hash(password, 10);
    res.json({ message: 'Password reset successfully.' });
});

// PATCH Edit User Route
app.patch('/api/users/:email', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { firstName, lastName, role, verified } = req.body;
    const email = req.params.email;

    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (verified !== undefined) user.verified = verified;

    res.json({ message: 'Account updated' });
});

// ── Departments Data ───────────────────────────────────────
let departments = [
    { id: 1, name: 'Engineering', description: 'Software team' },
    { id: 2, name: 'HR', description: 'Human Resources' }
];

// GET All Departments
app.get('/api/departments', authenticateToken, (req, res) => {
    res.json({ departments });
});

// POST Add Department
app.post('/api/departments', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required.' });
    const existing = departments.find(d => d.name === name);
    if (existing) return res.status(409).json({ error: 'Department already exists.' });
    const newDept = { id: departments.length + 1, name, description: description || '' };
    departments.push(newDept);
    res.status(201).json({ message: 'Department created', department: newDept });
});

// PATCH Edit Department
app.patch('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = parseInt(req.params.id);
    const { name, description } = req.body;
    const dept = departments.find(d => d.id === id);
    if (!dept) return res.status(404).json({ error: 'Department not found.' });
    if (name) dept.name = name;
    if (description !== undefined) dept.description = description;
    res.json({ message: 'Department updated', department: dept });
});

// DELETE Department
app.delete('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = parseInt(req.params.id);
    const index = departments.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ error: 'Department not found.' });
    departments.splice(index, 1);
    res.json({ message: 'Department deleted' });
});
    
// ── Employees Data ───────────────────────────────────────
let employees = [];

// GET All Employees
app.get('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({ employees });
});

// POST Add Employee
app.post('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { empId, email, position, dept, hireDate } = req.body;
    if (!empId || !email || !position || !dept) {
        return res.status(400).json({ error: 'ID, Email, Position and Department are required.' });
    }
    const existing = employees.find(e => e.empId === empId);
    if (existing) return res.status(409).json({ error: 'Employee ID already exists.' });

    const userExists = users.find(u => u.email === email);
    if (!userExists) return res.status(404).json({ error: 'No account found with that email.' });

    employees.push({ empId, email, position, dept, hireDate: hireDate || '' });
    res.status(201).json({ message: 'Employee added' });
});

// PATCH Edit Employee
app.patch('/api/employees/:empId', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { email, position, dept, hireDate } = req.body;
    const emp = employees.find(e => e.empId === req.params.empId);
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });
    if (email) emp.email = email;
    if (position) emp.position = position;
    if (dept) emp.dept = dept;
    if (hireDate !== undefined) emp.hireDate = hireDate;
    res.json({ message: 'Employee updated' });
});

// DELETE Employee
app.delete('/api/employees/:empId', authenticateToken, authorizeRole('admin'), (req, res) => {
    const index = employees.findIndex(e => e.empId === req.params.empId);
    if (index === -1) return res.status(404).json({ error: 'Employee not found.' });
    employees.splice(index, 1);
    res.json({ message: 'Employee deleted' });
});

// ── Requests Data ───────────────────────────────────────
let requests = [];

// GET Requests for logged-in user
app.get('/api/requests', authenticateToken, (req, res) => {
    const userRequests = requests.filter(r => r.employeeEmail === req.user.email);
    res.json({ requests: userRequests });
});

// POST Add Request
app.post('/api/requests', authenticateToken, (req, res) => {
    const { type, items } = req.body;
    if (!type || !items || items.length === 0) {
        return res.status(400).json({ error: 'Type and items are required.' });
    }
    const newRequest = {
        id: requests.length + 1,
        type,
        items,
        status: 'Pending',
        date: new Date().toLocaleDateString(),
        employeeEmail: req.user.email
    };
    requests.push(newRequest);
    res.status(201).json({ message: 'Request submitted', request: newRequest });
});

// DELETE Request
app.delete('/api/requests/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    const index = requests.findIndex(r => r.id === id && r.employeeEmail === req.user.email);
    if (index === -1) return res.status(404).json({ error: 'Request not found.' });
    requests.splice(index, 1);
    res.json({ message: 'Request deleted' });
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

