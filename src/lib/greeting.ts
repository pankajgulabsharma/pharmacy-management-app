export function getGreetingName() {
  return "Pankaj";
}

export function getTimeBasedGreetingKey() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "greeting.morning";
  if (hour >= 12 && hour < 17) return "greeting.afternoon";
  if (hour >= 17 && hour < 21) return "greeting.evening";
  return "greeting.night";
}
