const axios = require('axios');
const moment = require('moment');

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Company office location (starting point)
const OFFICE_LOCATION = process.env.OFFICE_LOCATION || '123 Main St, Anytown, USA';

// Travel buffer time in minutes (extra time added to travel estimates)
const TRAVEL_BUFFER_MINUTES = 15;

exports.analyzeRoute = async (newAppointmentAddress, existingAppointments) => {
  try {
    // Get geocoded locations for all addresses
    const locations = await getGeocodedLocations([
      OFFICE_LOCATION,
      newAppointmentAddress,
      ...existingAppointments.map(appointment => appointment.location)
    ]);
    
    // Calculate travel times between locations
    const travelTimes = await calculateTravelTimes(locations);
    
    // Analyze existing route
    const existingRoute = optimizeRoute(
      locations[0], // Office as starting point
      existingAppointments.map((appointment, index) => ({
        location: locations[index + 2], // +2 because office and new appointment are first
        startTime: appointment.start,
        endTime: appointment.end
      }))
    );
    
    // Find available time slots that work with the route
    const availableTimeSlots = findAvailableTimeSlots(
      existingRoute,
      locations[1], // New appointment location
      travelTimes
    );
    
    // Generate suggested alternatives if needed
    const suggestedAlternatives = generateAlternatives(availableTimeSlots);
    
    return {
      availableTimeSlots,
      suggestedAlternatives,
      estimatedTravelTime: travelTimes
    };
  } catch (error) {
    console.error('Error analyzing route:', error);
    
    // For demo purposes, return mock data
    return {
      availableTimeSlots: [
        {
          start: moment().add(1, 'day').hour(9).minute(0).second(0).toISOString(),
          end: moment().add(1, 'day').hour(12).minute(0).second(0).toISOString()
        },
        {
          start: moment().add(1, 'day').hour(14).minute(0).second(0).toISOString(),
          end: moment().add(1, 'day').hour(17).minute(0).second(0).toISOString()
        }
      ],
      suggestedAlternatives: [
        {
          date: moment().add(1, 'day').format('YYYY-MM-DD'),
          time: '09:00'
        },
        {
          date: moment().add(1, 'day').format('YYYY-MM-DD'),
          time: '14:00'
        }
      ],
      estimatedTravelTime: 30 // minutes
    };
  }
};

// Helper function to geocode addresses
async function getGeocodedLocations(addresses) {
  try {
    const geocodedLocations = [];
    
    for (const address of addresses) {
      // In production, use Google Maps Geocoding API
      // For demo, return mock coordinates
      geocodedLocations.push({
        address,
        lat: Math.random() * 0.1 + 40.7, // Mock coordinates around NYC
        lng: Math.random() * 0.1 - 74.0
      });
    }
    
    return geocodedLocations;
  } catch (error) {
    console.error('Error geocoding addresses:', error);
    throw new Error('Failed to geocode addresses');
  }
}

// Helper function to calculate travel times between locations
async function calculateTravelTimes(locations) {
  try {
    // In production, use Google Maps Distance Matrix API
    // For demo, return mock travel times
    const travelTimes = {};
    
    for (let i = 0; i < locations.length; i++) {
      for (let j = 0; j < locations.length; j++) {
        if (i !== j) {
          const key = `${i}-${j}`;
          // Generate a random travel time between 15-60 minutes
          travelTimes[key] = Math.floor(Math.random() * 45) + 15;
        }
      }
    }
    
    return travelTimes;
  } catch (error) {
    console.error('Error calculating travel times:', error);
    throw new Error('Failed to calculate travel times');
  }
}

// Helper function to optimize the route
function optimizeRoute(startLocation, appointments) {
  try {
    // Sort appointments by start time
    const sortedAppointments = [...appointments].sort((a, b) => 
      moment(a.startTime).valueOf() - moment(b.startTime).valueOf()
    );
    
    // Create the route
    const route = {
      startLocation,
      appointments: sortedAppointments,
      totalTravelTime: 0 // Will be calculated based on actual travel times
    };
    
    return route;
  } catch (error) {
    console.error('Error optimizing route:', error);
    throw new Error('Failed to optimize route');
  }
}

// Helper function to find available time slots
function findAvailableTimeSlots(existingRoute, newLocation, travelTimes) {
  try {
    // For demo purposes, return some mock time slots
    // In production, this would analyze the existing route and find gaps
    
    // Get the current date
    const today = moment().startOf('day');
    
    // Generate time slots for the next 7 days
    const availableTimeSlots = [];
    
    for (let day = 1; day <= 7; day++) {
      const date = moment(today).add(day, 'days');
      
      // Morning slot
      availableTimeSlots.push({
        start: moment(date).hour(9).minute(0).second(0).toISOString(),
        end: moment(date).hour(12).minute(0).second(0).toISOString()
      });
      
      // Afternoon slot
      availableTimeSlots.push({
        start: moment(date).hour(14).minute(0).second(0).toISOString(),
        end: moment(date).hour(17).minute(0).second(0).toISOString()
      });
    }
    
    return availableTimeSlots;
  } catch (error) {
    console.error('Error finding available time slots:', error);
    throw new Error('Failed to find available time slots');
  }
}

// Helper function to generate alternative time suggestions
function generateAlternatives(availableTimeSlots) {
  try {
    // Convert available time slots to date/time format
    const alternatives = availableTimeSlots.slice(0, 5).map(slot => {
      const startTime = moment(slot.start);
      return {
        date: startTime.format('YYYY-MM-DD'),
        time: startTime.format('HH:mm')
      };
    });
    
    return alternatives;
  } catch (error) {
    console.error('Error generating alternatives:', error);
    throw new Error('Failed to generate alternatives');
  }
}

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}