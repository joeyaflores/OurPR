
🏁 Zero-to-Value UX Flow — Implementation Guide
==============================================

🎯 Goal
------
Deliver **real, personalized value within 30 seconds** of opening the web app — Runners should feel like this app just “gets” them.

🧭 Suggested Flow: "Find My PR Race"
-----------------------------------

### Step 1: Goal Race Input
- **Prompt**: _“What’s your next goal race?”_
- **Input**: Freeform text + calendar picker OR searchable dropdown list of known races
- **Fallback**: “Not sure yet” → continue without one

```ts
{
  goal_race: "CIM 2025",
  goal_date: "2025-12-08"
}
```

### Step 2: PR or Target Pace
- **Prompt**: _“Tell us your PR or your goal pace”_
- **Inputs**:
  - Dropdown (Distance: 5K, 10K, Half, Marathon)
  - Text input (Time: HH:MM:SS)
  - (Optional): Connect Strava or upload a screenshot/image of past race
  - Smart parse uploaded race data using OCR or GPS file import

```ts
{
  goal_distance: "Marathon",
  goal_time: "3:15:00",
  strava_connected: false
}
```

### Step 3: AI-Powered Race Recommendations
- **Prompt**: _“Based on your goals, here are top PR-friendly races near you in the next 6 months”_
- **Backed by**:
  - Location (via device or IP)
  - PR-potential race data (flatness, weather, pace group size, etc.)
  - OpenAI/Gemini-generated summaries (hidden from user)

### Output: High-value cards
- Race name + date
- Flatness rating (1-5)
- Weather profile
- Historic PR rate (% runners who PR’d)
- Link to register

```json
[
  {
    "name": "Houston Marathon",
    "date": "2026-01-18",
    "flatness_score": 5,
    "pr_rate": "36%",
    "weather_profile": "50°F avg, flat, low humidity",
    "register_url": "https://..."
  },
  ...
]
```

✨ Why This Works
-----------------
- **Immediate relevance**: it’s not a chat — it’s _their data_
- **Personalization**: it feels like a coach or concierge tool
- **Strava opt-in**: adds future power but isn’t a wall
- **UI-first**: chat is invisible, magic is visible

🔜 Optional Add-ons
-------------------
- "Compare Races" toggle (Houston vs CIM vs Indy)
- “Add to plan” → enables training calendar
