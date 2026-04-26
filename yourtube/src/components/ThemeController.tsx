import { useEffect } from 'react';
import { useTheme } from 'next-themes';

const SOUTH_INDIAN_STATES = [
  'Tamil Nadu',
  'Kerala',
  'Karnataka',
  'Andhra Pradesh',
  'Telangana'
];

export default function ThemeController() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const updateTheme = async () => {
      try {
        // 1. Get Location
        // Using ipapi.co for state-level geolocation
        const geoResponse = await fetch('https://ipapi.co/json/').catch(() => null);
        let userState = "Other";
        if (geoResponse) {
          const geoData = await geoResponse.json().catch(() => ({}));
          userState = geoData.region || "Other";
        }

        // 2. Get Time in IST
        const now = new Date();
        const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const hours = istTime.getHours();

        // Condition: 10:00 AM to 12:00 PM IST (Hours 10 and 11)
        const isCorrectTime = hours >= 10 && hours < 12;
        const isSouthIndia = SOUTH_INDIAN_STATES.includes(userState);

        console.log('Theme Context:', { userState, hours, isSouthIndia, isCorrectTime });

        if (isSouthIndia && isCorrectTime) {
          setTheme('light');
        } else {
          setTheme('dark');
        }
      } catch (error) {
        console.error('ThemeController: Error detecting context', error);
        // Default to dark theme on error/failure
        setTheme('dark');
      }
    };

    updateTheme();

    // Refresh theme every 5 minutes
    const interval = setInterval(updateTheme, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [setTheme]);

  return null;
}
