
export function getPermissionLevelFromRoles(roleNames) {
  // Priority order: superadmin > admin > mod > member
  const priority = [
    { name: 'Dr. Badass', level: 'superadmin' },
    { name: 'Angels', level: 'admin' },
    { name: 'Prophets', level: 'mod' },
    { name: 'SPN Fam', level: 'member' }
  ];
  for (const { name, level } of priority) {
    if (roleNames.includes(name)) return level;
  }
  return 'non_member';
}