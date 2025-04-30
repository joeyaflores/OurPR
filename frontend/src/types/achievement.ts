// Corresponds to backend/app/models/achievement.py EarnedAchievementDetail

export interface EarnedAchievementDetail {
  achievement_id: string; // UUID
  code: string;
  name: string;
  description: string;
  icon_name: string; // e.g., "Trophy", "Sparkles" (Lucide icon name)
  earned_at: string; // ISO Date string
} 