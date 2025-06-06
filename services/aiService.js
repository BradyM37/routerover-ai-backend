const axios = require('axios');
const moment = require('moment');

// OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// System prompt that defines the AI assistant's behavior
const SYSTEM_PROMPT = `
You are RouteRover AI, an intelligent assistant for a service company that offers home cleaning, repairs, plumbing, electrical work, and landscaping.
Your job is to help customers book appointments and answer questions about services.

When a customer wants to book an appointment, extract the following information:
1. Service type (cleaning, repair, plumbing, electrical, landscaping)
2. Preferred date and time
3. Customer name
4. Service address
5. Any special notes or requirements

Format your response as JSON with the following structure:
{
  "intent": "book_appointment" or "general_conversation",
  "extractedData": {
    "name": "Customer name or 'Guest' if not provided",
    "service": "One of: cleaning, repair, plumbing, electrical, landscaping",
    "timePreferences": [{"date": "YYYY-MM-DD", "time": "HH:MM"}],
    "address": "Service address or 'To be provided' if not given",
    "notes": "Any special instructions or empty string"
  },
  "response": "Your natural language response to the customer"
}

For general inquiries, just include the "intent" and "response" fields.
Be friendly, helpful, and conversational in your responses.
`;

exports.processMessage = async (message, conversationHistory = []) => {
  try {
    // Prepare conversation history for OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-3.5-turbo-1106", // Using a model with JSON mode capability
        messages: messages,
        temperature: 0.7,
        response_format: { type: "json_object" } // Request JSON response
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the AI response
    const aiResponseText = response.data.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const aiResponse = JSON.parse(aiResponseText);
      
      // If this is a booking intent, validate and normalize the extracted data
      if (aiResponse.intent === 'book_appointment' && aiResponse.extractedData) {
        aiResponse.extractedData = normalizeBookingData(aiResponse.extractedData);
      }
      
      return aiResponse;
    } catch (parseError) {
      console.error('Error parsing OpenAI response as JSON:', parseError);
      // Fallback to a simple response if JSON parsing fails
      return {
        intent: 'general_conversation',
        response: "I'm sorry, I'm having trouble processing your request. Could you please provide more details about what you need?"
      };
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error.response?.data || error.message);
    
    // Fall back to rule-based approach if OpenAI API fails
    return fallbackProcessMessage(message);
  }
};

// Helper function to normalize and validate booking data
function normalizeBookingData(extractedData) {
  const { name, service, timePreferences, address, notes } = extractedData;
  
  // Ensure service is one of the valid types
  const validServices = ['cleaning', 'repair', 'plumbing', 'electrical', 'landscaping'];
  const normalizedService = validServices.includes(service.toLowerCase()) 
    ? service.toLowerCase() 
    : 'cleaning';
  
  // Normalize time preferences
  const normalizedTimePreferences = Array.isArray(timePreferences) ? timePreferences : [];
  
  // If no time preferences were extracted, add a default one for tomorrow
  if (normalizedTimePreferences.length === 0) {
    normalizedTimePreferences.push({
      date: moment().add(1, 'day').format('YYYY-MM-DD'),
      time: '09:00'
    });
  }
  
  // Validate each time preference
  normalizedTimePreferences.forEach(pref => {
    // Ensure date is in YYYY-MM-DD format
    if (!moment(pref.date, 'YYYY-MM-DD', true).isValid()) {
      pref.date = moment().add(1, 'day').format('YYYY-MM-DD');
    }
    
    // Ensure time is in HH:MM format
    if (!moment(pref.time, 'HH:mm', true).isValid()) {
      pref.time = '09:00';
    }
  });
  
  return {
    name: name || 'Guest',
    service: normalizedService,
    timePreferences: normalizedTimePreferences,
    address: address || 'To be provided',
    notes: notes || ''
  };
}

// Fallback function using rule-based approach if OpenAI API fails
function fallbackProcessMessage(message) {
  const lowerMessage = message.toLowerCase();
  
  // Check for appointment booking intent
  if (containsBookingIntent(lowerMessage)) {
    // Extract appointment details
    const extractedData = extractAppointmentData(lowerMessage);
    
    if (extractedData) {
      return {
        intent: 'book_appointment',
        extractedData,
        response: generateBookingResponse(extractedData)
      };
    }
  }
  
  // Handle other intents or general conversation
  return {
    intent: 'general_conversation',
    response: generateGeneralResponse(lowerMessage)
  };
}

// Helper function to check if message contains booking intent
function containsBookingIntent(message) {
  const bookingKeywords = [
    'book', 'schedule', 'appointment', 'reserve', 'service',
    'cleaning', 'repair', 'plumbing', 'electrical', 'landscaping'
  ];
  
  return bookingKeywords.some(keyword => message.includes(keyword));
}

// Helper function to extract appointment data from message
function extractAppointmentData(message) {
  // Try to extract service type
  let service = null;
  const serviceTypes = {
    'cleaning': ['cleaning', 'clean', 'cleaner'],
    'repair': ['repair', 'fix', 'broken'],
    'plumbing': ['plumbing', 'plumber', 'leak', 'pipe'],
    'electrical': ['electrical', 'electrician', 'power', 'outlet'],
    'landscaping': ['landscaping', 'garden', 'lawn', 'yard']
  };
  
  for (const [type, keywords] of Object.entries(serviceTypes)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      service = type;
      break;
    }
  }
  
  // Try to extract date
  let date = null;
  const dateKeywords = [
    { regex: /today/i, value: moment().format('YYYY-MM-DD') },
    { regex: /tomorrow/i, value: moment().add(1, 'day').format('YYYY-MM-DD') },
    { regex: /next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, 
      handler: (match) => {
        const day = match[1].toLowerCase();
        const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
        const today = moment().day();
        const daysToAdd = (dayMap[day] - today + 7) % 7 || 7;
        return moment().add(daysToAdd, 'days').format('YYYY-MM-DD');
      }
    },
    { regex: /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/,
      handler: (match) => {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        let year = match[3] ? parseInt(match[3]) : moment().year();
        if (year < 100) year += 2000; // Convert 2-digit year to 4-digit
        return moment({ year, month: month - 1, day }).format('YYYY-MM-DD');
      }
    }
  ];
  
  for (const keyword of dateKeywords) {
    const match = message.match(keyword.regex);
    if (match) {
      date = keyword.handler ? keyword.handler(match) : keyword.value;
      break;
    }
  }
  
  // Try to extract time
  let time = null;
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const timeMatch = message.match(timeRegex);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
    
    // Convert to 24-hour format
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Try to extract name
  let name = null;
  const nameRegex = /(?:my name is|this is|i am|i'm) ([a-z\s]+)/i;
  const nameMatch = message.match(nameRegex);
  
  if (nameMatch) {
    name = nameMatch[1].trim();
  }
  
  // Try to extract address
  let address = null;
  const addressRegex = /(?:at|on|in) ([0-9]+[a-z\s,]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|place|pl|court|ct))/i;
  const addressMatch = message.match(addressRegex);
  
  if (addressMatch) {
    address = addressMatch[1].trim();
  }
  
  // If we have enough information, return the extracted data
  if (service && (date || time)) {
    const timePreferences = [];
    
    if (date && time) {
      timePreferences.push({ date, time });
    } else if (date) {
      // Default to 9 AM if no time specified
      timePreferences.push({ date, time: '09:00' });
    } else if (time) {
      // Default to tomorrow if no date specified
      timePreferences.push({ 
        date: moment().add(1, 'day').format('YYYY-MM-DD'), 
        time 
      });
    }
    
    return {
      name: name || 'Guest',
      address: address || 'To be provided',
      service,
      timePreferences,
      notes: ''
    };
  }
  
  return null;
}

// Helper function to generate a response for booking intent
function generateBookingResponse(extractedData) {
  const { name, service, timePreferences } = extractedData;
  const dateStr = moment(timePreferences[0].date).format('dddd, MMMM D');
  const timeStr = moment(`2000-01-01T${timePreferences[0].time}`).format('h:mm A');
  
  return `Great! I've got you down for a ${service} appointment on ${dateStr} at ${timeStr}. Can you confirm this works for you, ${name}?`;
}

// Helper function to generate a general response
function generateGeneralResponse(message) {
  // Simple rule-based responses
  if (message.includes('hello') || message.includes('hi')) {
    return "Hello! I'm RouteRover AI. How can I help you today? I can schedule cleaning, repair, plumbing, electrical, or landscaping services for you.";
  }
  
  if (message.includes('service') || message.includes('offer')) {
    return "We offer home cleaning, repairs, plumbing, electrical work, and landscaping services. Would you like to schedule an appointment for any of these?";
  }
  
  if (message.includes('price') || message.includes('cost') || message.includes('rate')) {
    return "Our pricing varies depending on the service and scope of work. I'd be happy to provide a quote after understanding your specific needs. Could you tell me more about what service you're interested in?";
  }
  
  if (message.includes('cancel') || message.includes('reschedule')) {
    return "To cancel or reschedule an appointment, please provide your name and the date of your scheduled service, and I'll help you with that.";
  }
  
  if (message.includes('thank')) {
    return "You're welcome! Is there anything else I can help you with today?";
  }
  
  // Default response
  return "I'm here to help you schedule services or answer questions about our offerings. Would you like to book an appointment for cleaning, repairs, plumbing, electrical work, or landscaping?";
}