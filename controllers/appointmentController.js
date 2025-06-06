const calendarService = require('../services/calendarService');
const routeService = require('../services/routeService');
const aiService = require('../services/aiService');

exports.bookAppointment = async (req, res) => {
  try {
    const { name, address, service, date, time, notes } = req.body;
    
    if (!name || !address || !service || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Format time preferences
    const timePreferences = [
      { date, time }
    ];
    
    // Add alternative time if provided
    if (req.body['alt-date'] && req.body['alt-time']) {
      timePreferences.push({
        date: req.body['alt-date'],
        time: req.body['alt-time']
      });
    }
    
    // 1. Check existing appointments
    const existingAppointments = await calendarService.getAppointmentsForDay(date);
    
    // 2. Check route feasibility
    const routeAnalysis = await routeService.analyzeRoute(address, existingAppointments);
    
    // 3. Find the best time slot
    const bestTimeSlot = await calendarService.findBestTimeSlot(timePreferences, routeAnalysis);
    
    if (!bestTimeSlot) {
      // No suitable time slot found
      return res.status(409).json({ 
        error: 'No suitable time slot available',
        suggestedAlternatives: routeAnalysis.suggestedAlternatives
      });
    }
    
    // 4. Book the appointment
    const appointment = await calendarService.createAppointment({
      name,
      address,
      service,
      date: bestTimeSlot.date,
      time: bestTimeSlot.time,
      notes: notes || ''
    });
    
    // 5. Return the booked appointment details
    return res.status(201).json(appointment);
  } catch (error) {
    console.error('Error booking appointment:', error);
    return res.status(500).json({ error: 'Failed to book appointment' });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    
    const appointments = await calendarService.getAppointmentsForDay(date);
    return res.status(200).json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

exports.chatHandler = async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Process the message with AI
    const aiResponse = await aiService.processMessage(message);
    
    // Check if the AI detected an appointment booking intent
    if (aiResponse.intent === 'book_appointment' && aiResponse.extractedData) {
      const { name, address, service, timePreferences } = aiResponse.extractedData;
      
      // Try to book the appointment
      const existingAppointments = await calendarService.getAppointmentsForDay(timePreferences[0].date);
      const routeAnalysis = await routeService.analyzeRoute(address, existingAppointments);
      const bestTimeSlot = await calendarService.findBestTimeSlot(timePreferences, routeAnalysis);
      
      if (bestTimeSlot) {
        // Book the appointment
        const appointment = await calendarService.createAppointment({
          name,
          address,
          service,
          date: bestTimeSlot.date,
          time: bestTimeSlot.time,
          notes: aiResponse.extractedData.notes || ''
        });
        
        return res.status(200).json({
          response: aiResponse.response,
          appointmentBooked: true,
          appointmentDetails: appointment
        });
      } else {
        // No suitable time slot
        return res.status(200).json({
          response: `I couldn't find a suitable time slot for ${timePreferences[0].date} at ${timePreferences[0].time}. Would you like to try a different time?`,
          appointmentBooked: false,
          suggestedAlternatives: routeAnalysis.suggestedAlternatives
        });
      }
    }
    
    // Regular chat response
    return res.status(200).json({
      response: aiResponse.response,
      appointmentBooked: false
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
};