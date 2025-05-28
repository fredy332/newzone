// Base URL for API requests
const API_BASE_URL = 'http://localhost:3000/api';

// Global variables
let currentUser = null;
let sortDirection = 'asc';
let currentSortField = 'date';

// Password pattern: 8+ chars, with uppercase, lowercase, number, and special char
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').min = today;
    document.getElementById('editDate').min = today;
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
        const user = JSON.parse(rememberedUser);
        document.getElementById('loginId').value = user.id;
        document.getElementById('loginPassword').value = user.password;
        document.getElementById('rememberMe').checked = true;
    }
    const loggedInUser = sessionStorage.getItem('currentUser');
    if (loggedInUser) {
        currentUser = JSON.parse(loggedInUser);
        showDashboard();
    }
});

// Toggle forms
function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Login
async function login() {
    console.log('Login function called');
    const id = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    if (!id || !password) {
        document.getElementById('loginError').textContent = 'Please enter both Lecturer ID and password';
        console.error('Validation failed: Missing ID or password');
        return;
    }
    document.getElementById('loginError').textContent = '';
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }),
        });
        console.log('Login response status:', response.status);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Login failed');
        }
        const data = await response.json();
        currentUser = data.user;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        if (rememberMe) {
            localStorage.setItem('rememberedUser', JSON.stringify({ id, password }));
        } else {
            localStorage.removeItem('rememberedUser');
        }
        showDashboard();
    } catch (error) {
        console.error('Login error:', error.message);
        document.getElementById('loginError').textContent = error.message || 'Invalid Lecturer ID or password';
    }
}

// Register
async function register() {
    console.log('Register function called');
    const title = document.getElementById('regTitle').value;
    const name = document.getElementById('regName').value.trim();
    const idNumber = document.getElementById('idnumber').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const department = document.getElementById('regDepartment').value.trim();
    const password = document.getElementById('regPassword').value;
    const registerButton = document.getElementById('registerButton');
    if (!title || !name || !idNumber || !email || !phone || !department || !password) {
        document.getElementById('regError').textContent = 'Please fill in all fields';
        console.error('Validation failed: Missing fields');
        return;
    }
    const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailPattern.test(email)) {
        document.getElementById('regError').textContent = 'Please enter a valid email address';
        console.error('Validation failed: Invalid email format');
        return;
    }
    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
        document.getElementById('regError').textContent = 'Phone number must be 10 digits';
        console.error('Validation failed: Invalid phone number');
        return;
    }
    if (!passwordPattern.test(password)) {
        document.getElementById('regError').textContent = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
        console.error('Validation failed: Weak password');
        return;
    }
    document.getElementById('regError').textContent = '';
    document.getElementById('regSuccess').textContent = '';
    registerButton.disabled = true;
    console.log('Sending registration request:', { title, name, id: idNumber, email, phone, department });
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, name, id: idNumber, email, phone, department, password }),
        });
        console.log('Registration response status:', response.status);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Registration failed');
        }
        const data = await response.json();
        console.log('Registration successful:', data);
        document.getElementById('regSuccess').textContent = 'Registration successful! You can now login.';
        document.getElementById('registerFormElement').reset();
        setTimeout(() => {
            showLogin();
            document.getElementById('regSuccess').textContent = '';
        }, 2000);
    } catch (error) {
        console.error('Registration error:', error.message);
        document.getElementById('regError').textContent = error.message || 'Registration failed. Please try again.';
    } finally {
        registerButton.disabled = false;
    }
}

// Dashboard
function showDashboard() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('bookingForm').style.display = 'none';
    document.getElementById('editBookingForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('welcomeMessage').textContent = `Welcome, ${currentUser.title} ${currentUser.name}`;
    document.getElementById('adminButton').style.display = currentUser.is_admin ? 'inline-block' : 'none';
    loadDashboard();
}

async function loadDashboard() {
    const filter = document.getElementById('bookingFilter').value;
    try {
        const response = await fetch(`${API_BASE_URL}/bookings?filter=${filter}`, {
            headers: { 'Authorization': `Bearer ${currentUser.id}` },
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to fetch bookings');
        }
        const data = await response.json();
        displayBookings(data.bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error.message);
        alert('Failed to load bookings. Please try again.');
    }
}

function displayBookings(bookings) {
    const bookingList = document.getElementById('bookingList');
    bookingList.innerHTML = '';
    if (bookings.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5">No bookings found</td>';
        bookingList.appendChild(row);
        return;
    }
    bookings.sort((a, b) => {
        let comparison = 0;
        if (currentSortField === 'venue_name') {
            comparison = a.venue_name.localeCompare(b.venue_name);
        } else if (currentSortField === 'block') {
            comparison = a.block.localeCompare(b.block);
        } else if (currentSortField === 'date') {
            comparison = new Date(a.date) - new Date(b.date);
        } else if (currentSortField === 'time_interval') {
            comparison = a.time_interval.localeCompare(b.time_interval);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
    });
    bookings.forEach((booking) => {
        const row = document.createElement('tr');
        const bookingDate = new Date(booking.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = bookingDate < today;
        const timeEnd = booking.time_interval.split('-')[1];
        const [hours, minutes] = timeEnd.split(':');
        const bookingEndTime = new Date(booking.date);
        bookingEndTime.setHours(hours, minutes, 0, 0);
        const isPastTime = bookingEndTime < new Date();
        const isEditable = !(isPast || isPastTime);
        row.innerHTML = `
            <td>${booking.venue_name}</td>
            <td>${booking.block}</td>
            <td>${new Date(booking.date).toLocaleDateString()}</td>
            <td>${booking.time_interval}</td>
            <td>
                ${isEditable ?
                    `<button onclick="editBooking(${booking.id})">Edit</button>
                     <button onclick="cancelBooking(${booking.id})">Cancel</button>` :
                    '<span>Completed</span>'
                }
            </td>
        `;
        bookingList.appendChild(row);
    });
}

function sortBookings(field) {
    if (currentSortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        sortDirection = 'asc';
    }
    loadDashboard();
}

function showBooking() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bookingForm').style.display = 'block';
    document.getElementById('block').value = '';
    document.getElementById('venue').value = '';
    document.getElementById('date').value = '';
    document.getElementById('timeInterval').value = '';
    document.getElementById('bookingError').textContent = '';
    document.getElementById('bookingSuccess').textContent = '';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').min = today;
}

async function loadVenues() {
    const block = document.getElementById('block').value;
    if (!block) return;
    try {
        const response = await fetch(`${API_BASE_URL}/venues?block=${block}`);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to fetch venues');
        }
        const data = await response.json();
        const venueSelect = document.getElementById('venue');
        venueSelect.innerHTML = '<option value="">Select Venue</option>';
        data.venues.forEach((venue) => {
            const option = document.createElement('option');
            option.value = venue.id;
            option.textContent = venue.name;
            venueSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading venues:', error.message);
        alert('Failed to load venues. Please try again.');
    }
}

async function loadEditVenues() {
    const block = document.getElementById('editBlock').value;
    if (!block) return;
    try {
        const response = await fetch(`${API_BASE_URL}/venues?block=${block}`);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to fetch venues');
        }
        const data = await response.json();
        const venueSelect = document.getElementById('editVenue');
        venueSelect.innerHTML = '<option value="">Select Venue</option>';
        data.venues.forEach((venue) => {
            const option = document.createElement('option');
            option.value = venue.id;
            option.textContent = venue.name;
            venueSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading venues:', error.message);
        alert('Failed to load venues. Please try again.');
    }
}

async function bookVenue() {
    const venueId = document.getElementById('venue').value;
    const date = document.getElementById('date').value;
    const timeInterval = document.getElementById('timeInterval').value;
    if (!venueId || !date || !timeInterval) {
        document.getElementById('bookingError').textContent = 'Please fill in all fields';
        return;
    }
    document.getElementById('bookingError').textContent = '';
    document.getElementById('bookingSuccess').textContent = '';
    try {
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.id}`,
            },
            body: JSON.stringify({ venue_id: venueId, date, time_interval: timeInterval }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Booking failed');
        }
        document.getElementById('bookingSuccess').textContent = 'Booking created successfully';
        setTimeout(() => {
            showDashboard();
        }, 2000);
    } catch (error) {
        console.error('Error creating booking:', error.message);
        document.getElementById('bookingError').textContent = error.message || 'Booking failed. Please try again.';
    }
}

async function editBooking(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${id}`, {
            headers: { 'Authorization': `Bearer ${currentUser.id}` },
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to fetch booking');
        }
        const data = await response.json();
        const booking = data.booking;
        document.getElementById('editBookingId').value = booking.id;
        document.getElementById('editBlock').value = booking.block;
        document.getElementById('editDate').value = booking.date;
        document.getElementById('editTimeInterval').value = booking.time_interval;
        await loadEditVenues();
        setTimeout(() => {
            document.getElementById('editVenue').value = booking.venue_id;
        }, 100);
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('editBookingForm').style.display = 'block';
    } catch (error) {
        console.error('Error fetching booking:', error.message);
        alert('Failed to load booking. Please try again.');
    }
}

async function updateBooking() {
    const bookingId = document.getElementById('editBookingId').value;
    const venueId = document.getElementById('editVenue').value;
    const date = document.getElementById('editDate').value;
    const timeInterval = document.getElementById('editTimeInterval').value;
    if (!venueId || !date || !timeInterval) {
        document.getElementById('editBookingError').textContent = 'Please fill in all fields';
        return;
    }
    document.getElementById('editBookingError').textContent = '';
    document.getElementById('editBookingSuccess').textContent = '';
    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.id}`,
            },
            body: JSON.stringify({ venue_id: venueId, date, time_interval: timeInterval }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to update booking');
        }
        document.getElementById('editBookingSuccess').textContent = 'Booking updated successfully';
        setTimeout(() => {
            showDashboard();
        }, 2000);
    } catch (error) {
        console.error('Error updating booking:', error.message);
        document.getElementById('editBookingError').textContent = error.message || 'Failed to update booking. Please try again.';
    }
}

async function cancelBooking(id) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentUser.id}` },
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to delete booking');
        }
        alert('Booking deleted successfully!');
        loadDashboard();
    } catch (error) {
        console.error('Error deleting booking:', error.message);
        alert('Failed to delete booking. Please try again.');
    }
}

async function showAdminPanel() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    await loadAdminPanel();
}

async function loadAdminPanel() {
    try {
        const lecturerResponse = await fetch(`${API_BASE_URL}/lecturers`, {
            headers: { 'Authorization': `Bearer ${currentUser.id}` },
        });
        if (!lecturerResponse.ok) {
            const data = await lecturerResponse.json();
            throw new Error(data.message || 'Failed to fetch lecturers');
        }
        const lecturerData = await lecturerResponse.json();
        const lecturerList = document.getElementById('lecturerList');
        lecturerList.innerHTML = '';
        lecturerData.lecturers.forEach(lecturer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${lecturer.id}</td>
                <td>${lecturer.title}</td>
                <td>${lecturer.name}</td>
                <td>${lecturer.email}</td>
                <td>${lecturer.phone}</td>
                <td>${lecturer.department}</td>
                <td>${new Date(lecturer.created_at).toLocaleDateString()}</td>
            `;
            lecturerList.appendChild(row);
        });

        const bookingsResponse = await fetch(`${API_BASE_URL}/bookings/all`, {
            headers: { 'Authorization': `Bearer ${currentUser.id}` },
        });
        if (!bookingsResponse.ok) {
            const data = await bookingsResponse.json();
            throw new Error(data.message || 'Failed to fetch bookings');
        }
        const bookingsData = await bookingsResponse.json();
        const allBookingsList = document.getElementById('allBookingsList');
        allBookingsList.innerHTML = '';
        bookingsData.bookings.forEach(booking => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${booking.venue_name}</td>
                <td>${booking.lecturer_name}</td>
                <td>${new Date(booking.date).toLocaleDateString()}</td>
                <td>${booking.time_interval}</td>
            `;
            allBookingsList.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading admin panel:', error.message);
        alert('Failed to load admin panel. Please try again.');
    }
}

function logout() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('rememberedUser');
    currentUser = null;
    showLogin();
}