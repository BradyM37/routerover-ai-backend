const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Book an appointment
router.post('/book-appointment', appointmentController.bookAppointment);

// Get appointments for a specific day
router.get('/appointments', appointmentController.getAppointments);

// Chat endpoint for conversational booking
router.post('/chat', appointmentController.chatHandler);

module.exports = router;