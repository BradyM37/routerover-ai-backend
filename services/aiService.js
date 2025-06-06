const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

exports.processMessage = async (message, conversationHistory = []) => {
  try {
    console.log('Processing message:', message);
    
    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are RouteRover AI, an assistant for a home service company. 
            You help customers book appointments for services like cleaning, repair, plumbing, electrical, and landscaping.
            Be friendly, helpful, and concise.`
          },
          // Include conversation history if available
          ...conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    // Extract the assistant's message
    const assistantMessage = response.data.choices[0].message.content;
    
    // Simple intent detection
    const intent = detectIntent(message);
    
    return {
      response: assistantMessage,
      intent: intent,
      appointmentBooked: false
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error.response?.data || error.message);
    
    // Check if it's a quota error
    if (error.response?.data?.error?.code === 'insufficient_quota') {
      return {
        response: "I'm currently experiencing high demand and can't process your request right now. Please try again later or use the form booking option instead.",
        intent: "error",
        appointmentBooked: false,
        error: "API quota exceeded"
      };
    }
    
    // Fallback to rule-based responses
    return generateFallbackResponse(message);
  }
};

// Simple intent detection function
function detectIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('book') || lowerMessage.includes('schedule') || lowerMessage.includes('appointment')) {
    return 'booking';
  } else if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
    return 'cancellation';
  } else if (lowerMessage.includes('service') || lowerMessage.includes('repair') || 
             lowerMessage.includes('clean') || lowerMessage.includes('plumb') || 
             lowerMessage.includes('electric') || lowerMessage.includes('landscape')) {
    return 'service_inquiry';
  } else {
    return 'general_conversation';
  }
}

// Generate a fallback response when OpenAI API is unavailable
function generateFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  // Simple rule-based responses
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return {
      response: "Hello! I'm RouteRover AI. How can I help you today? I can schedule cleaning, repair, plumbing, electrical, or landscaping services for you.",
      intent: "greeting"
    };
  } else if (lowerMessage.includes('book') || lowerMessage.includes('schedule') || lowerMessage.includes('appointment')) {
    return {
      response: "I'd be happy to help you book an appointment. Could you please provide your name, address, the service you need, and your preferred date and time? Alternatively, you can use our form booking option for a smoother experience.",
      intent: "booking"
    };
  } else if (lowerMessage.includes('service')) {
    return {
      response: "We offer various services including cleaning, repair, plumbing, electrical, and landscaping. Which service are you interested in?",
      intent: "service_inquiry"
    };
  } else if (lowerMessage.includes('thank')) {
    return {
      response: "You're welcome! Is there anything else I can help you with today?",
      intent: "gratitude"
    };
  } else if (lowerMessage.includes('when') && lowerMessage.includes('company')) {
    return {
      response: "RouteRover was founded in 2023 to provide efficient and reliable home services with smart scheduling technology.",
      intent: "company_info"
    };
  } else {
    return {
      response: "I'm currently operating with limited capabilities. Could you try asking something about our services or booking an appointment? Alternatively, you can use our form booking option.",
      intent: "general_conversation"
    };
  }
}