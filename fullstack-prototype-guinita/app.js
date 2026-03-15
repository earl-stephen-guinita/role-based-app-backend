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
            window.db.accounts = parsed.accounts || [];
            window.db.departments = parsed.departments || [];
            window.db.employees = parsed.employees || [];
            window.db.myRequests = parsed.myRequests || [];
        } else {
            // No data yet — seed with defaults
            window.db.accounts = [
                {
                    firstName: 'Admin',
                    lastName: 'User',
                    email: 'admin@example.com',
                    password: 'Password123!',
                    role: 'admin',
                    verified: true
                }
            ];
            window.db.departments = [
                { name: 'Engineering', description: 'Software team' },
                { name: 'HR', description: 'Human Resources' }
            ];
            window.db.employees = [];
            window.db.myRequests = [];
            saveToStorage();
        }
    } catch (e) {
        // Corrupt data — reset to defaults
        window.db.accounts = [
            {
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                password: 'Password123!',
                role: 'admin',
                verified: true
            }
        ];
        window.db.departments = [
            { name: 'Engineering', description: 'Engineering department' },
            { name: 'HR', description: 'Human Resources department' }
        ];
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
    localStorage.removeItem("auth_token");
    setAuthState(false);
    navigateTo('#/');
});

// ── Auth Header ────────────────────────────────────────────
function getAuthHeader() {
    const token = sessionStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Register Form ──────────────────────────────────────────
document.getElementById("registerForm").addEventListener("submit", function (e) {
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

    // Check duplicate first
    const exists = window.db.accounts.find(a => a.email === email);
    if (exists) {
        alert("Email already registered.");
        return;
    }
    // Save to accounts array
    window.db.accounts.push({ firstName, lastName, email, password, role: "admin", verified: false });
    saveToStorage();
    // Store just the email for verification step
    localStorage.setItem("unverified_email", email);

    form.classList.remove("was-validated");
    form.reset();
    document.getElementById("verifyEmailDisplay").textContent = email;
    navigateTo('#/verify');
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
let departments = [];
let editDeptIndex = null; // tracks edited departments, while null adds new department

function saveDepts() {
    window.db.departments = departments;
    saveToStorage();
}

function renderDepts() {
    const tbody = document.getElementById("deptTableBody");
    const noRow = document.getElementById("noDeptsRow");
    // Clear existing rows except the "no depts" row
    tbody.querySelectorAll("tr.dept-row").forEach(r => r.remove()); // if dept exists, loop each one and create row

    if (departments.length === 0) {
        noRow.classList.remove("d-none");
        return;
    }
    noRow.classList.add("d-none");

    departments.forEach((dept, index) => {
        const tr = document.createElement("tr");
        tr.classList.add("dept-row");
        tr.innerHTML = `
            <td>${dept.name}</td>
            <td>${dept.description}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm me-1" onclick="editDept(${index})">Edit</button>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteDept(${index})">Delete</button>
            </td>`;
        tbody.appendChild(tr);
    });

    // Also refresh the dept dropdown in the employee form
    refreshDeptDropdown();
}

function toggleDeptForm(show, index = null) { // if null clears form, if not null pre-fill form with existing data
    document.getElementById("deptForm").classList.toggle("d-none", !show);
    if (show) {
        editDeptIndex = index;
        document.getElementById("deptFormTitle").textContent =
            index !== null ? "Edit Department" : "Add Department";
        document.getElementById("deptName").value =
            index !== null ? departments[index].name : "";
        document.getElementById("deptDescription").value =
            index !== null ? departments[index].description : "";
    }
}

function saveDepartment() {
    const name = document.getElementById("deptName").value.trim();
    const description = document.getElementById("deptDescription").value.trim();
    if (!name) { alert("Department name is required."); return; }

    if (editDeptIndex !== null) {
        departments[editDeptIndex] = { name, description };
    } else {
        departments.push({ name, description });
    }

    saveDepts();
    renderDepts();
    toggleDeptForm(false);
}

function editDept(index) {
    toggleDeptForm(true, index);
}

function deleteDept(index) { // deletes a department
    if (confirm("Delete this department?")) {
        departments.splice(index, 1);
        saveDepts();
        renderDepts();
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
    select.innerHTML = '<option value="">--Select Department--</option>';
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

function renderAccountsList() {
    const tbody = document.getElementById("accountTableBody");
    const noRow = document.getElementById("noAccountsRow");
    tbody.querySelectorAll("tr.acc-row").forEach(r => r.remove());

    if (window.db.accounts.length === 0) {
        noRow.classList.remove("d-none");
        return;
    }
    noRow.classList.add("d-none");

    window.db.accounts.forEach((acc, index) => {
        const tr = document.createElement("tr");
        tr.classList.add("acc-row");
        tr.innerHTML = `
            <td>${acc.firstName} ${acc.lastName}</td>
            <td>${acc.email}</td>
            <td>${acc.role.charAt(0).toUpperCase() + acc.role.slice(1)}</td>
            <td>${acc.verified ? '✅' : '❌'}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm me-1" onclick="editAcc(${index})">Edit</button>
                <button class="btn btn-outline-warning btn-sm me-1" onclick="resetPassword(${index})">Reset Password</button>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteAcc(${index})">Delete</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function toggleAccountForm(show, index = null) {
    document.getElementById("accountForm").classList.toggle("d-none", !show);
    if (show) {
        editAccIndex = index;
        document.getElementById("accountFormTitle").textContent =
            index !== null ? "Edit Account" : "Add/Edit Account";
        document.getElementById("accFirstName").value = index !== null ? window.db.accounts[index].firstName : "";
        document.getElementById("accLastName").value = index !== null ? window.db.accounts[index].lastName : "";
        document.getElementById("accEmail").value = index !== null ? window.db.accounts[index].email : "";
        document.getElementById("accPassword").value = index !== null ? window.db.accounts[index].password : "";
        document.getElementById("accRole").value = index !== null ? window.db.accounts[index].role : "user";
        document.getElementById("accVerified").checked = index !== null ? window.db.accounts[index].verified : false;
    }
}

function saveAccount() {
    const firstName = document.getElementById("accFirstName").value.trim();
    const lastName = document.getElementById("accLastName").value.trim();
    const email = document.getElementById("accEmail").value.trim();
    const password = document.getElementById("accPassword").value.trim();
    const role = document.getElementById("accRole").value;
    const verified = document.getElementById("accVerified").checked;

    if (!firstName || !lastName || !email || !password) {
        alert("All fields are required.");
        return;
    }

    if (editAccIndex !== null) {
        window.db.accounts[editAccIndex] = { firstName, lastName, email, password, role, verified };
    } else {
        window.db.accounts.push({ firstName, lastName, email, password, role, verified });
    }

    saveAccounts();
    renderAccountsList();
    toggleAccountForm(false);
}

function editAcc(index) {
    toggleAccountForm(true, index);
}

function resetPassword(index) {
    const newPass = prompt("Enter new password for " + window.db.accounts[index].firstName + ":");
    if (newPass && newPass.trim() !== "") {
        if (newPass.trim().length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }        
        window.db.accounts[index].password = newPass.trim();
        saveAccounts();
        alert("✅ Password reset successfully.");
    }
}

function deleteAcc(index) {
    if (confirm("Delete this account?")) {

        // Fix: checks if deleting the currently logged-in account (prevents deleting own acc)
        if (window.db.accounts[index].email === currentUser.email) {
            alert("You cannot delete your own account while logged in.");
            return;
        }

        window.db.accounts.splice(index, 1);
        saveAccounts();
        renderAccountsList();
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
departments = window.db.departments;
employees   = window.db.employees;
myRequests  = window.db.myRequests;

const savedToken = sessionStorage.getItem("auth_token");
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