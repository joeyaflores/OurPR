import React from 'react';
import * as Icons from 'lucide-react';

// Map icon names (string) to Lucide components
// Extend this map as needed based on icons used in the achievements table
const iconMap: { [key: string]: React.ComponentType<Icons.LucideProps> } = {
  Sparkles: Icons.Sparkles,
  Medal: Icons.Medal,
  Run: Icons.Footprints,
  Mountain: Icons.Mountain,
  Zap: Icons.Zap,
  Clock4: Icons.Clock4,
  Star: Icons.Star,
  BarChart3: Icons.BarChart3,
  Trophy: Icons.Trophy,
  Award: Icons.Award, // Add a default or fallback
  // Add other icons used in your achievements table here
};

interface AchievementIconProps extends Icons.LucideProps {
  iconName: string;
}

const AchievementIcon: React.FC<AchievementIconProps> = ({ iconName, ...props }) => {
  const IconComponent = iconMap[iconName] || Icons.Award; // Default to Award if not found

  // Add default classes, allowing overrides via props
  const defaultClassName = "w-6 h-6 text-amber-500"; // Default size and color
  const combinedClassName = `${defaultClassName} ${props.className || ''}`.trim();


  return <IconComponent {...props} className={combinedClassName} />;
};

export default AchievementIcon; 