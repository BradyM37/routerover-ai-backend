const { google } = require('googleapis');
const moment = require('moment');

// Configure Google Calendar API
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/calendar']
});

// Calendar ID for your appointments
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

// Service duration in minutes
const SERVICE_DURATIONS = {
  cleaning: 120, // 2 hours
  repair: 90,    // 1.5 hours
  plumbing: 60,  // 1 hour
  electrical: 60, // 1 hour
  landscaping: 180 // 3 hours
};

// Default service duration if not specified
const DEFAULT_DURATION = 60; // 1 hour

// Business hours
const BUSINESS_HOURS = {
  start: 9, // 9 AM
  end: 17   // 5 PM
};

exports.getAppointmentsForDay = async (date) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: await auth.getClient() });
    
    const startDate = moment(date).startOf('day').toISOString();
    const endDate = moment(date).endOf('day').toISOString();
    
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    return response.data.items.map(event => ({
      id: event.id,
      summary: event.summary,
      location: event.location,
      start: event.start.dateTime,
      end: event.end.dateTime,
      status: event.status
    }));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    // For development/demo purposes, return mock data if calendar API fails
    return [];
  }
};

exports.findBestTimeSlot = async (timePreferences, routeAnalysis) => {
  try {
    // Sort time preferences by priority (assuming first is most preferred)
    for (const preference of timePreferences) {
      const { date, time } = preference;
      const preferredDateTime = moment(`${date}T${time}`);
      
      // Check if this time works with the route analysis
      const isTimeSlotAvailable = routeAnalysis.availableTimeSlots.some(slot => {
        const slotStart = moment(slot.start);
        const slotEnd = moment(slot.end);
        return preferredDateTime.isBetween(slotStart, slotEnd, null, '[)');
      });
      
      if (isTimeSlotAvailable) {
        return { date, time };
      }
    }
    
    // If no preferred time works, return the first available time slot
    if (routeAnalysis.availableTimeSlots.length > 0) {
      const firstAvailable = routeAnalysis.availableTimeSlots[0];
      const date = moment(firstAvailable.start).format('YYYY-MM-DD');
      const time = moment(firstAvailable.start).format('HH:mm');
      return { date, time };
    }
    
    return null; // No suitable time slot found
  } catch (error) {
    console.error('Error finding best time slot:', error);
    throw new Error('Failed to find a suitable time slot');
  }
};

exports.createAppointment = async (appointmentData) => {
  try {
    const { name, address, service, date, time, notes } = appointmentData;
    
    // Calculate duration based on service type
    const durationMinutes = SERVICE_DURATIONS[service] || DEFAULT_DURATION;
    
    // Create event start and end times
    const startDateTime = moment(`${date}T${time}`);
    const endDateTime = moment(startDateTime).add(durationMinutes, 'minutes');
    
    const calendar = google.calendar({ version: 'v3', auth: await auth.getClient() });
    
    // Create the event
    const event = {
      summary: `${service.charAt(0).toUpperCase() + service.slice(1)} - ${name}`,
      location: address,
      description: notes,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/New_York'
      }
    };
    
    // For development/demo purposes, skip actual calendar creation
    // In production, uncomment the following code:
    /*
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event
    });
    
    return {
      id: response.data.id,
      summary: response.data.summary,
      location: response.data.location,
      start: response.data.start.dateTime,
      end: response.data.end.dateTime,
      status: response.data.status
    };
    */
    
    // For demo purposes, return a mock response
    const mockId = `appointment-${Date.now()}`;
    return {
      id: mockId,
      summary: event.summary,
      location: event.location,
      start: event.start.dateTime,
      end: event.end.dateTime,
      status: 'confirmed',
      notes: notes
    };
  } catch (error) {
    console.error('Error creating appointment:', error);
    throw new Error('Failed to create appointment');
  }
};

// Get available time slots for a specific day
exports.getAvailableTimeSlots = async (date, existingAppointments) => {
  try {
    const dayStart = moment(date).hour(BUSINESS_HOURS.start).minute(0).second(0);
    const dayEnd = moment(date).hour(BUSINESS_HOURS.end).minute(0).second(0);
    
    // Start with the full day as available
    const availableSlots = [
      {
        start: dayStart.toISOString(),
        end: dayEnd.toISOString()
      }
    ];
    
    // Remove time slots that are already booked
    for (const appointment of existingAppointments) {
      const appointmentStart = moment(appointment.start);
      const appointmentEnd = moment(appointment.end);
      
      // Find slots that overlap with this appointment
      for (let i = 0; i < availableSlots.length; i++) {
        const slot = availableSlots[i];
        const slotStart = moment(slot.start);
        const slotEnd = moment(slot.end);
        
        // Check if appointment overlaps with this slot
        if (appointmentStart.isBefore(slotEnd) && appointmentEnd.isAfter(slotStart)) {
          // Remove this slot and add new slots before and after the appointment if needed
          availableSlots.splice(i, 1);
          
          // Add slot before appointment if there's time
          if (appointmentStart.isAfter(slotStart)) {
            availableSlots.push({
              start: slotStart.toISOString(),
              end: appointmentStart.toISOString()
            });
          }
          
          // Add slot after appointment if there's time
          if (appointmentEnd.isBefore(slotEnd)) {
            availableSlots.push({
              start: appointmentEnd.toISOString(),
              end: slotEnd.toISOString()
            });
          }
          
          // Since we modified the array, we need to adjust the index
          i--;
        }
      }
    }
    
    return availableSlots;
  } catch (error) {
    console.error('Error getting available time slots:', error);
    throw new Error('Failed to get available time slots');
  }
};