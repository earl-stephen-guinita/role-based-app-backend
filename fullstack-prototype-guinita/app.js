let isLoggedIn = false;
let currentUser = null;

// ── Database (localStorage-backed) ────────────────────────
const STORAGE_KEY = 'ipt_demo_v1';

window.db = {
    accounts: [],
    departments: [],
    employees: [],
    myRequests: []
};

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            window.db.employees = parsed.employees || [];
            window.db.myRequests = parsed.myRequests || [];
        } else {
            window.db.employees = [];
            window.db.myRequests = [];
            saveToStorage();
        }
    } catch (e) {

        window.db.employees = [];
        window.db.myRequests = [];
        saveToStorage();
    }
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

// ── Hash Routing ───────────────────────────────────────────
function navigateTo(hash) {
    window.location.hash = hash;
}

function handleRouting() {
    const hash = window.location.hash || '#/';

    // Protected routes — must be logged in
    const protectedRoutes = ['#/profile', '#/my-requests'];

    // Admin-only routes
    const adminRoutes = ['#/employees', '#/accounts', '#/departments'];

    // Redirect unauthenticated users away from protected pages
    if (protectedRoutes.includes(hash) && !isLoggedIn) {
        window.location.hash = '#/login';
        return;
    }

    // Redirect non-admins away from admin pages
    if (adminRoutes.includes(hash) && (!isLoggedIn || currentUser.role !== 'admin')) {
        window.location.hash = '#/login';
        return;
    }

    // Map hash to page name
    const pageMap = {
        '#/': 'home',
        '#/register': 'register',
        '#/verify': 'verify',
        '#/login': 'login',
        '#/profile': 'profile',
        '#/employees': 'employees',
        '#/accounts': 'accounts',
        '#/departments': 'departments',
        '#/my-requests': 'my-requests'
    };

    const pageName = pageMap[hash];
    if (pageName) {
        showPage(pageName);
    } else {
        window.location.hash = '#/';
    }
}

// Listen for hash changes (back/forward button, manual URL edit)
window.addEventListener('hashchange', handleRouting);

// On first load — set hash to #/ if empty, then route
window.addEventListener('load', function () {
    if (!window.location.hash) {
        window.location.hash = '#/';
    }
    handleRouting();
});

// ── page navigation ────────────────────────────────────────
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); // finds every element that has class page and shows one page at a time
    const target = document.getElementById('page-' + name); // finds the specific page that you want to show
    if (target) target.classList.add('active'); // adds active to show the page

    // shows email verified banner
    if (name !== 'login') {
        document.getElementById("loginVerifiedBanner").classList.add("d-none");
    }

    // only runs when name is profile and calls loadProfileView function
    if (name === 'profile') {
        renderProfile();
    }

    // Render tables when navigating to admin pages
    if (name === 'employees') { renderEmployeesTable(); refreshDeptDropdown(); }
    if (name === 'departments') { renderDepts(); }
    if (name === 'accounts') { renderAccountsList(); }
    if (name === 'my-requests') { renderRequests(); }
}

// ── Navbar Elements ────────────────────────────────────────
const usernameBtn = document.getElementById("usernameBtn");
const logoutBtn = document.getElementById("logoutBtn");

// ── Navbar State ───────────────────────────────────────────
function setAuthState(isAuth, user = null) {
    isLoggedIn = isAuth;
    currentUser = user;

    const body = document.body;
    if (isAuth && user) {
        body.classList.add("authenticated");
        body.classList.remove("not-authenticated");
        usernameBtn.textContent = user.firstName;
        if (user.role === "admin") {
            body.classList.add("is-admin");
        } else {
            body.classList.remove("is-admin");
        }
    } else {
        body.classList.add("not-authenticated");
        body.classList.remove("authenticated", "is-admin");
        usernameBtn.textContent = "";
    }
}

// ── Logout ─────────────────────────────────────────────────
logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem('authToken');
    setAuthState(false);
    navigateTo('#/');
});

// ── Auth Header ────────────────────────────────────────────
function getAuthHeader() {
    const token = sessionStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Register Form ──────────────────────────────────────────
document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const form = this;
    const firstName = document.getElementById("regFirstName").value.trim();
    const lastName = document.getElementById("regLastName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;

    if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            form.classList.remove("was-validated");
            form.reset();
            document.getElementById("verifyEmailDisplay").textContent = email;
            navigateTo('#/verify');
        } else {
            alert(data.error || 'Registration failed.');
        }
    } catch (err) {
        alert('Network error.');
    }
});

// ── Simulate Email Verification ────────────────────────────
document.getElementById("simulateVerifyBtn").addEventListener("click", function () {
    const email = localStorage.getItem("unverified_email");
    const account = window.db.accounts.find(a => a.email === email);
    if (account) {
    account.verified = true;
    saveToStorage();
    }
    this.disabled = true;
    this.textContent = "✔ Verified!";
    setTimeout(() => {
        document.getElementById("loginVerifiedBanner").classList.remove("d-none");
        navigateTo('#/login');
    }, 1200);
});

// ── Login Form ─────────────────────────────────────────────
document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const form = this;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorBox = document.getElementById("loginError");

    if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
    }

    // Login with API
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            sessionStorage.setItem('authToken', data.token);
            setAuthState(true, data.user);

            errorBox.classList.add("d-none"); // hides error message box
            form.classList.remove("was-validated"); // removes validation borders after login
            form.reset(); // clears input fields

            navigateTo('#/profile');
        } else {
            errorBox.textContent = data.error || 'Login failed.';
            errorBox.classList.remove("d-none");
        }
    } catch (err) {
        errorBox.textContent = 'Network error.';
        errorBox.classList.remove("d-none");
    }
});

// ── profile card ─────────────────────────────────────
function renderProfile() {
    if (!currentUser) return; // collects logged-in user's data
    document.getElementById("profileFullName").textContent =
        currentUser.firstName + " " + currentUser.lastName;
    document.getElementById("profileEmail").textContent =
        currentUser.email;
    document.getElementById("profileRole").textContent =
        currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
}

// ── Departments Data ───────────────────────────────────────
let editDeptId = null;

async function renderDepts() {
    const tbody = document.getElementById("deptTableBody");
    const noRow = document.getElementById("noDeptsRow");
    tbody.querySelectorAll("tr.dept-row").forEach(r => r.remove());

    try {
        const res = await fetch('http://localhost:3000/api/departments', {
            headers: getAuthHeader()
        });
        const data = await res.json();
        departments = data.departments;

        if (departments.length === 0) {
            noRow.classList.remove("d-none");
            return;
        }
        noRow.classList.add("d-none");

        departments.forEach((dept) => {
            const tr = document.createElement("tr");
            tr.classList.add("dept-row");
            tr.innerHTML = `
                <td>${dept.name}</td>
                <td>${dept.description}</td>
                <td>
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editDept(${dept.id})">Edit</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteDept(${dept.id})">Delete</button>
                </td>`;
            tbody.appendChild(tr);
        });

        refreshDeptDropdown();
    } catch (err) {
        console.error('Failed to load departments:', err);
    }
}

function toggleDeptForm(show, id = null) {
    document.getElementById("deptForm").classList.toggle("d-none", !show);
    if (show) {
        editDeptId = id;
        const dept = id !== null ? departments.find(d => d.id === id) : null;
        document.getElementById("deptFormTitle").textContent = id !== null ? "Edit Department" : "Add Department";
        document.getElementById("deptName").value = dept ? dept.name : "";
        document.getElementById("deptDescription").value = dept ? dept.description : "";
    }
}

async function saveDepartment() {
    const name = document.getElementById("deptName").value.trim();
    const description = document.getElementById("deptDescription").value.trim();
    if (!name) { alert("Department name is required."); return; }

    try {
        let res;
        if (editDeptId !== null) {
            res = await fetch(`http://localhost:3000/api/departments/${editDeptId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ name, description })
            });
        } else {
            res = await fetch('http://localhost:3000/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ name, description })
            });
        }

        const data = await res.json();
        if (res.ok) {
            renderDepts();
            toggleDeptForm(false);
        } else {
            alert(data.error || 'Failed to save department.');
        }
    } catch (err) {
        alert('Network error.');
    }
}

function editDept(id) {
    toggleDeptForm(true, id);
}

async function deleteDept(id) {
    if (confirm("Delete this department?")) {
        try {
            const res = await fetch(`http://localhost:3000/api/departments/${id}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (res.ok) {
                renderDepts();
            } else {
                alert(data.error || 'Failed to delete department.');
            }
        } catch (err) {
            alert('Network error.');
        }
    }
}

// ── Employees Data ─────────────────────────────────────────
let employees = [];
let editEmpIndex = null; // tracks edited employees, while null adds new employee

function saveEmps() {
    window.db.employees = employees;
    saveToStorage();
}

function refreshDeptDropdown() { // whenever a new dept is added, it appears in the dropdown
    const select = document.getElementById("empDept");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Select Department</option>';
    departments.forEach(dept => {
        const opt = document.createElement("option");
        opt.value = dept.name;
        opt.textContent = dept.name;
        if (dept.name === current) opt.selected = true;
        select.appendChild(opt);
    });
}

function renderEmployeesTable() {
    const tbody = document.getElementById("employeeTableBody");
    const noRow = document.getElementById("noEmployeesRow");
    tbody.querySelectorAll("tr.emp-row").forEach(r => r.remove()); // if employee exists, loop each one and create row

    if (employees.length === 0) {
        noRow.classList.remove("d-none");
        return;
    }
    noRow.classList.add("d-none");

    employees.forEach((emp, index) => {
        const tr = document.createElement("tr");
        tr.classList.add("emp-row");
        tr.innerHTML = `
            <td>${emp.id}</td>
            <td>${emp.email}</td>
            <td>${emp.position}</td>
            <td>${emp.dept}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm me-1" onclick="editEmp(${index})">Edit</button>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteEmp(${index})">Delete</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function toggleEmployeeForm(show, index = null) { // if null clears form, if not null pre-fill form with existing data
    document.getElementById("employeeForm").classList.toggle("d-none", !show);
    if (show) {
        editEmpIndex = index;
        refreshDeptDropdown();
        document.getElementById("employeeFormTitle").textContent =
            index !== null ? "Edit Employee" : "Add/Edit Employee";
        document.getElementById("empId").value = index !== null ? employees[index].id : "";
        document.getElementById("empEmail").value = index !== null ? employees[index].email : "";
        document.getElementById("empPosition").value = index !== null ? employees[index].position : "";
        document.getElementById("empDept").value = index !== null ? employees[index].dept : "";
        document.getElementById("empHireDate").value = index !== null ? employees[index].hireDate : "";
    }
}

function saveEmployee() {
    const id = document.getElementById("empId").value.trim();
    const email = document.getElementById("empEmail").value.trim();
    const position = document.getElementById("empPosition").value.trim();
    const dept = document.getElementById("empDept").value;
    const hireDate = document.getElementById("empHireDate").value;

    if (!id || !email || !position || !dept) {
        alert("ID, Email, Position and Department are required.");
        return;
    }

    // Email must match an existing account
    const accountExists = window.db.accounts.find(a => a.email === email);
    if (!accountExists) {
        alert("No account found with that email. Please use an existing account email.");
        return;
    }
    
    if (editEmpIndex !== null) {
        employees[editEmpIndex] = { id, email, position, dept, hireDate };
    } else {
        employees.push({ id, email, position, dept, hireDate });
    }

    saveEmps();
    renderEmployeesTable();
    toggleEmployeeForm(false);
}

function editEmp(index) {
    toggleEmployeeForm(true, index);
}

function deleteEmp(index) { // deletes an employee
    if (confirm("Delete this employee?")) {
        employees.splice(index, 1);
        saveEmps();
        renderEmployeesTable();
    }
}

// ── Accounts Data ──────────────────────────────────────────
let editAccIndex = null;

function saveAccounts() {
    saveToStorage();
}

async function renderAccountsList() {
    const tbody = document.getElementById("accountTableBody");
    const noRow = document.getElementById("noAccountsRow");
    tbody.querySelectorAll("tr.acc-row").forEach(r => r.remove());

    try {
        const res = await fetch('http://localhost:3000/api/users', {
            headers: getAuthHeader()
        });
        const data = await res.json();
        const accounts = data.users;

        if (accounts.length === 0) {
            noRow.classList.remove("d-none");
            return;
        }
        noRow.classList.add("d-none");

        accounts.forEach((acc) => {
            const tr = document.createElement("tr");
            tr.classList.add("acc-row");
            tr.innerHTML = `
                <td>${acc.firstName} ${acc.lastName}</td>
                <td>${acc.email}</td>
                <td>${acc.role.charAt(0).toUpperCase() + acc.role.slice(1)}</td>
                <td>${acc.verified ? '✅' : '❌'}</td>
                <td>
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editAcc('${acc.email}')">Edit</button>
                    <button class="btn btn-outline-warning btn-sm me-1" onclick="resetPassword('${acc.email}')">Reset Password</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteAcc('${acc.email}')">Delete</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed to load accounts:', err);
    }
}

async function toggleAccountForm(email = null) {
    const form = document.getElementById("accountForm");
    if (!email) {
        form.classList.remove("d-none");
        document.getElementById("accountFormTitle").textContent = "Add Account";
        document.getElementById("accFirstName").value = "";
        document.getElementById("accLastName").value = "";
        document.getElementById("accEmail").value = "";
        document.getElementById("accPassword").value = "";
        document.getElementById("accRole").value = "user";
        document.getElementById("accVerified").checked = false;
        return;
    }

    // Fetch user from backend to pre-fill
    try {
        const res = await fetch('http://localhost:3000/api/users', {
            headers: getAuthHeader()
        });
        const data = await res.json();
        const acc = data.users.find(u => u.email === email);
        if (acc) {
            form.classList.remove("d-none");
            document.getElementById("accountFormTitle").textContent = "Edit Account";
            document.getElementById("accFirstName").value = acc.firstName;
            document.getElementById("accLastName").value = acc.lastName;
            document.getElementById("accEmail").value = acc.email;
            document.getElementById("accPassword").value = "";
            document.getElementById("accRole").value = acc.role;
            document.getElementById("accVerified").checked = acc.verified;
        }
    } catch (err) {
        alert('Network error.');
    }
}

function closeAccountForm() {
    document.getElementById("accountForm").classList.add("d-none");
}

async function saveAccount() {
    const firstName = document.getElementById("accFirstName").value.trim();
    const lastName = document.getElementById("accLastName").value.trim();
    const email = document.getElementById("accEmail").value.trim();
    const password = document.getElementById("accPassword").value.trim();
    const role = document.getElementById("accRole").value;
    const verified = document.getElementById("accVerified").checked;

    if (!firstName || !lastName || !email) {
        alert("All fields are required.");
        return;
    }

    const isEditing = document.getElementById("accountFormTitle").textContent === "Edit Account";

    try {
        let res;
        if (isEditing) {
            // PATCH - edit existing user
            res = await fetch(`http://localhost:3000/api/users/${email}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ firstName, lastName, role, verified })
            });
        } else {
            // POST - create new user
            if (!password) { alert("Password is required."); return; }
            res = await fetch('http://localhost:3000/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ firstName, lastName, email, password, role, verified })
            });
        }

        const data = await res.json();

        if (res.ok) {
            renderAccountsList();
            toggleAccountForm(null);
            document.getElementById("accountForm").classList.add("d-none");
        } else {
            alert(data.error || 'Failed to save account.');
        }
    } catch (err) {
        alert('Network error.');
    }
}

function editAcc(email) {
    toggleAccountForm(email);
}

async function resetPassword(email) {
    const newPass = prompt("Enter new password for " + email + ":");
    if (newPass && newPass.trim() !== "") {
        if (newPass.trim().length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }
        try {
            const res = await fetch(`http://localhost:3000/api/users/${email}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ password: newPass.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                alert("✅ Password reset successfully.");
            } else {
                alert(data.error || 'Failed to reset password.');
            }
        } catch (err) {
            alert('Network error.');
        }
    }
}

async function deleteAcc(email) {
    if (email === currentUser.email) {
        alert("You cannot delete your own account while logged in.");
        return;
    }    

    if (confirm("Delete this account?")) {

        // Fix: checks if deleting the currently logged-in account (prevents deleting own acc)
        try {
            const res = await fetch(`http://localhost:3000/api/users/${email}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });

            const data = await res.json();

            if (res.ok) {
                renderAccountsList();
            } else {
                alert(data.error || 'Failed to delete account.');
            }
        } catch (err) {
            alert('Network error.');
        }
    }
}

// ── My Requests ────────────────────────────────────────────
let myRequests = [];

function getBadgeClass(status) {
    if (status === 'Approved') return 'bg-success';
    if (status === 'Rejected') return 'bg-danger';
    return 'bg-warning text-dark';  // Pending
}

function saveRequests() {
    window.db.myRequests = myRequests;
    saveToStorage();
}

function renderRequests() {
    const noMsg = document.getElementById("noRequestsMsg");
    const table = document.getElementById("requestsTable");
    const tbody = document.getElementById("requestsTableBody");
    tbody.innerHTML = "";

    const userRequests = myRequests.filter(req => req.employeeEmail === currentUser.email);

    if (userRequests.length === 0) { 
        noMsg.classList.remove("d-none");
        table.classList.add("d-none");
        return;
    }

    noMsg.classList.add("d-none");
    table.classList.remove("d-none");

    userRequests.forEach((req) => {
        const realIndex   = myRequests.indexOf(req);
        const itemsSummary = req.items.map(i => `${i.name} (x${i.qty})`).join(", ");
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${req.type}</td>
            <td>${itemsSummary}</td>
            <td>${req.date || '—'}</td>
            <td><span class="badge ${getBadgeClass(req.status)}">${req.status}</span></td>
            <td>
                <button class="btn btn-outline-danger btn-sm"
                        onclick="deleteRequest(${realIndex})">Delete</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function openRequestModal() {
    // Reset form
    document.getElementById("requestType").value = "Equipment";
    document.getElementById("requestItemsList").innerHTML = "";
    addRequestItem(); // start with one empty item row

    const modal = new bootstrap.Modal(document.getElementById("requestModal"));
    modal.show();
}

function addRequestItem() {
    const list = document.getElementById("requestItemsList");
    const isFirst = list.querySelectorAll(".item-row").length === 0;
    const row = document.createElement("div");
    row.classList.add("d-flex", "gap-2", "mb-2", "item-row");

    if (isFirst) {
        row.innerHTML = `
            <input type="text" class="form-control form-control-sm" placeholder="Item name">
            <input type="number" class="form-control form-control-sm" value="1" min="1" style="max-width:70px">
            <button type="button" class="btn btn-outline-secondary btn-sm"
                    onclick="addRequestItem()">+</button>`;
    } else {
        row.innerHTML = `
            <input type="text" class="form-control form-control-sm" placeholder="Item name">
            <input type="number" class="form-control form-control-sm" value="1" min="1" style="max-width:70px">
            <button type="button" class="btn btn-outline-danger btn-sm"
                    onclick="this.closest('.item-row').remove()">×</button>`;
    }

    list.appendChild(row);
}

function submitRequest() {
    const type = document.getElementById("requestType").value;
    const itemRows = document.querySelectorAll("#requestItemsList .item-row");
    const items = [];

    itemRows.forEach(row => {
        const inputs = row.querySelectorAll("input");
        const name = inputs[0].value.trim();
        const qty = inputs[1].value || 1;
        if (name) items.push({ name, qty });
    });

    if (items.length === 0) {
        alert("Please add at least one item.");
        return;
    }

    myRequests.push({
        type,
        items,
        status        : "Pending",
        date          : new Date().toLocaleDateString(),
        employeeEmail : currentUser.email
    });
    saveRequests();
    renderRequests();

    // Close form
    bootstrap.Modal.getInstance(document.getElementById("requestModal")).hide();
}

function deleteRequest(index) {
    if (confirm("Delete this request?")) {
        myRequests.splice(index, 1);
        saveRequests();
        renderRequests();
    }
}

// ── Init ───────────────────────────────────────────────────
loadFromStorage();

// Sync local arrays from window.db after loading
employees   = window.db.employees;
myRequests  = window.db.myRequests;

async function initAuth() {
    const savedToken = sessionStorage.getItem("authToken");
    if (savedToken) {
        try {
            const res = await fetch('http://localhost:3000/api/profile', {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const data = await res.json();
                setAuthState(true, data.user);
            } else {
                sessionStorage.removeItem('authToken');
                setAuthState(false);
            }
        } catch (err) {
            sessionStorage.removeItem('authToken');
            setAuthState(false);
        }
    } else {
        setAuthState(false);
    }
}

initAuth();