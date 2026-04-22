export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

interface TimeContext {
  period: TimePeriod;
  greeting: string;
  energy: string;
  pace: string;
  mood: string;
  tags: string;
  systemTone: string;
  timeString: string;
}

/**
 * Gets context based on the current time in a specific timezone offset.
 * @param timezoneOffset Minutes from UTC (e.g., 330 for IST)
 */
export function getTimeContext(timezoneOffset: number = 330): TimeContext {
  // Get current UTC time
  const now = new Date();
  // Adjust to target timezone
  const targetTime = new Date(now.getTime() + timezoneOffset * 60 * 1000);
  const hour = targetTime.getUTCHours();
  const minutes = targetTime.getUTCMinutes();
  
  // Format as HH:MM AM/PM
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const timeString = `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;

  if (hour >= 5 && hour < 12) {
    return {
      period: 'morning',
      greeting: 'Good morning',
      energy: 'HIGH — like waking up the city, fresh and punchy',
      pace: 'upbeat, slightly fast',
      mood: 'energetic, cheerful, motivating',
      tags: '[enthusiasm] [happy] [determination]',
      systemTone: `This is a MORNING broadcast (5AM–12PM). 
Tone: Fresh, high-energy, wake-up vibe. 
Think Fever 104 FM morning show — punchy, fast, exciting. 
Hosts sound like they've had their coffee and are genuinely excited.`,
      timeString
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      period: 'afternoon',
      greeting: 'Good afternoon',
      energy: 'MEDIUM — conversational, engaging, not sleepy',
      pace: 'steady, measured, warm',
      mood: 'friendly, informative, easy-going',
      tags: '[positive] [curiosity] [interest]',
      systemTone: `This is an AFTERNOON broadcast (12PM–5PM). 
Tone: Relaxed but engaged, like chatting with a friend over lunch. 
Not flat, not hyper — conversational and warm. 
Hosts sound comfortable, natural, slightly laid-back.`,
      timeString
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      period: 'evening',
      greeting: 'Good evening',
      energy: 'MEDIUM-HIGH — unwinding but lively, end-of-day energy',
      pace: 'smooth, slightly slower than morning',
      mood: 'reflective, warm, nostalgic with humor',
      tags: '[amusement] [hope] [sighs]',
      systemTone: `This is an EVENING broadcast (5PM–9PM). 
Tone: Warm, smooth, winding-down vibe — like drive-time radio. 
Hosts sound relaxed, a bit reflective, still engaging. 
Think end-of-day unwinding with good company.`,
      timeString
    };
  }

  // night: 9PM–5AM
  return {
    period: 'night',
    greeting: 'Good night',
    energy: 'LOW — calm, intimate, late-night radio feel',
    pace: 'slow, deliberate, soft',
    mood: 'intimate, thoughtful, peaceful',
    tags: '[whispers] [curiosity] [neutral]',
    systemTone: `This is a NIGHT broadcast (9PM–5AM). 
Tone: Calm, intimate, late-night radio — like the city is quiet. 
Hosts speak softly, thoughtfully, like whispering to one listener. 
Think slow jazz radio at 2AM.`,
    timeString
  };
}
